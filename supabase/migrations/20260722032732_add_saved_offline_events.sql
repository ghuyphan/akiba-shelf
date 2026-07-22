-- Treat an offline event as a saved business record before a device reserves
-- stock. Draft allocations are plans; activation performs the authoritative
-- product locks and stock deduction in one transaction.

alter table public.offline_event_sessions
  drop constraint offline_event_sessions_status_check,
  alter column device_id drop not null,
  add column scheduled_start_at timestamptz,
  add column scheduled_end_at timestamptz,
  add column started_at timestamptz,
  add constraint offline_event_sessions_status_check
    check (status in ('draft', 'active', 'closed')),
  add constraint offline_event_sessions_schedule_check
    check (
      scheduled_start_at is null
      or scheduled_end_at is null
      or scheduled_end_at > scheduled_start_at
    ),
  add constraint offline_event_sessions_device_state_check
    check (
      (status = 'draft' and device_id is null)
      or (status in ('active', 'closed') and device_id is not null)
    );

update public.offline_event_sessions
set scheduled_start_at = created_at,
    scheduled_end_at = closed_at,
    started_at = created_at
where status in ('active', 'closed');

drop index public.offline_event_orders_session_created_idx;
create index offline_event_orders_session_created_idx
  on public.offline_event_orders (session_id, created_at desc, id desc);
create index offline_event_sessions_shop_schedule_idx
  on public.offline_event_sessions (
    shop_id,
    scheduled_start_at desc nulls last,
    created_at desc,
    id desc
  );

create function private.offline_event_bundle(p_session_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'session', jsonb_build_object(
      'id', event_session.id,
      'shop_id', event_session.shop_id,
      'device_id', event_session.device_id,
      'name', event_session.name,
      'status', event_session.status,
      'scheduled_start_at', event_session.scheduled_start_at,
      'scheduled_end_at', event_session.scheduled_end_at,
      'started_at', event_session.started_at,
      'closed_at', event_session.closed_at,
      'payment_snapshot', event_session.payment_snapshot,
      'promotion_snapshot', event_session.promotion_snapshot,
      'created_at', event_session.created_at,
      'updated_at', event_session.updated_at
    ),
    'allocations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'product_id', allocation.product_id,
        'quantity_allocated', allocation.quantity_allocated,
        'quantity_sold', allocation.quantity_sold,
        'product_snapshot', private.sanitize_offline_product_snapshot(
          allocation.product_snapshot
        )
      ) order by allocation.product_id)
      from public.offline_event_allocations allocation
      where allocation.session_id = event_session.id
    ), '[]'::jsonb)
  )
  from public.offline_event_sessions event_session
  where event_session.id = p_session_id;
$$;

