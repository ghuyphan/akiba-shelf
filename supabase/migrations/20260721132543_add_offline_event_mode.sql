-- Convention-safe offline sales. A staff device receives an explicit stock
-- allocation while online, then acts as the only writer for that allocation
-- until its append-only local ledger is synchronized and the event is closed.

create table public.offline_event_sessions (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  device_id uuid not null,
  name text not null check (length(btrim(name)) between 1 and 80),
  status text not null default 'active' check (status in ('active', 'closed')),
  payment_snapshot jsonb not null default '{}'::jsonb
    check (jsonb_typeof(payment_snapshot) = 'object'),
  promotion_snapshot jsonb not null default '{}'::jsonb
    check (jsonb_typeof(promotion_snapshot) = 'object'),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  unique (id, shop_id),
  unique (id, device_id)
);

create unique index offline_event_sessions_one_active_shop_idx
  on public.offline_event_sessions (shop_id)
  where status = 'active';
create index offline_event_sessions_shop_created_idx
  on public.offline_event_sessions (shop_id, created_at desc);

create table public.offline_event_allocations (
  session_id uuid not null references public.offline_event_sessions(id) on delete cascade,
  shop_id uuid not null,
  product_id text not null,
  quantity_allocated integer not null check (quantity_allocated > 0),
  quantity_sold integer not null default 0
    check (quantity_sold >= 0 and quantity_sold <= quantity_allocated),
  product_snapshot jsonb not null check (jsonb_typeof(product_snapshot) = 'object'),
  primary key (session_id, product_id),
  foreign key (session_id, shop_id)
    references public.offline_event_sessions(id, shop_id) on delete cascade,
  foreign key (shop_id, product_id)
    references public.products(shop_id, id)
);

create index offline_event_allocations_shop_product_idx
  on public.offline_event_allocations (shop_id, product_id);

create table public.offline_event_orders (
  id uuid primary key,
  session_id uuid not null references public.offline_event_sessions(id) on delete cascade,
  shop_id uuid not null,
  order_code text not null check (length(order_code) between 4 and 32),
  customer_name text check (customer_name is null or length(customer_name) <= 30),
  total_amount integer not null check (total_amount >= 0),
  status text not null check (status in ('pending', 'confirmed', 'cancelled')),
  payment_method text not null check (payment_method in ('cash', 'vietqr')),
  payment_state text not null check (
    payment_state in ('awaiting_payment', 'cash_confirmed', 'bank_verification_pending', 'bank_confirmed')
  ),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  synced_at timestamptz not null default now(),
  unique (session_id, order_code),
  foreign key (session_id, shop_id)
    references public.offline_event_sessions(id, shop_id) on delete cascade
);

create index offline_event_orders_session_created_idx
  on public.offline_event_orders (session_id, created_at desc);

create table public.offline_event_order_items (
  order_id uuid not null references public.offline_event_orders(id) on delete cascade,
  session_id uuid not null,
  shop_id uuid not null,
  product_id text not null,
  quantity integer not null check (quantity > 0),
  unit_price integer not null check (unit_price >= 0),
  discount_amount integer not null default 0 check (discount_amount >= 0),
  primary key (order_id, product_id),
  foreign key (session_id, product_id)
    references public.offline_event_allocations(session_id, product_id),
  foreign key (session_id, shop_id)
    references public.offline_event_sessions(id, shop_id) on delete cascade
);

create index offline_event_order_items_session_idx
  on public.offline_event_order_items (session_id, order_id);

alter table public.offline_event_sessions enable row level security;
alter table public.offline_event_allocations enable row level security;
alter table public.offline_event_orders enable row level security;
alter table public.offline_event_order_items enable row level security;

revoke all on public.offline_event_sessions,
  public.offline_event_allocations,
  public.offline_event_orders,
  public.offline_event_order_items
from public, anon, authenticated;

drop trigger if exists offline_event_sessions_set_updated_at
  on public.offline_event_sessions;
