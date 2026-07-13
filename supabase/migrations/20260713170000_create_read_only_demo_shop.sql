-- Create a storefront-only demo tenant that always mirrors Arigato-san's
-- public catalog and design. The source data remains owned by Arigato-san;
-- demo visitors cannot create orders or load its payment details.

alter table public.shops
  add column accepting_orders boolean not null default true,
  add column catalog_source_shop_id uuid references public.shops(id) on delete cascade;

alter table public.shops
  add constraint shops_catalog_source_not_self
  check (catalog_source_shop_id is null or catalog_source_shop_id <> id);

create index shops_catalog_source_shop_id_idx
  on public.shops(catalog_source_shop_id)
  where catalog_source_shop_id is not null;

-- Keep the demo tenant present and pointed at Arigato-san even when a fresh
-- installation creates that shop after this migration has been applied.
create or replace function private.sync_arigatosan_demo_shop()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.slug <> 'arigatosan' then
    return new;
  end if;

  insert into public.shops(
    id,
    name,
    slug,
    created_by,
    active,
    accepting_orders,
    catalog_source_shop_id
  )
  values (
    '00000000-0000-4000-8000-000000000002',
    'demo-booth',
    'demo-booth',
    new.created_by,
    new.active,
    false,
    new.id
  )
  on conflict (slug) do update
  set name = excluded.name,
      created_by = excluded.created_by,
      active = excluded.active,
      accepting_orders = false,
      catalog_source_shop_id = excluded.catalog_source_shop_id,
      updated_at = now();

  return new;
end;
$$;

revoke all on function private.sync_arigatosan_demo_shop() from public, anon, authenticated;

drop trigger if exists shops_sync_arigatosan_demo on public.shops;
create trigger shops_sync_arigatosan_demo
  after insert or update of slug, created_by, active
  on public.shops
  for each row
  execute function private.sync_arigatosan_demo_shop();

-- Seed or refresh the demo immediately when Arigato-san already exists.
insert into public.shops(
  id,
  name,
  slug,
  created_by,
  active,
  accepting_orders,
  catalog_source_shop_id
)
select
  '00000000-0000-4000-8000-000000000002',
  'demo-booth',
  'demo-booth',
  source.created_by,
  source.active,
  false,
  source.id
from public.shops source
where source.slug = 'arigatosan'
on conflict (slug) do update
set name = excluded.name,
    created_by = excluded.created_by,
    active = excluded.active,
    accepting_orders = false,
    catalog_source_shop_id = excluded.catalog_source_shop_id,
    updated_at = now();

-- These are public-safe operational fields used to select the mirrored
-- catalog and hide checkout. Existing RLS still limits reads to active shops.
grant select(
  id,
  name,
  slug,
  active,
  accepting_orders,
  catalog_source_shop_id,
  updated_at
) on public.shops to anon, authenticated;