create function public.save_offline_event_draft(
  p_shop_id uuid,
  p_session_id uuid,
  p_name text,
  p_scheduled_start_at timestamptz,
  p_scheduled_end_at timestamptz,
  p_allocations jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_session public.offline_event_sessions;
  requested_count integer;
begin
  if auth.uid() is null
    or not private.has_shop_role(p_shop_id, array['owner', 'admin']) then
    raise exception 'Active shop owner or admin access required'
      using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_name, ''))) not between 1 and 80 then
    raise exception 'Event name must be between 1 and 80 characters';
  end if;
  if p_scheduled_start_at is null or p_scheduled_end_at is null
    or p_scheduled_end_at <= p_scheduled_start_at then
    raise exception 'Choose a valid event start and end time';
  end if;
  if jsonb_typeof(p_allocations) <> 'array'
    or jsonb_array_length(p_allocations) not between 1 and 200 then
    raise exception 'Choose between 1 and 200 allocated products';
  end if;

  select count(*)::integer into requested_count
  from jsonb_to_recordset(p_allocations) item(product_id text, quantity integer);
  if requested_count <> (
    select count(distinct item.product_id)::integer
    from jsonb_to_recordset(p_allocations) item(product_id text, quantity integer)
  ) then
    raise exception 'Each product may only be allocated once';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(p_allocations) item(product_id text, quantity integer)
    left join public.products product
      on product.shop_id = p_shop_id and product.id = item.product_id
    where product.id is null or not product.active or item.quantity is null
      or item.quantity <= 0 or item.quantity > product.quantity_available
  ) then
    raise exception 'One or more planned allocations are invalid or exceed current stock';
  end if;

  if p_session_id is null then
    insert into public.offline_event_sessions(
      shop_id,
      device_id,
      name,
      status,
      scheduled_start_at,
      scheduled_end_at,
      payment_snapshot,
      promotion_snapshot,
      created_by
    ) values (
      p_shop_id,
      null,
      btrim(p_name),
      'draft',
      p_scheduled_start_at,
      p_scheduled_end_at,
      '{}'::jsonb,
      '{}'::jsonb,
      auth.uid()
    ) returning * into event_session;
  else
    select * into event_session
    from public.offline_event_sessions
    where id = p_session_id and shop_id = p_shop_id
    for update;
    if event_session.id is null then raise exception 'Offline event draft not found'; end if;
    if event_session.status <> 'draft' then
      raise exception 'Only draft events can be edited';
    end if;
    update public.offline_event_sessions
    set name = btrim(p_name),
        scheduled_start_at = p_scheduled_start_at,
        scheduled_end_at = p_scheduled_end_at
    where id = event_session.id
    returning * into event_session;
    delete from public.offline_event_allocations
    where session_id = event_session.id;
  end if;

  insert into public.offline_event_allocations(
    session_id,
    shop_id,
    product_id,
    quantity_allocated,
    quantity_sold,
    product_snapshot
  )
  select event_session.id,
    p_shop_id,
    product.id,
    item.quantity,
    0,
    private.offline_product_snapshot(product)
  from jsonb_to_recordset(p_allocations) item(product_id text, quantity integer)
  join public.products product
    on product.shop_id = p_shop_id and product.id = item.product_id;

  return private.offline_event_bundle(event_session.id);
end;
$$;

create function public.activate_offline_event_session(
  p_session_id uuid,
  p_device_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_session public.offline_event_sessions;
  product_row record;
  authoritative_payment jsonb;
  authoritative_promotion jsonb;
begin
  if p_device_id is null then raise exception 'A device identifier is required'; end if;

  select * into event_session
  from public.offline_event_sessions
  where id = p_session_id
  for update;
  if event_session.id is null then raise exception 'Offline event draft not found'; end if;
  if auth.uid() is null
    or not private.has_shop_role(event_session.shop_id, array['owner', 'admin']) then
    raise exception 'Active shop owner or admin access required'
      using errcode = '42501';
  end if;
  if event_session.status <> 'draft' then
    raise exception 'Only draft events can be activated';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('offline-event:' || event_session.shop_id::text, 0)
  );
  if exists (
    select 1
    from public.offline_event_sessions active_session
    where active_session.shop_id = event_session.shop_id
      and active_session.status = 'active'
  ) then
    raise exception 'This shop already has an active offline event';
  end if;

  perform product.id
  from public.products product
  join public.offline_event_allocations allocation
    on allocation.shop_id = product.shop_id
    and allocation.product_id = product.id
  where allocation.session_id = event_session.id
  order by product.id
  for update of product;

  if not exists (
    select 1 from public.offline_event_allocations allocation
    where allocation.session_id = event_session.id
  ) or exists (
    select 1
    from public.offline_event_allocations allocation
    left join public.products product
      on product.shop_id = allocation.shop_id
      and product.id = allocation.product_id
    where allocation.session_id = event_session.id
      and (
        product.id is null
        or not product.active
        or allocation.quantity_allocated > product.quantity_available
      )
  ) then
    raise exception 'Planned event stock is no longer available';
  end if;

  select jsonb_build_object(
    'id', payment.id,
    'shop_id', payment.shop_id,
    'momo_qr_url', payment.momo_qr_url,
    'bank_qr_url', payment.bank_qr_url,
    'momo_label', payment.momo_label,
    'bank_label', payment.bank_label,
    'bank_code', payment.bank_code,
    'bank_acq_id', payment.bank_acq_id,
    'bank_account_no', payment.bank_account_no,
    'bank_account_name', payment.bank_account_name,
    'bank_add_info_template', payment.bank_add_info_template,
    'payment_instructions', payment.payment_instructions
  ) into authoritative_payment
  from public.payment_settings payment
  where payment.shop_id = event_session.shop_id;
  if authoritative_payment is null then raise exception 'Shop payment settings are missing'; end if;

  select jsonb_build_object(
    'shop_id', event_session.shop_id,
    'enabled', coalesce(promotion.enabled, false),
    'buy_quantity', coalesce(promotion.buy_quantity, 3),
    'free_quantity', coalesce(promotion.free_quantity, 1),
    'repeatable', coalesce(promotion.repeatable, true),
    'qualifying_product_ids', coalesce((
      select jsonb_agg(mapping.product_id order by mapping.product_id)
      from public.promotion_products mapping
      where mapping.shop_id = event_session.shop_id
        and mapping.role in ('qualifying', 'both')
    ), '[]'::jsonb),
    'reward_product_ids', coalesce((
      select jsonb_agg(mapping.product_id order by mapping.product_id)
      from public.promotion_products mapping
      where mapping.shop_id = event_session.shop_id
        and mapping.role in ('reward', 'both')
    ), '[]'::jsonb)
  ) into authoritative_promotion
  from (select 1) seed
  left join public.promotions promotion
    on promotion.shop_id = event_session.shop_id;

  update public.offline_event_allocations allocation
  set product_snapshot = private.offline_product_snapshot(product)
  from public.products product
  where allocation.session_id = event_session.id
    and product.shop_id = allocation.shop_id
    and product.id = allocation.product_id;

  for product_row in
    update public.products product
    set quantity_available = product.quantity_available - allocation.quantity_allocated
    from public.offline_event_allocations allocation
    where allocation.session_id = event_session.id
      and product.shop_id = allocation.shop_id
      and product.id = allocation.product_id
    returning product.id
  loop
    perform private.sync_product_stock(product_row.id);
  end loop;

  update public.offline_event_sessions
  set device_id = p_device_id,
      status = 'active',
      started_at = now(),
      payment_snapshot = authoritative_payment,
      promotion_snapshot = authoritative_promotion
  where id = event_session.id;

  return private.offline_event_bundle(event_session.id);