create trigger offline_event_sessions_set_updated_at
  before update on public.offline_event_sessions
  for each row execute function public.set_updated_at();

create function public.start_offline_event_session(
  p_shop_id uuid,
  p_device_id uuid,
  p_name text,
  p_allocations jsonb,
  p_payment_snapshot jsonb,
  p_promotion_snapshot jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_session public.offline_event_sessions;
  requested_count integer;
  product_row record;
begin
  if auth.uid() is null
    or not private.has_shop_role(p_shop_id, array['owner', 'admin']) then
    raise exception 'Active shop owner or admin access required' using errcode = '42501';
  end if;
  if p_device_id is null then
    raise exception 'A device identifier is required';
  end if;
  if length(btrim(coalesce(p_name, ''))) not between 1 and 80 then
    raise exception 'Event name must be between 1 and 80 characters';
  end if;
  if jsonb_typeof(p_allocations) <> 'array'
    or jsonb_array_length(p_allocations) not between 1 and 200 then
    raise exception 'Choose between 1 and 200 allocated products';
  end if;
  if jsonb_typeof(p_payment_snapshot) <> 'object'
    or jsonb_typeof(p_promotion_snapshot) <> 'object' then
    raise exception 'Offline checkout settings are invalid';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('offline-event:' || p_shop_id::text, 0));
  if exists (
    select 1 from public.offline_event_sessions
    where shop_id = p_shop_id and status = 'active'
  ) then
    raise exception 'This shop already has an active offline event';
  end if;

  select count(*)::integer into requested_count
  from jsonb_to_recordset(p_allocations) as item(product_id text, quantity integer);
  if requested_count <> (
    select count(distinct item.product_id)::integer
    from jsonb_to_recordset(p_allocations) as item(product_id text, quantity integer)
  ) then
    raise exception 'Each product may only be allocated once';
  end if;

  perform 1
  from public.products product
  join jsonb_to_recordset(p_allocations) as item(product_id text, quantity integer)
    on item.product_id = product.id
  where product.shop_id = p_shop_id
  for update of product;

  if exists (
    select 1
    from jsonb_to_recordset(p_allocations) as item(product_id text, quantity integer)
    left join public.products product
      on product.shop_id = p_shop_id and product.id = item.product_id
    where product.id is null
      or not product.active
      or item.quantity is null
      or item.quantity <= 0
      or item.quantity > product.quantity_available
  ) then
    raise exception 'One or more offline allocations are invalid or exceed current stock';
  end if;

  insert into public.offline_event_sessions(
    shop_id, device_id, name, payment_snapshot, promotion_snapshot, created_by
  ) values (
    p_shop_id,
    p_device_id,
    btrim(p_name),
    p_payment_snapshot,
    p_promotion_snapshot,
    auth.uid()
  ) returning * into event_session;

  insert into public.offline_event_allocations(
    session_id, shop_id, product_id, quantity_allocated, product_snapshot
  )
  select
    event_session.id,
    p_shop_id,
    product.id,
    item.quantity,
    to_jsonb(product)
  from jsonb_to_recordset(p_allocations) as item(product_id text, quantity integer)
  join public.products product
    on product.shop_id = p_shop_id and product.id = item.product_id;

  for product_row in
    update public.products product
    set quantity_available = product.quantity_available - item.quantity
    from jsonb_to_recordset(p_allocations) as item(product_id text, quantity integer)
    where product.shop_id = p_shop_id and product.id = item.product_id
    returning product.id
  loop
    perform private.sync_product_stock(product_row.id);
  end loop;

  return jsonb_build_object(
    'session', to_jsonb(event_session),
    'allocations', (
      select coalesce(jsonb_agg(to_jsonb(allocation) order by allocation.product_id), '[]'::jsonb)
      from public.offline_event_allocations allocation
      where allocation.session_id = event_session.id
    )
  );
end;
$$;

