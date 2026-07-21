create index offline_event_orders_shop_created_idx
  on public.offline_event_orders (shop_id, created_at desc, id desc);

create function public.get_offline_event_orders(
  p_shop_id uuid,
  p_page integer default 1,
  p_page_size integer default 12,
  p_status text default 'all',
  p_created_after timestamptz default null,
  p_created_before timestamptz default null
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
  if p_page < 1 or p_page_size not between 1 and 100 then
    raise exception 'Invalid order page';
  end if;
  if p_status not in ('all', 'pending', 'confirmed', 'cancelled', 'expired') then
    raise exception 'Invalid order status';
  end if;

  return (
    with base as (
      select event_order.*
      from public.offline_event_orders event_order
      where event_order.shop_id = p_shop_id
        and (p_created_after is null or event_order.created_at >= p_created_after)
        and (p_created_before is null or event_order.created_at < p_created_before)
    ),
    filtered as (
      select *
      from base
      where p_status = 'all' or status = p_status
    ),
    page_rows as (
      select jsonb_build_object(
        'id', event_order.id,
        'shop_id', event_order.shop_id,
        'order_code', event_order.order_code,
        'customer_name', event_order.customer_name,
        'total_amount', event_order.total_amount,
        'discount_amount', coalesce((
          select sum(item.discount_amount)
          from public.offline_event_order_items item
          where item.order_id = event_order.id
        ), 0),
        'status', event_order.status,
        'created_at', event_order.created_at,
        'updated_at', event_order.updated_at,
        'expires_at', null,
        'confirmed_at', case when event_order.status = 'confirmed' then event_order.updated_at end,
        'cancelled_at', case when event_order.status = 'cancelled' then event_order.updated_at end,
        'expired_at', null,
        'source', 'offline_event',
        'offline_event_session_id', event_order.session_id,
        'offline_event_name', event_session.name,
        'payment_method', event_order.payment_method,
        'payment_state', event_order.payment_state,
        'order_items', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id', item.order_id::text || ':' || item.product_id,
              'order_id', item.order_id,
              'product_id', item.product_id,
              'quantity', item.quantity,
              'unit_price', item.unit_price,
              'free_quantity', 0,
              'discount_amount', item.discount_amount,
              'product', jsonb_build_object(
                'id', item.product_id,
                'name', coalesce(allocation.product_snapshot ->> 'name', item.product_id),
                'item_code', coalesce(allocation.product_snapshot ->> 'item_code', ''),
                'images', case
                  when jsonb_typeof(allocation.product_snapshot -> 'images') = 'array'
                    then allocation.product_snapshot -> 'images'
                  else '[]'::jsonb
                end
              )
            ) order by item.product_id
          )
          from public.offline_event_order_items item
          left join public.offline_event_allocations allocation
            on allocation.session_id = item.session_id
           and allocation.product_id = item.product_id
          where item.order_id = event_order.id
        ), '[]'::jsonb)
      ) as payload,
      event_order.created_at as sort_created_at,
      event_order.id as sort_id
      from filtered event_order
      join public.offline_event_sessions event_session
        on event_session.id = event_order.session_id
      order by event_order.created_at desc, event_order.id desc
      limit p_page_size
      offset (p_page - 1) * p_page_size
    )
    select jsonb_build_object(
      'orders', coalesce((
        select jsonb_agg(payload order by sort_created_at desc, sort_id desc)
        from page_rows
      ), '[]'::jsonb),
      'total', (select count(*) from filtered),
      'counts', jsonb_build_object(
        'pending', (select count(*) from base where status = 'pending'),
        'confirmed', (select count(*) from base where status = 'confirmed'),
        'cancelled', (select count(*) from base where status = 'cancelled'),
        'expired', 0,
        'all', (select count(*) from base)
      )
    )
  );
end;
$$;

revoke all on function public.get_offline_event_orders(
  uuid,
  integer,
  integer,
  text,
  timestamptz,
  timestamptz
) from public, anon, authenticated;

grant execute on function public.get_offline_event_orders(
  uuid,
  integer,
  integer,
  text,
  timestamptz,
  timestamptz
) to authenticated;

notify pgrst, 'reload schema';