end;
$$;

create function public.list_offline_events(
  p_shop_id uuid,
  p_limit integer default 50
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
  if p_limit not between 1 and 100 then raise exception 'Invalid event limit'; end if;

  return coalesce((
    select jsonb_agg(summary.payload order by summary.sort_at desc, summary.id desc)
    from (
      select event_session.id,
        coalesce(event_session.scheduled_start_at, event_session.created_at) sort_at,
        jsonb_build_object(
          'id', event_session.id,
          'shop_id', event_session.shop_id,
          'name', event_session.name,
          'status', event_session.status,
          'scheduled_start_at', event_session.scheduled_start_at,
          'scheduled_end_at', event_session.scheduled_end_at,
          'started_at', event_session.started_at,
          'closed_at', event_session.closed_at,
          'created_at', event_session.created_at,
          'updated_at', event_session.updated_at,
          'product_count', coalesce((
            select count(*) from public.offline_event_allocations allocation
            where allocation.session_id = event_session.id
          ), 0),
          'quantity_allocated', coalesce((
            select sum(allocation.quantity_allocated)
            from public.offline_event_allocations allocation
            where allocation.session_id = event_session.id
          ), 0),
          'quantity_sold', coalesce((
            select sum(allocation.quantity_sold)
            from public.offline_event_allocations allocation
            where allocation.session_id = event_session.id
          ), 0),
          'order_count', coalesce((
            select count(*) from public.offline_event_orders event_order
            where event_order.session_id = event_session.id
          ), 0),
          'order_total', coalesce((
            select sum(event_order.total_amount)
            from public.offline_event_orders event_order
            where event_order.session_id = event_session.id
              and event_order.status = 'confirmed'
          ), 0)
        ) payload
      from public.offline_event_sessions event_session
      where event_session.shop_id = p_shop_id
      order by sort_at desc, event_session.id desc
      limit p_limit
    ) summary
  ), '[]'::jsonb);
end;
$$;

create function public.get_offline_event_draft(
  p_shop_id uuid,
  p_session_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
    or not private.has_shop_role(p_shop_id, array['owner', 'admin']) then
    raise exception 'Active shop owner or admin access required'
      using errcode = '42501';
  end if;
  if not exists (
    select 1
    from public.offline_event_sessions event_session
    where event_session.id = p_session_id
      and event_session.shop_id = p_shop_id
      and event_session.status = 'draft'
  ) then
    raise exception 'Offline event draft not found';
  end if;
  return private.offline_event_bundle(p_session_id);
end;
$$;

create or replace function public.get_active_offline_event_session(
  p_shop_id uuid,
  p_device_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare event_session_id uuid;
begin
  if auth.uid() is null or not private.is_shop_member(p_shop_id) then
    raise exception 'Active shop access required' using errcode = '42501';
  end if;
  select id into event_session_id
  from public.offline_event_sessions
  where shop_id = p_shop_id and device_id = p_device_id and status = 'active';
  if event_session_id is null then return null; end if;
  return private.offline_event_bundle(event_session_id);
end;
$$;

drop function public.get_offline_event_orders(
  uuid,
  integer,
  integer,
  text,
  timestamptz,
  timestamptz
);

create function public.get_offline_event_orders(
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
    with base as (
      select event_order.*
      from public.offline_event_orders event_order
      where event_order.shop_id = p_shop_id
        and (p_session_id is null or event_order.session_id = p_session_id)
        and (p_created_after is null or event_order.created_at >= p_created_after)
        and (p_created_before is null or event_order.created_at < p_created_before)
    ), filtered as (
      select * from base where p_status = 'all' or status = p_status
    ), page_rows as (
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
        'confirmed_at', event_order.confirmed_at,
        'cancelled_at', event_order.cancelled_at,
        'expired_at', null,
        'fulfillment_status', event_order.fulfillment_status,
        'fulfillment_updated_at', event_order.fulfillment_updated_at,
        'confirmed_by_email', event_order.confirmed_by_label,
        'cancelled_by_email', event_order.cancelled_by_label,
        'fulfillment_updated_by_email', event_order.fulfillment_updated_by_label,
        'source', 'offline_event',
        'offline_event_session_id', event_order.session_id,
        'offline_event_name', event_session.name,
        'payment_method', event_order.payment_method,
        'payment_state', event_order.payment_state,
        'order_items', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', item.order_id::text || ':' || item.product_id,
            'order_id', item.order_id,
            'product_id', item.product_id,
            'quantity', item.quantity,
            'unit_price', item.unit_price,
            'free_quantity', 0,
            'discount_amount', item.discount_amount,
            'product', jsonb_build_object(
              'id', item.product_id,
              'name', coalesce(
                allocation.product_snapshot ->> 'name',
                item.product_id
              ),
              'item_code', coalesce(
                allocation.product_snapshot ->> 'item_code',
                ''
              ),
              'images', case
                when jsonb_typeof(allocation.product_snapshot -> 'images') = 'array'
                  then allocation.product_snapshot -> 'images'
                else '[]'::jsonb
              end
            )
          ) order by item.product_id)
          from public.offline_event_order_items item
          left join public.offline_event_allocations allocation
            on allocation.session_id = item.session_id
            and allocation.product_id = item.product_id
          where item.order_id = event_order.id
        ), '[]'::jsonb)
      ) payload,
      event_order.created_at sort_created_at,
      event_order.id sort_id
      from filtered event_order
      join public.offline_event_sessions event_session
        on event_session.id = event_order.session_id
      order by event_order.created_at desc, event_order.id desc
      limit p_page_size offset (p_page - 1) * p_page_size
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

revoke all on function private.offline_event_bundle(uuid)
from public, anon, authenticated;
revoke all on function public.save_offline_event_draft(
  uuid,
  uuid,
  text,
  timestamptz,
  timestamptz,
  jsonb
), public.activate_offline_event_session(uuid, uuid),
  public.list_offline_events(uuid, integer),
  public.get_offline_event_draft(uuid, uuid),
  public.get_offline_event_orders(
    uuid,
    integer,
    integer,
    text,
    timestamptz,
    timestamptz,
    uuid
  )
from public, anon;
grant execute on function public.save_offline_event_draft(
  uuid,
  uuid,
  text,
  timestamptz,
  timestamptz,
  jsonb
), public.activate_offline_event_session(uuid, uuid),
  public.list_offline_events(uuid, integer),
  public.get_offline_event_draft(uuid, uuid),
  public.get_offline_event_orders(
    uuid,
    integer,
    integer,
    text,
    timestamptz,
    timestamptz,
    uuid
  )
to authenticated;

notify pgrst, 'reload schema';
