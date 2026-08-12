-- PL/pgSQL exposes RETURNS TABLE columns as variables. Qualify every CTE
-- column that shares an output name so checkout cannot fail at statement
-- planning time with an ambiguous-column error.
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
      priced.unit_price * (priced.quantity - priced.requested_rewards)
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
  select coalesce(sum(lines.gross_amount - lines.discount_amount), 0),
    coalesce(max(lines.gross_amount), 0),
    coalesce(max(lines.discount_amount), 0)
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
      priced.unit_price::bigint * (priced.quantity - priced.requested_rewards)
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
