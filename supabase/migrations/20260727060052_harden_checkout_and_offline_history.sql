-- Serialize promotion changes only against products whose eligibility can
-- change. Checkout locks cart products in the same order, so unaffected
-- catalog rows no longer block while preserving promotion consistency.
create or replace function public.save_promotion_settings(
  p_shop_id uuid,
  p_enabled boolean,
  p_buy_quantity integer,
  p_free_quantity integer,
  p_repeatable boolean,
  p_qualifying_product_ids text[],
  p_reward_product_ids text[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
    or not private.has_shop_role(p_shop_id, array['owner', 'admin']) then
    raise exception 'Active shop owner or admin access required'
      using errcode = '42501';
  end if;
  if cardinality(coalesce(p_qualifying_product_ids, '{}'::text[])) > 500
    or cardinality(coalesce(p_reward_product_ids, '{}'::text[])) > 500 then
    raise exception 'Promotion product selection is too large';
  end if;
  if p_buy_quantity not between 1 and 99
    or p_free_quantity not between 1 and 99 then
    raise exception 'Promotion quantities must be between 1 and 99';
  end if;
  if p_enabled and (
    cardinality(coalesce(p_qualifying_product_ids, '{}'::text[])) = 0
    or cardinality(coalesce(p_reward_product_ids, '{}'::text[])) = 0
  ) then
    raise exception 'An active promotion requires qualifying and reward products';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('shop-promotion:' || p_shop_id::text, 0)
  );

  if exists(
    select 1
    from unnest(
      coalesce(p_qualifying_product_ids, '{}'::text[])
      || coalesce(p_reward_product_ids, '{}'::text[])
    ) requested(product_id)
    left join public.products product
      on product.shop_id = p_shop_id and product.id = requested.product_id
    where product.id is null
  ) then
    raise exception 'Promotion contains a product from another shop';
  end if;

  -- Lock the old and new eligibility sets. This is the smallest set that can
  -- affect an in-flight checkout while retaining a deterministic order.
  perform product.id
  from public.products product
  where product.shop_id = p_shop_id
    and product.id in (
      select mapping.product_id
      from public.promotion_products mapping
      where mapping.shop_id = p_shop_id
      union
      select requested.product_id
      from unnest(
        coalesce(p_qualifying_product_ids, '{}'::text[])
        || coalesce(p_reward_product_ids, '{}'::text[])
      ) requested(product_id)
    )
  order by product.id
  for update;

  insert into public.promotions(
    shop_id, enabled, buy_quantity, free_quantity, repeatable, updated_at
  ) values (
    p_shop_id, p_enabled, p_buy_quantity, p_free_quantity, p_repeatable, now()
  )
  on conflict (shop_id) do update set
    enabled = excluded.enabled,
    buy_quantity = excluded.buy_quantity,
    free_quantity = excluded.free_quantity,
    repeatable = excluded.repeatable,
    updated_at = excluded.updated_at;

  delete from public.promotion_products mapping
  where mapping.shop_id = p_shop_id;

  insert into public.promotion_products(shop_id, product_id, role)
  select p_shop_id, requested.product_id,
    case
      when requested.product_id = any(coalesce(p_qualifying_product_ids, '{}'::text[]))
        and requested.product_id = any(coalesce(p_reward_product_ids, '{}'::text[]))
        then 'both'
      when requested.product_id = any(coalesce(p_qualifying_product_ids, '{}'::text[]))
        then 'qualifying'
      else 'reward'
    end
  from (
    select distinct product_id
    from unnest(
      coalesce(p_qualifying_product_ids, '{}'::text[])
      || coalesce(p_reward_product_ids, '{}'::text[])
    ) input(product_id)
  ) requested;
end;
$$;

revoke all on function public.save_promotion_settings(
  uuid, boolean, integer, integer, boolean, text[], text[]
) from public, anon, authenticated;
grant execute on function public.save_promotion_settings(
  uuid, boolean, integer, integer, boolean, text[], text[]
) to authenticated;

-- Keep event timestamps near the server-observed event window. This prevents
-- a device clock or edited ledger from moving sales into arbitrary reports.
create or replace function private.validate_offline_event_order_timestamps()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_started_at timestamptz;
begin
  select coalesce(started_at, created_at)
  into event_started_at
  from public.offline_event_sessions
  where id = new.session_id;
  if event_started_at is null then
    raise exception 'Offline order timestamps are outside the event window';
  end if;
  -- Integrity-v1 rows may predate the current event window. Preserve their
  -- stored creation time during the guarded legacy finalization path.
  if tg_op = 'INSERT' then
    if new.created_at < event_started_at - interval '10 minutes' then
      raise exception 'Offline order timestamps are outside the event window';
    end if;
  elsif new.created_at is distinct from old.created_at
    and new.created_at < event_started_at - interval '10 minutes' then
    raise exception 'Offline order timestamps are outside the event window';
  end if;
  if new.updated_at < new.created_at
    or new.updated_at > now() + interval '10 minutes' then
    raise exception 'Offline order timestamps are outside the event window';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_offline_event_order_timestamps
on public.offline_event_orders;
create trigger validate_offline_event_order_timestamps
before insert or update of created_at, updated_at on public.offline_event_orders
for each row execute function private.validate_offline_event_order_timestamps();

revoke all on function private.validate_offline_event_order_timestamps()
from public, anon, authenticated;

create index if not exists offline_event_orders_shop_status_created_idx
  on public.offline_event_orders(shop_id, status, created_at desc, id desc);

-- Reduce repeated scans: count the filtered relation once and aggregate items
-- only for the page selected by the requested offset.
create or replace function public.get_offline_event_orders(
  p_shop_id uuid,
  p_page integer default 1,
  p_page_size integer default 12,
  p_status text default 'all',
  p_created_after timestamptz default null,
  p_created_before timestamptz default null,
  p_session_id uuid default null
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
  if p_session_id is not null and not exists (
    select 1 from public.offline_event_sessions event_session
    where event_session.id = p_session_id and event_session.shop_id = p_shop_id
  ) then
    raise exception 'Offline event not found';
  end if;

  return (
    with base as materialized (
      select event_order.*
      from public.offline_event_orders event_order
      where event_order.shop_id = p_shop_id
        and (p_session_id is null or event_order.session_id = p_session_id)
        and (p_created_after is null or event_order.created_at >= p_created_after)
        and (p_created_before is null or event_order.created_at < p_created_before)
    ), filtered as materialized (
      select * from base where p_status = 'all' or status = p_status
    ), page_rows as materialized (
      select event_order.*, event_session.name as event_name
      from filtered event_order
      join public.offline_event_sessions event_session
        on event_session.id = event_order.session_id
      order by event_order.created_at desc, event_order.id desc
      limit p_page_size offset (p_page - 1) * p_page_size
    ), item_rows as (
      select page_order.id as order_id,
        coalesce(sum(item.discount_amount), 0) as discount_amount,
        coalesce(jsonb_agg(jsonb_build_object(
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
        ) order by item.product_id), '[]'::jsonb) as order_items
      from page_rows page_order
      join public.offline_event_order_items item on item.order_id = page_order.id
      left join public.offline_event_allocations allocation
        on allocation.session_id = item.session_id
       and allocation.product_id = item.product_id
      group by page_order.id
    ), base_summary as (
      select
        count(*) as total,
        count(*) filter (where status = 'pending') as pending,
        count(*) filter (where status = 'confirmed') as confirmed,
        count(*) filter (where status = 'cancelled') as cancelled
      from base
    ), filtered_summary as (
      select count(*) as total
      from filtered
    )
    select jsonb_build_object(
      'orders', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', page_order.id,
          'shop_id', page_order.shop_id,
          'order_code', page_order.order_code,
          'customer_name', page_order.customer_name,
          'total_amount', page_order.total_amount,
          'discount_amount', coalesce(item_rows.discount_amount, 0),
          'status', page_order.status,
          'created_at', page_order.created_at,
          'updated_at', page_order.updated_at,
          'expires_at', null,
          'confirmed_at', page_order.confirmed_at,
          'cancelled_at', page_order.cancelled_at,
          'expired_at', null,
          'fulfillment_status', page_order.fulfillment_status,
          'fulfillment_updated_at', page_order.fulfillment_updated_at,
          'confirmed_by_email', page_order.confirmed_by_label,
          'cancelled_by_email', page_order.cancelled_by_label,
          'fulfillment_updated_by_email', page_order.fulfillment_updated_by_label,
          'source', 'offline_event',
          'offline_event_session_id', page_order.session_id,
          'offline_event_name', page_order.event_name,
          'payment_method', page_order.payment_method,
          'payment_state', page_order.payment_state,
          'order_items', coalesce(item_rows.order_items, '[]'::jsonb)
        ) order by page_order.created_at desc, page_order.id desc)
        from page_rows page_order
        left join item_rows on item_rows.order_id = page_order.id
      ), '[]'::jsonb),
      'total', filtered_summary.total,
      'counts', jsonb_build_object(
        'pending', base_summary.pending,
        'confirmed', base_summary.confirmed,
        'cancelled', base_summary.cancelled,
        'expired', 0,
        'all', base_summary.total
      )
    ) from base_summary cross join filtered_summary
  );
end;
$$;

revoke all on function public.get_offline_event_orders(
  uuid, integer, integer, text, timestamptz, timestamptz, uuid
) from public, anon, authenticated;
grant execute on function public.get_offline_event_orders(
  uuid, integer, integer, text, timestamptz, timestamptz, uuid
) to authenticated;

notify pgrst, 'reload schema';
