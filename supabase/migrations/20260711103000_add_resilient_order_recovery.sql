alter table public.orders
  add column if not exists client_request_id uuid,
  add column if not exists recovery_token_hash text;

create unique index if not exists orders_client_request_id_key
  on public.orders (client_request_id)
  where client_request_id is not null;

revoke all on function public.create_order(text, jsonb) from public, anon, authenticated;
drop function if exists public.create_order(text, jsonb);

create or replace function public.create_order(
  p_customer_name text,
  p_items jsonb,
  p_client_request_id uuid,
  p_recovery_token text
)
returns table (
  id uuid,
  order_code text,
  customer_name text,
  total_amount integer,
  status public.order_status,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_order public.orders;
  existing_order public.orders;
  order_total integer;
  token_hash text;
begin
  if p_client_request_id is null then
    raise exception 'A client request id is required';
  end if;

  if p_recovery_token is null or length(p_recovery_token) < 32 then
    raise exception 'A recovery token is required';
  end if;

  token_hash := encode(extensions.digest(p_recovery_token, 'sha256'), 'hex');

  -- Serialize retries for this request id so a lost response can never create
  -- a second order, even when two retry calls arrive at the same time.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_client_request_id::text, 0)
  );

  select orders.* into existing_order
  from public.orders as orders
  where orders.client_request_id = p_client_request_id;

  if found then
    if existing_order.recovery_token_hash is distinct from token_hash then
      raise exception 'This request id belongs to another checkout';
    end if;

    return query select
      existing_order.id,
      existing_order.order_code,
      existing_order.customer_name,
      existing_order.total_amount,
      existing_order.status,
      existing_order.created_at,
      existing_order.updated_at;
    return;
  end if;

  if jsonb_typeof(p_items) is distinct from 'array'
    or jsonb_array_length(p_items) = 0
    or jsonb_array_length(p_items) > 50 then
    raise exception 'Cart must contain between 1 and 50 items';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_items) as requested(product_id text, quantity integer)
    where requested.product_id is null or requested.quantity is null or requested.quantity <= 0
  ) then
    raise exception 'Cart contains an invalid item';
  end if;

  perform product.id
  from public.products as product
  where exists (
    select 1
    from jsonb_to_recordset(p_items) as requested(product_id text, quantity integer)
    where requested.product_id = product.id
  )
  order by product.id
  for update of product;

  if exists (
    select 1
    from (
      select requested.product_id, sum(requested.quantity)::integer as quantity
      from jsonb_to_recordset(p_items) as requested(product_id text, quantity integer)
      group by requested.product_id
    ) as requested
    left join public.products as product on product.id = requested.product_id
    where product.id is null
      or not product.active
      or product.stock_status = 'sold_out'
      or product.quantity_available < requested.quantity
  ) then
    raise exception 'One or more items are sold out or no longer have enough stock';
  end if;

  select sum(product.price_vnd * requested.quantity)::integer
  into order_total
  from (
    select item.product_id, sum(item.quantity)::integer as quantity
    from jsonb_to_recordset(p_items) as item(product_id text, quantity integer)
    group by item.product_id
  ) as requested
  join public.products as product on product.id = requested.product_id;

  insert into public.orders (
    customer_name,
    total_amount,
    status,
    client_request_id,
    recovery_token_hash
  )
  values (
    nullif(btrim(left(p_customer_name, 30)), ''),
    order_total,
    'pending',
    p_client_request_id,
    token_hash
  )
  returning * into created_order;

  insert into public.order_items (order_id, product_id, quantity, unit_price)
  select created_order.id, product.id, requested.quantity, product.price_vnd
  from (
    select item.product_id, sum(item.quantity)::integer as quantity
    from jsonb_to_recordset(p_items) as item(product_id text, quantity integer)
    group by item.product_id
  ) as requested
  join public.products as product on product.id = requested.product_id;

  return query select
    created_order.id,
    created_order.order_code,
    created_order.customer_name,
    created_order.total_amount,
    created_order.status,
    created_order.created_at,
    created_order.updated_at;
end;
$$;

create or replace function public.get_customer_order(
  p_order_id uuid,
  p_recovery_token text
)
returns table (
  id uuid,
  order_code text,
  customer_name text,
  total_amount integer,
  status public.order_status,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    orders.id,
    orders.order_code,
    orders.customer_name,
    orders.total_amount,
    orders.status,
    orders.created_at,
    orders.updated_at
  from public.orders as orders
  where orders.id = p_order_id
    and orders.recovery_token_hash = encode(extensions.digest(p_recovery_token, 'sha256'), 'hex')
  limit 1;
$$;

drop policy if exists "Anyone can read specific orders" on public.orders;
drop policy if exists "Anyone can read order items" on public.order_items;
revoke select, insert on public.orders, public.order_items from anon;

revoke all on function public.create_order(text, jsonb, uuid, text) from public;
revoke all on function public.get_customer_order(uuid, text) from public;
grant execute on function public.create_order(text, jsonb, uuid, text) to anon, authenticated;
grant execute on function public.get_customer_order(uuid, text) to anon, authenticated;
