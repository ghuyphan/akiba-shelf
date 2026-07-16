create table public.promotion_products (
  shop_id uuid not null references public.shops(id) on delete cascade,
  product_id text not null,
  role text not null check (role in ('qualifying', 'reward', 'both')),
  primary key(shop_id, product_id),
  foreign key(shop_id, product_id)
    references public.products(shop_id, id) on delete cascade
);

create index promotion_products_shop_role_idx
on public.promotion_products(shop_id, role, product_id);

alter table public.promotion_products enable row level security;

create policy "Public reads active promotion products"
on public.promotion_products for select to anon
using (
  exists(
    select 1 from public.promotions promotion
    where promotion.shop_id = promotion_products.shop_id
      and promotion.enabled
  )
);

create policy "Authenticated users read visible promotion products"
on public.promotion_products for select to authenticated
using (
  exists(
    select 1 from public.promotions promotion
    where promotion.shop_id = promotion_products.shop_id
      and promotion.enabled
  )
  or private.has_shop_role(shop_id, array['owner', 'admin'])
);

create policy "Shop admins insert promotion products"
on public.promotion_products for insert to authenticated
with check (private.has_shop_role(shop_id, array['owner', 'admin']));

create policy "Shop admins update promotion products"
on public.promotion_products for update to authenticated
using (private.has_shop_role(shop_id, array['owner', 'admin']))
with check (private.has_shop_role(shop_id, array['owner', 'admin']));

create policy "Shop admins delete promotion products"
on public.promotion_products for delete to authenticated
using (private.has_shop_role(shop_id, array['owner', 'admin']));

grant select(shop_id, product_id, role)
on public.promotion_products to anon, authenticated;
grant insert, update, delete on public.promotion_products to authenticated;
grant select, insert, update, delete on public.promotion_products to service_role;

insert into public.promotion_products(shop_id, product_id, role)
select product.shop_id, product.id, 'both'
from public.products product
where product.promotion_eligible
on conflict (shop_id, product_id) do nothing;

alter table public.order_items
  add column free_quantity integer not null default 0,
  add constraint order_items_free_quantity_check
    check (free_quantity between 0 and quantity);

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
security invoker
set search_path = ''
as $$
begin
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

  if exists(
    select 1
    from unnest(
      coalesce(p_qualifying_product_ids, '{}'::text[])
      || coalesce(p_reward_product_ids, '{}'::text[])
    ) requested(product_id)
    left join public.products product
      on product.shop_id = p_shop_id
     and product.id = requested.product_id
    where product.id is null
  ) then
    raise exception 'Promotion contains a product from another shop';
  end if;

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
  select
    p_shop_id,
    requested.product_id,
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
    ) as input(product_id)
  ) requested;
end;
$$;

revoke all on function public.save_promotion_settings(
  uuid, boolean, integer, integer, boolean, text[], text[]
) from public, anon, authenticated;
grant execute on function public.save_promotion_settings(
  uuid, boolean, integer, integer, boolean, text[], text[]
) to authenticated;

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
language sql
stable
security invoker
set search_path = ''
as $$
  with cart as (
    select
      item.product_id,
      sum(item.quantity)::integer as quantity,
      sum(coalesce(item.reward_quantity, 0))::integer as free_quantity
    from jsonb_to_recordset(p_items)
      item(product_id text, quantity integer, reward_quantity integer)
    group by item.product_id
  )
  select
    product.id,
    cart.quantity,
    product.effective_price_vnd,
    cart.free_quantity,
    (cart.free_quantity * product.effective_price_vnd)::integer
  from cart
  join public.products product
    on product.shop_id = p_shop_id
   and product.id = cart.product_id
$$;

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
  v_promotion public.promotions;
  v_total integer;
  v_discount integer;
  v_qualifying_quantity integer;
  v_requested_rewards integer;
  v_max_rewards integer;
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
    from jsonb_to_recordset(p_items)
      item(product_id text, quantity integer, reward_quantity integer)
    where item.product_id is null
      or item.quantity is null
      or item.quantity <= 0
      or coalesce(item.reward_quantity, 0) < 0
      or coalesce(item.reward_quantity, 0) > item.quantity
  ) then
    raise exception 'Cart contains an invalid item';
  end if;

  perform product.id
  from public.products product
  where product.shop_id = v_shop
    and product.id in (
      select item.product_id
      from jsonb_to_recordset(p_items)
        item(product_id text, quantity integer, reward_quantity integer)
    )
  order by product.id
  for update;

  if exists(
    select 1
    from (
      select item.product_id, sum(item.quantity)::integer as quantity
      from jsonb_to_recordset(p_items)
        item(product_id text, quantity integer, reward_quantity integer)
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

  select * into v_promotion
  from public.promotions promotion
  where promotion.shop_id = v_shop;

  select
    coalesce(sum(
      item.quantity - coalesce(item.reward_quantity, 0)
    ) filter (where mapping.role in ('qualifying', 'both')), 0)::integer,
    coalesce(sum(coalesce(item.reward_quantity, 0)), 0)::integer
  into v_qualifying_quantity, v_requested_rewards
  from jsonb_to_recordset(p_items)
    item(product_id text, quantity integer, reward_quantity integer)
  left join public.promotion_products mapping
    on mapping.shop_id = v_shop
   and mapping.product_id = item.product_id;

  if v_requested_rewards > 0 then
    if v_promotion.shop_id is null or not v_promotion.enabled then
      raise exception 'This promotion is no longer active';
    end if;
    if exists(
      select 1
      from jsonb_to_recordset(p_items)
        item(product_id text, quantity integer, reward_quantity integer)
      left join public.promotion_products mapping
        on mapping.shop_id = v_shop
       and mapping.product_id = item.product_id
      where coalesce(item.reward_quantity, 0) > 0
        and coalesce(mapping.role, '') not in ('reward', 'both')
    ) then
      raise exception 'Cart contains an invalid reward item';
    end if;

    v_max_rewards := case
      when v_promotion.repeatable then
        (v_qualifying_quantity / v_promotion.buy_quantity)
          * v_promotion.free_quantity
      when v_qualifying_quantity >= v_promotion.buy_quantity then
        v_promotion.free_quantity
      else 0
    end;
    if v_requested_rewards > v_max_rewards then
      raise exception 'Cart contains too many free reward items';
    end if;
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
  ) values (
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
    free_quantity,
    discount_amount
  )
  select
    v_shop,
    v_order.id,
    line.product_id,
    line.quantity,
    line.unit_price,
    line.free_quantity,
    line.discount_amount
  from private.calculate_promotion_lines(v_shop, p_items) line;

  for v_product_id in
    update public.products product
    set quantity_available = product.quantity_available - cart.quantity
    from (
      select item.product_id, sum(item.quantity)::integer as quantity
      from jsonb_to_recordset(p_items)
        item(product_id text, quantity integer, reward_quantity integer)
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

grant select(free_quantity) on public.order_items to authenticated;

do $$
begin
  if exists(
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) and not exists(
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'promotion_products'
  ) then
    alter publication supabase_realtime add table public.promotion_products;
  end if;
end
$$;