-- Preserve idempotent retries for existing requests, then reject closed/demo
-- shops before validating the cart or locking and reserving product rows.
create or replace function public.create_order(
  p_shop_slug text,
  p_customer_name text,
  p_items jsonb,
  p_client_request_id uuid,
  p_recovery_token text
)
returns table(
  id uuid,
  order_code text,
  customer_name text,
  total_amount integer,
  status public.order_status,
  created_at timestamptz,
  updated_at timestamptz,
  expires_at timestamptz,
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  expired_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shop uuid;
  v_accepting_orders boolean;
  v_order public.orders;
  v_existing public.orders;
  v_total integer;
  v_hash text;
  v_product_id text;
begin
  select s.id, s.accepting_orders
  into v_shop, v_accepting_orders
  from public.shops s
  where s.slug = lower(btrim(p_shop_slug))
    and s.active;

  if v_shop is null then
    raise exception 'Shop not found or inactive';
  end if;
  if p_client_request_id is null then
    raise exception 'A client request id is required';
  end if;
  if p_recovery_token is null or length(p_recovery_token) < 32 then
    raise exception 'A recovery token is required';
  end if;

  v_hash := encode(extensions.digest(p_recovery_token, 'sha256'), 'hex');
  perform pg_advisory_xact_lock(hashtextextended(p_client_request_id::text, 0));

  select * into v_existing
  from public.orders o
  where o.client_request_id = p_client_request_id;

  if found then
    if v_existing.shop_id <> v_shop
      or v_existing.recovery_token_hash is distinct from v_hash then
      raise exception 'This request id belongs to another checkout';
    end if;
    return query
    select
      v_existing.id,
      v_existing.order_code,
      v_existing.customer_name,
      v_existing.total_amount,
      v_existing.status,
      v_existing.created_at,
      v_existing.updated_at,
      v_existing.expires_at,
      v_existing.confirmed_at,
      v_existing.cancelled_at,
      v_existing.expired_at;
    return;
  end if;

  if not v_accepting_orders then
    raise exception 'This storefront is a read-only demo and does not accept orders';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array'
    or jsonb_array_length(p_items) not between 1 and 50 then
    raise exception 'Cart must contain between 1 and 50 items';
  end if;
  if exists(
    select 1
    from jsonb_to_recordset(p_items) x(product_id text, quantity integer)
    where product_id is null or quantity is null or quantity <= 0
  ) then
    raise exception 'Cart contains an invalid item';
  end if;

  perform p.id
  from public.products p
  where p.shop_id = v_shop
    and p.id in (
      select x.product_id
      from jsonb_to_recordset(p_items) x(product_id text, quantity integer)
    )
  order by p.id
  for update;

  if exists(
    select 1
    from (
      select x.product_id, sum(x.quantity)::integer as quantity
      from jsonb_to_recordset(p_items) x(product_id text, quantity integer)
      group by x.product_id
    ) x
    left join public.products p
      on p.shop_id = v_shop and p.id = x.product_id
    where p.id is null
      or not p.active
      or p.quantity_available < x.quantity
  ) then
    raise exception 'One or more items are sold out or no longer have enough stock';
  end if;

  select sum(p.price_vnd * x.quantity)::integer
  into v_total
  from (
    select i.product_id, sum(i.quantity)::integer as quantity
    from jsonb_to_recordset(p_items) i(product_id text, quantity integer)
    group by i.product_id
  ) x
  join public.products p
    on p.shop_id = v_shop and p.id = x.product_id;

  insert into public.orders(
    shop_id,
    customer_name,
    total_amount,
    status,
    client_request_id,
    recovery_token_hash,
    expires_at
  )
  values (
    v_shop,
    nullif(btrim(left(p_customer_name, 30)), ''),
    v_total,
    'pending',
    p_client_request_id,
    v_hash,
    now() + private.reservation_duration()
  )
  returning * into v_order;

  insert into public.order_items(
    shop_id,
    order_id,
    product_id,
    quantity,
    unit_price
  )
  select v_shop, v_order.id, p.id, x.quantity, p.price_vnd
  from (
    select i.product_id, sum(i.quantity)::integer as quantity
    from jsonb_to_recordset(p_items) i(product_id text, quantity integer)
    group by i.product_id
  ) x
  join public.products p
    on p.shop_id = v_shop and p.id = x.product_id;

  for v_product_id in
    update public.products p
    set quantity_available = p.quantity_available - x.quantity
    from (
      select i.product_id, sum(i.quantity)::integer as quantity
      from jsonb_to_recordset(p_items) i(product_id text, quantity integer)
      group by i.product_id
    ) x
    where p.shop_id = v_shop and p.id = x.product_id
    returning p.id
  loop
    perform private.sync_product_stock(v_product_id);
  end loop;

  return query
  select
    v_order.id,
    v_order.order_code,
    v_order.customer_name,
    v_order.total_amount,
    v_order.status,
    v_order.created_at,
    v_order.updated_at,
    v_order.expires_at,
    v_order.confirmed_at,
    v_order.cancelled_at,
    v_order.expired_at;
end;
$$;

revoke all on function public.create_order(text, text, jsonb, uuid, text)
from public, anon, authenticated;
grant execute on function public.create_order(text, text, jsonb, uuid, text)
to anon, authenticated;