create function public.get_active_offline_event_session(
  p_shop_id uuid,
  p_device_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_session public.offline_event_sessions;
begin
  if auth.uid() is null or not private.is_shop_member(p_shop_id) then
    raise exception 'Active shop access required' using errcode = '42501';
  end if;
  select * into event_session
  from public.offline_event_sessions
  where shop_id = p_shop_id and device_id = p_device_id and status = 'active';
  if event_session.id is null then return null; end if;
  return jsonb_build_object(
    'session', to_jsonb(event_session),
    'allocations', (
      select coalesce(jsonb_agg(to_jsonb(allocation) order by allocation.product_id), '[]'::jsonb)
      from public.offline_event_allocations allocation
      where allocation.session_id = event_session.id
    )
  );
end;
$$;

create function public.sync_offline_event_orders(
  p_session_id uuid,
  p_device_id uuid,
  p_orders jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_session public.offline_event_sessions;
  order_payload jsonb;
  item_payload jsonb;
  existing_order public.offline_event_orders;
  v_order_id uuid;
  order_status text;
  item_quantity integer;
  inserted_count integer := 0;
  updated_count integer := 0;
begin
  select * into event_session
  from public.offline_event_sessions
  where id = p_session_id and device_id = p_device_id
  for update;
  if event_session.id is null then raise exception 'Offline event not found'; end if;
  if auth.uid() is null or not private.is_shop_member(event_session.shop_id) then
    raise exception 'Active shop access required' using errcode = '42501';
  end if;
  if event_session.status <> 'active' then raise exception 'Offline event is closed'; end if;
  if jsonb_typeof(p_orders) <> 'array' or jsonb_array_length(p_orders) > 500 then
    raise exception 'Offline order batch is invalid';
  end if;

  for order_payload in select value from jsonb_array_elements(p_orders)
  loop
    if jsonb_typeof(order_payload) <> 'object'
      or jsonb_typeof(order_payload -> 'items') <> 'array'
      or jsonb_array_length(order_payload -> 'items') not between 1 and 100 then
      raise exception 'Offline order payload is invalid';
    end if;
    v_order_id := (order_payload ->> 'id')::uuid;
    order_status := order_payload ->> 'status';
    if order_status not in ('pending', 'confirmed', 'cancelled')
      or (order_payload ->> 'payment_method') not in ('cash', 'vietqr')
      or (order_payload ->> 'payment_state') not in (
        'awaiting_payment', 'cash_confirmed', 'bank_verification_pending', 'bank_confirmed'
      )
      or (order_payload ->> 'total_amount')::integer < 0
      or length(coalesce(order_payload ->> 'order_code', '')) not between 4 and 32
      or length(coalesce(order_payload ->> 'customer_name', '')) > 30 then
      raise exception 'Offline order fields are invalid';
    end if;

    select * into existing_order
    from public.offline_event_orders
    where id = v_order_id and session_id = p_session_id
    for update;

    if existing_order.id is null then
      if order_status <> 'cancelled' then
        for item_payload in select value from jsonb_array_elements(order_payload -> 'items')
        loop
          item_quantity := (item_payload ->> 'quantity')::integer;
          if item_quantity <= 0 then raise exception 'Offline order quantity is invalid'; end if;
          update public.offline_event_allocations allocation
          set quantity_sold = allocation.quantity_sold + item_quantity
          where allocation.session_id = p_session_id
            and allocation.product_id = item_payload ->> 'product_id'
            and allocation.quantity_allocated - allocation.quantity_sold >= item_quantity;
          if not found then raise exception 'Offline event allocation exceeded'; end if;
        end loop;
      end if;

      insert into public.offline_event_orders(
        id, session_id, shop_id, order_code, customer_name, total_amount,
        status, payment_method, payment_state, created_at, updated_at
      ) values (
        v_order_id,
        p_session_id,
        event_session.shop_id,
        order_payload ->> 'order_code',
        nullif(btrim(order_payload ->> 'customer_name'), ''),
        (order_payload ->> 'total_amount')::integer,
        order_status,
        order_payload ->> 'payment_method',
        order_payload ->> 'payment_state',
        (order_payload ->> 'created_at')::timestamptz,
        (order_payload ->> 'updated_at')::timestamptz
      );
      insert into public.offline_event_order_items(
        order_id, session_id, shop_id, product_id, quantity, unit_price, discount_amount
      )
      select
        v_order_id,
        p_session_id,
        event_session.shop_id,
        item ->> 'product_id',
        (item ->> 'quantity')::integer,
        (item ->> 'unit_price')::integer,
        coalesce((item ->> 'discount_amount')::integer, 0)
      from jsonb_array_elements(order_payload -> 'items') item;
      inserted_count := inserted_count + 1;
    else
      if existing_order.status = 'confirmed' and order_status <> 'confirmed' then
        raise exception 'Confirmed offline orders are immutable';
      end if;
      if existing_order.status <> 'cancelled' and order_status = 'cancelled' then
        update public.offline_event_allocations allocation
        set quantity_sold = allocation.quantity_sold - item.quantity
        from public.offline_event_order_items item
        where item.order_id = existing_order.id
          and allocation.session_id = item.session_id
          and allocation.product_id = item.product_id;
      elsif existing_order.status = 'cancelled' and order_status <> 'cancelled' then
        raise exception 'Cancelled offline orders cannot be reopened';
      end if;
      update public.offline_event_orders
      set status = order_status,
          payment_state = order_payload ->> 'payment_state',
          updated_at = (order_payload ->> 'updated_at')::timestamptz,
          synced_at = now()
      where id = existing_order.id;
      updated_count := updated_count + 1;
    end if;
  end loop;

  return jsonb_build_object('inserted', inserted_count, 'updated', updated_count);
end;
$$;

create function public.close_offline_event_session(
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
  allocation record;
begin
  select * into event_session
  from public.offline_event_sessions
  where id = p_session_id and device_id = p_device_id
  for update;
  if event_session.id is null then raise exception 'Offline event not found'; end if;
  if auth.uid() is null
    or not private.has_shop_role(event_session.shop_id, array['owner', 'admin']) then
    raise exception 'Active shop owner or admin access required' using errcode = '42501';
  end if;
  if event_session.status <> 'active' then
    return jsonb_build_object('status', event_session.status);
  end if;
  if exists (
    select 1 from public.offline_event_orders
    where session_id = event_session.id and status = 'pending'
  ) then
    raise exception 'Resolve pending offline payments before closing the event';
  end if;

  for allocation in
    select product_id, quantity_allocated - quantity_sold as quantity_unused
    from public.offline_event_allocations
    where session_id = event_session.id
    for update
  loop
    if allocation.quantity_unused > 0 then
      update public.products
      set quantity_available = quantity_available + allocation.quantity_unused
      where shop_id = event_session.shop_id and id = allocation.product_id;
      perform private.sync_product_stock(allocation.product_id);
    end if;
  end loop;

  update public.offline_event_sessions
  set status = 'closed', closed_at = now()
  where id = event_session.id;
  return jsonb_build_object('status', 'closed');
end;
$$;

revoke all on function public.start_offline_event_session(uuid, uuid, text, jsonb, jsonb, jsonb),
  public.get_active_offline_event_session(uuid, uuid),
  public.sync_offline_event_orders(uuid, uuid, jsonb),
  public.close_offline_event_session(uuid, uuid)
from public, anon, authenticated;

grant execute on function public.start_offline_event_session(uuid, uuid, text, jsonb, jsonb, jsonb),
  public.get_active_offline_event_session(uuid, uuid),
  public.sync_offline_event_orders(uuid, uuid, jsonb),
  public.close_offline_event_session(uuid, uuid)
to authenticated;

grant select, insert, update, delete on public.offline_event_sessions,
  public.offline_event_allocations,
  public.offline_event_orders,
  public.offline_event_order_items
to service_role;
