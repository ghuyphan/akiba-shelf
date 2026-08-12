-- Keep public checkout totals within the integer columns used by orders and
-- order_items. Centralizing the bound avoids mismatched literals in RPCs.
create function private.checkout_max_total_vnd()
returns bigint
language sql
immutable
set search_path = ''
as $$
  select 2147483647::bigint
$$;

revoke all on function private.checkout_max_total_vnd()
from public, anon, authenticated, service_role;

-- Reject stale reward carts and overflow before create_order writes an order
-- or mutates inventory. The return signature stays compatible with create_order.
create or replace function private.calculate_promotion_lines(
  p_shop_id uuid,
  p_items jsonb
)
returns table(
  product_id text,
  quantity integer,
  unit_price integer,
  free_quantity integer,
  discount_amount integer
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  requested_reward_count bigint;
  promotion_row public.promotions;
  authoritative_total bigint;
  maximum_line_gross bigint;
  maximum_line_discount bigint;
begin
  select coalesce(sum(coalesce(item.reward_quantity, 0)), 0)::bigint
  into requested_reward_count
  from jsonb_to_recordset(p_items)
    item(product_id text, quantity integer, reward_quantity integer);

  if requested_reward_count > 0 then
    select * into promotion_row
    from public.promotions promotion
    where promotion.shop_id = p_shop_id;

    if promotion_row.shop_id is null
      or not promotion_row.enabled
      or promotion_row.kind <> 'buy_get'
      or (promotion_row.starts_at is not null and now() < promotion_row.starts_at)
      or (promotion_row.ends_at is not null and now() >= promotion_row.ends_at) then
      raise exception 'This promotion is no longer active';
    end if;
  end if;

  with cart as (
    select item.product_id,
      sum(item.quantity)::bigint as quantity,
      sum(coalesce(item.reward_quantity, 0))::bigint as requested_rewards
    from jsonb_to_recordset(p_items)
      item(product_id text, quantity integer, reward_quantity integer)
    group by item.product_id
  ), priced as (
    select product.effective_price_vnd::bigint as unit_price,
      cart.quantity,
      cart.requested_rewards,
      coalesce(mapping.role, '') as promotion_role
    from cart
    join public.products product
      on product.shop_id = p_shop_id and product.id = cart.product_id
    left join public.promotion_products mapping
      on mapping.shop_id = p_shop_id and mapping.product_id = cart.product_id
  ), totals as (
    select coalesce(sum(
      unit_price * (quantity - requested_rewards)
    ), 0)::bigint as paid_subtotal
    from priced
  ), settings as (
    select promotion.*,
      promotion.enabled
        and (promotion.starts_at is null or now() >= promotion.starts_at)
        and (promotion.ends_at is null or now() < promotion.ends_at)
        and (
          promotion.kind <> 'percentage'
          or totals.paid_subtotal >= promotion.minimum_subtotal_vnd
        ) as active
    from public.promotions promotion
    cross join totals
    where promotion.shop_id = p_shop_id
  ), lines as (
    select priced.unit_price * priced.quantity as gross_amount,
      case
        when coalesce(settings.active, false)
          and settings.kind = 'percentage'
          and priced.promotion_role in ('qualifying', 'both')
          then floor(
            priced.unit_price::numeric
            * (priced.quantity - priced.requested_rewards)
            * settings.percentage_off / 100
          )::bigint
        when coalesce(settings.active, false) and settings.kind = 'buy_get'
          then priced.requested_rewards * priced.unit_price
        else 0
      end as discount_amount
    from priced
    left join settings on true
  )
  select coalesce(sum(gross_amount - discount_amount), 0),
    coalesce(max(gross_amount), 0),
    coalesce(max(discount_amount), 0)
  into authoritative_total, maximum_line_gross, maximum_line_discount
  from lines;

  if authoritative_total > private.checkout_max_total_vnd()
    or maximum_line_gross > private.checkout_max_total_vnd()
    or maximum_line_discount > private.checkout_max_total_vnd() then
    raise exception 'Cart total is too large';
  end if;

  return query
  with cart as (
    select item.product_id,
      sum(item.quantity)::integer as quantity,
      sum(coalesce(item.reward_quantity, 0))::integer as requested_rewards
    from jsonb_to_recordset(p_items)
      item(product_id text, quantity integer, reward_quantity integer)
    group by item.product_id
  ), priced as (
    select product.id as product_id,
      cart.quantity,
      cart.requested_rewards,
      product.effective_price_vnd as unit_price,
      coalesce(mapping.role, '') as promotion_role
    from cart
    join public.products product
      on product.shop_id = p_shop_id and product.id = cart.product_id
    left join public.promotion_products mapping
      on mapping.shop_id = p_shop_id and mapping.product_id = cart.product_id
  ), totals as (
    select coalesce(sum(
      unit_price::bigint * (quantity - requested_rewards)
    ), 0)::bigint as paid_subtotal
    from priced
  ), settings as (
    select promotion.*,
      promotion.enabled
        and (promotion.starts_at is null or now() >= promotion.starts_at)
        and (promotion.ends_at is null or now() < promotion.ends_at)
        and (
          promotion.kind <> 'percentage'
          or totals.paid_subtotal >= promotion.minimum_subtotal_vnd
        ) as active
    from public.promotions promotion
    cross join totals
    where promotion.shop_id = p_shop_id
  )
  select priced.product_id,
    priced.quantity,
    priced.unit_price,
    case
      when coalesce(settings.active, false) and settings.kind = 'buy_get'
        then priced.requested_rewards
      else 0
    end::integer,
    case
      when coalesce(settings.active, false)
        and settings.kind = 'percentage'
        and priced.promotion_role in ('qualifying', 'both')
        then floor(
          priced.unit_price::numeric
          * (priced.quantity - priced.requested_rewards)
          * settings.percentage_off / 100
        )::integer
      when coalesce(settings.active, false) and settings.kind = 'buy_get'
        then priced.requested_rewards * priced.unit_price
      else 0
    end::integer
  from priced
  left join settings on true;
end;
$$;

revoke all on function private.calculate_promotion_lines(uuid, jsonb)
from public, anon, authenticated, service_role;

create or replace function public.get_sales_summary(
  p_shop_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.is_shop_member(p_shop_id) then
    raise exception 'Active shop access required' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_from >= p_to then
    raise exception 'Sales summary range is invalid';
  end if;
  if p_to - p_from > interval '366 days' then
    raise exception 'Sales summary range cannot exceed 366 days';
  end if;

  return (
    with confirmed_orders as materialized (
      select online_order.id, 'online'::text as source,
        online_order.total_amount, online_order.discount_amount,
        null::text as payment_method
      from public.orders online_order
      where online_order.shop_id = p_shop_id
        and online_order.status = 'confirmed'
        and online_order.confirmed_at >= p_from
        and online_order.confirmed_at < p_to
      union all
      select event_order.id, 'offline_event'::text,
        event_order.total_amount,
        coalesce((
          select sum(item.discount_amount)
          from public.offline_event_order_items item
          where item.order_id = event_order.id
        ), 0)::bigint,
        event_order.payment_method
      from public.offline_event_orders event_order
      where event_order.shop_id = p_shop_id
        and event_order.status = 'confirmed'
        and event_order.confirmed_at >= p_from
        and event_order.confirmed_at < p_to
    ), sales_lines as (
      select item.product_id,
        coalesce(product.name, item.product_id) as name,
        coalesce(product.item_code, '') as item_code,
        item.quantity,
        item.unit_price::bigint * item.quantity - item.discount_amount as revenue,
        item.discount_amount::bigint
      from confirmed_orders confirmed
      join public.order_items item
        on confirmed.source = 'online' and item.order_id = confirmed.id
      left join public.products product
        on product.shop_id = p_shop_id and product.id = item.product_id
      union all
      select item.product_id,
        coalesce(allocation.product_snapshot ->> 'name', item.product_id),
        coalesce(allocation.product_snapshot ->> 'item_code', ''),
        item.quantity,
        item.unit_price::bigint * item.quantity - item.discount_amount,
        item.discount_amount::bigint
      from confirmed_orders confirmed
      join public.offline_event_order_items item
        on confirmed.source = 'offline_event' and item.order_id = confirmed.id
      left join public.offline_event_allocations allocation
        on allocation.session_id = item.session_id
       and allocation.product_id = item.product_id
    ), products as (
      select product_id, max(name) as name, max(item_code) as item_code,
        sum(quantity)::bigint as units,
        sum(revenue)::bigint as revenue,
        sum(discount_amount)::bigint as discount_amount
      from sales_lines
      group by product_id
    )
    select jsonb_build_object(
      'from', p_from,
      'to', p_to,
      'revenue', coalesce(sum(confirmed.total_amount), 0),
      'discount_amount', coalesce(sum(confirmed.discount_amount), 0),
      'confirmed_order_count', count(*),
      'units_sold', coalesce((select sum(units) from products), 0),
      'online_revenue', coalesce(sum(confirmed.total_amount)
        filter (where confirmed.source = 'online'), 0),
      'event_revenue', coalesce(sum(confirmed.total_amount)
        filter (where confirmed.source = 'offline_event'), 0),
      'cash_revenue', coalesce(sum(confirmed.total_amount)
        filter (where confirmed.source = 'offline_event'
          and confirmed.payment_method = 'cash'), 0),
      'vietqr_revenue', coalesce(sum(confirmed.total_amount)
        filter (where confirmed.source = 'offline_event'
          and confirmed.payment_method = 'vietqr'), 0),
      'product_breakdown', coalesce((
        select jsonb_agg(jsonb_build_object(
          'product_id', products.product_id,
          'name', products.name,
          'item_code', products.item_code,
          'units', products.units,
          'revenue', products.revenue,
          'discount_amount', products.discount_amount
        ) order by products.revenue desc, products.name, products.product_id)
        from products
      ), '[]'::jsonb)
    )
    from confirmed_orders confirmed
  );
end;
$$;

revoke all on function public.get_sales_summary(uuid, timestamptz, timestamptz)
from public, anon, authenticated;
grant execute on function public.get_sales_summary(uuid, timestamptz, timestamptz)
to authenticated;

notify pgrst, 'reload schema';
