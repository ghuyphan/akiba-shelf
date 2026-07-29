-- Prevent lifetime sales aggregates from overflowing 32-bit integer casts.
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
