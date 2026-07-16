alter table public.products
  add column promotion_eligible boolean not null default false;

create table public.promotions (
  shop_id uuid primary key references public.shops(id) on delete cascade,
  enabled boolean not null default false,
  buy_quantity integer not null default 3
    check (buy_quantity between 1 and 99),
  free_quantity integer not null default 1
    check (free_quantity between 1 and 99),
  repeatable boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.promotions enable row level security;

create policy "Public reads active shop promotions"
on public.promotions for select to anon, authenticated
using (enabled);

create policy "Shop admins read promotions"
on public.promotions for select to authenticated
using (private.has_shop_role(shop_id, array['owner', 'admin']));

create policy "Shop admins manage promotions"
on public.promotions for all to authenticated
using (private.has_shop_role(shop_id, array['owner', 'admin']))
with check (private.has_shop_role(shop_id, array['owner', 'admin']));

grant select(shop_id, enabled, buy_quantity, free_quantity, repeatable)
on public.promotions to anon, authenticated;
grant insert, update, delete on public.promotions to authenticated;
grant select, insert, update, delete on public.promotions to service_role;

do $$
begin
  if exists(
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) and not exists(
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'promotions'
  ) then
    alter publication supabase_realtime add table public.promotions;
  end if;
end
$$;

alter table public.orders
  add column discount_amount integer not null default 0,
  add constraint orders_discount_amount_check check (discount_amount >= 0);

alter table public.order_items
  add column discount_amount integer not null default 0,
  add constraint order_items_discount_amount_check
    check (
      discount_amount >= 0
      and discount_amount <= unit_price::bigint * quantity
    );

-- Calculate a deterministic allocation for the configured buy-X-get-Y offer.
-- Free units use the lowest current effective prices first; product id is a
-- stable tie-breaker for line-level display when prices match.
create function private.calculate_promotion_lines(
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
language sql
stable
security invoker
set search_path = ''
as $$
  with cart as (
    select item.product_id, sum(item.quantity)::integer as quantity
    from jsonb_to_recordset(p_items) item(product_id text, quantity integer)
    group by item.product_id
  ),
  priced as (
    select
      product.id as product_id,
      cart.quantity,
      product.effective_price_vnd as unit_price,
      product.promotion_eligible
    from cart
    join public.products product
      on product.shop_id = p_shop_id
     and product.id = cart.product_id
  ),
  eligible_total as (
    select coalesce(sum(quantity) filter (
      where promotion_eligible
    ), 0)::integer as quantity
    from priced
  ),
  promotion as (
    select
      case
        when settings.shop_id is null or not settings.enabled then 0
        when settings.repeatable then
          (eligible_total.quantity / (
            settings.buy_quantity + settings.free_quantity
          )) * settings.free_quantity
        when eligible_total.quantity >=
          settings.buy_quantity + settings.free_quantity then
          settings.free_quantity
        else 0
      end::integer as free_units
    from eligible_total
    left join public.promotions settings on settings.shop_id = p_shop_id
  ),
  eligible as (
    select
      priced.product_id,
      priced.quantity,
      priced.unit_price,
      coalesce(
        sum(priced.quantity) over (
          order by priced.unit_price, priced.product_id
          rows between unbounded preceding and 1 preceding
        ),
        0
      )::integer as prior_units
    from priced
    where priced.promotion_eligible
  ),
  allocated as (
    select
      eligible.product_id,
      greatest(
        0,
        least(
          eligible.quantity,
          promotion.free_units - eligible.prior_units
        )
      )::integer as free_quantity
    from eligible
    cross join promotion
  )
  select
    priced.product_id,
    priced.quantity,
    priced.unit_price,
    coalesce(allocated.free_quantity, 0)::integer as free_quantity,
    (coalesce(allocated.free_quantity, 0) * priced.unit_price)::integer
      as discount_amount
  from priced
  left join allocated using (product_id)
$$;

revoke all on function private.calculate_promotion_lines(uuid, jsonb)
from public, anon, authenticated;

-- Keep the existing RPC signature, retry behavior, row locking, and inventory
-- reservation contract. Only the server-derived pricing snapshot changes.
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
  v_discount integer;
  v_hash text;
  v_product_id text;
begin
  select shop.id, shop.accepting_orders
  into v_shop, v_accepting_orders
  from public.shops shop
  where shop.slug = lower(btrim(p_shop_slug))
    and shop.active;

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
  from public.orders existing_order
  where existing_order.client_request_id = p_client_request_id;

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
    from jsonb_to_recordset(p_items) item(product_id text, quantity integer)
    where item.product_id is null
      or item.quantity is null
      or item.quantity <= 0
  ) then
    raise exception 'Cart contains an invalid item';
  end if;

  perform product.id
  from public.products product
  where product.shop_id = v_shop
    and product.id in (
      select item.product_id
      from jsonb_to_recordset(p_items) item(product_id text, quantity integer)
    )
  order by product.id
  for update;

  if exists(
    select 1
    from (
      select item.product_id, sum(item.quantity)::integer as quantity
      from jsonb_to_recordset(p_items) item(product_id text, quantity integer)
      group by item.product_id
    ) cart
    left join public.products product
      on product.shop_id = v_shop
     and product.id = cart.product_id
    where product.id is null
      or not product.active
      or product.quantity_available < cart.quantity
  ) then
    raise exception 'One or more items are sold out or no longer have enough stock';
  end if;

  select
    sum(line.unit_price * line.quantity - line.discount_amount)::integer,
    sum(line.discount_amount)::integer
  into v_total, v_discount
  from private.calculate_promotion_lines(v_shop, p_items) line;

  insert into public.orders(
    shop_id,
    customer_name,
    total_amount,
    discount_amount,
    status,
    client_request_id,
    recovery_token_hash,
    expires_at
  )
  values (
    v_shop,
    nullif(btrim(left(p_customer_name, 30)), ''),
    v_total,
    v_discount,
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
    unit_price,
    discount_amount
  )
  select
    v_shop,
    v_order.id,
    line.product_id,
    line.quantity,
    line.unit_price,
    line.discount_amount
  from private.calculate_promotion_lines(v_shop, p_items) line;

  for v_product_id in
    update public.products product
    set quantity_available = product.quantity_available - cart.quantity
    from (
      select item.product_id, sum(item.quantity)::integer as quantity
      from jsonb_to_recordset(p_items) item(product_id text, quantity integer)
      group by item.product_id
    ) cart
    where product.shop_id = v_shop
      and product.id = cart.product_id
    returning product.id
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

-- The promotion flag is public catalog data. Order discounts remain visible
-- only to authenticated shop members through the existing tenant RLS policies.
grant select(promotion_eligible)
on public.products to anon, authenticated;
grant select(discount_amount)
on public.orders, public.order_items to authenticated;
