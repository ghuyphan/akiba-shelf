-- Add one narrow scheduled promotion type and authoritative confirmed-sales
-- reporting without changing the existing reservation and checkout RPC shape.

alter table public.promotions
  add column kind text not null default 'buy_get',
  add column percentage_off integer not null default 10,
  add column minimum_subtotal_vnd integer not null default 0,
  add column starts_at timestamptz,
  add column ends_at timestamptz,
  add constraint promotions_kind_check
    check (kind in ('buy_get', 'percentage')),
  add constraint promotions_percentage_off_check
    check (percentage_off between 1 and 100),
  add constraint promotions_minimum_subtotal_check
    check (minimum_subtotal_vnd between 0 and 2000000000),
  add constraint promotions_schedule_check
    check (starts_at is null or ends_at is null or starts_at < ends_at);

grant select(kind, percentage_off, minimum_subtotal_vnd, starts_at, ends_at)
on public.promotions to anon, authenticated;

drop function if exists public.save_promotion_settings(
  uuid, boolean, integer, integer, boolean, text[], text[]
);

create function public.save_promotion_settings(
  p_shop_id uuid,
  p_enabled boolean,
  p_kind text,
  p_buy_quantity integer,
  p_free_quantity integer,
  p_repeatable boolean,
  p_percentage_off integer,
  p_minimum_subtotal_vnd integer,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
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
  if p_kind not in ('buy_get', 'percentage') then
    raise exception 'Promotion type is invalid';
  end if;
  if p_buy_quantity not between 1 and 99
    or p_free_quantity not between 1 and 99 then
    raise exception 'Promotion quantities must be between 1 and 99';
  end if;
  if p_percentage_off not between 1 and 100 then
    raise exception 'Promotion percentage must be between 1 and 100';
  end if;
  if p_minimum_subtotal_vnd not between 0 and 2000000000 then
    raise exception 'Promotion minimum subtotal is invalid';
  end if;
  if p_starts_at is not null and p_ends_at is not null
    and p_starts_at >= p_ends_at then
    raise exception 'Promotion end must be after its start';
  end if;
  if cardinality(coalesce(p_qualifying_product_ids, '{}'::text[])) > 500
    or cardinality(coalesce(p_reward_product_ids, '{}'::text[])) > 500 then
    raise exception 'Promotion product selection is too large';
  end if;
  if p_enabled and cardinality(
    coalesce(p_qualifying_product_ids, '{}'::text[])
  ) = 0 then
    raise exception 'An active promotion requires qualifying products';
  end if;
  if p_enabled and p_kind = 'buy_get' and cardinality(
    coalesce(p_reward_product_ids, '{}'::text[])
  ) = 0 then
    raise exception 'An active buy-get promotion requires reward products';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('shop-promotion:' || p_shop_id::text, 0)
  );

  if exists(
    select 1
    from unnest(
      coalesce(p_qualifying_product_ids, '{}'::text[])
      || case when p_kind = 'buy_get'
        then coalesce(p_reward_product_ids, '{}'::text[])
        else '{}'::text[]
      end
    ) requested(product_id)
    left join public.products product
      on product.shop_id = p_shop_id and product.id = requested.product_id
    where product.id is null
  ) then
    raise exception 'Promotion contains a product from another shop';
  end if;

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
        || case when p_kind = 'buy_get'
          then coalesce(p_reward_product_ids, '{}'::text[])
          else '{}'::text[]
        end
      ) requested(product_id)
    )
  order by product.id
  for update;

  insert into public.promotions(
    shop_id, enabled, kind, buy_quantity, free_quantity, repeatable,
    percentage_off, minimum_subtotal_vnd, starts_at, ends_at, updated_at
  ) values (
    p_shop_id, p_enabled, p_kind, p_buy_quantity, p_free_quantity,
    p_repeatable, p_percentage_off, p_minimum_subtotal_vnd,
    p_starts_at, p_ends_at, now()
  )
  on conflict (shop_id) do update set
    enabled = excluded.enabled,
    kind = excluded.kind,
    buy_quantity = excluded.buy_quantity,
    free_quantity = excluded.free_quantity,
    repeatable = excluded.repeatable,
    percentage_off = excluded.percentage_off,
    minimum_subtotal_vnd = excluded.minimum_subtotal_vnd,
    starts_at = excluded.starts_at,
    ends_at = excluded.ends_at,
    updated_at = excluded.updated_at;

  delete from public.promotion_products mapping
  where mapping.shop_id = p_shop_id;

  insert into public.promotion_products(shop_id, product_id, role)
  select p_shop_id, requested.product_id,
    case
      when p_kind = 'buy_get'
        and requested.product_id = any(coalesce(p_qualifying_product_ids, '{}'::text[]))
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
      || case when p_kind = 'buy_get'
        then coalesce(p_reward_product_ids, '{}'::text[])
        else '{}'::text[]
      end
    ) input(product_id)
  ) requested;
end;
$$;

revoke all on function public.save_promotion_settings(
  uuid, boolean, text, integer, integer, boolean, integer, integer,
  timestamptz, timestamptz, text[], text[]
) from public, anon, authenticated;
grant execute on function public.save_promotion_settings(
  uuid, boolean, text, integer, integer, boolean, integer, integer,
  timestamptz, timestamptz, text[], text[]
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
      unit_price::bigint * (quantity - requested_rewards)
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
        )
        as active
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
    end::integer as free_quantity,
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
    end::integer as discount_amount
  from priced
  left join settings on true
$$;

revoke all on function private.calculate_promotion_lines(uuid, jsonb)
from public, anon, authenticated;

create index if not exists orders_confirmed_sales_idx
  on public.orders(shop_id, confirmed_at desc, id)
  where status = 'confirmed';
create index if not exists offline_event_orders_confirmed_sales_idx
  on public.offline_event_orders(shop_id, confirmed_at desc, id)
  where status = 'confirmed';

create function public.get_sales_summary(
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
        ), 0)::integer,
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
        item.unit_price * item.quantity - item.discount_amount as revenue,
        item.discount_amount
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
        item.unit_price * item.quantity - item.discount_amount,
        item.discount_amount
      from confirmed_orders confirmed
      join public.offline_event_order_items item
        on confirmed.source = 'offline_event' and item.order_id = confirmed.id
      left join public.offline_event_allocations allocation
        on allocation.session_id = item.session_id
       and allocation.product_id = item.product_id
    ), products as (
      select product_id, max(name) as name, max(item_code) as item_code,
        sum(quantity)::integer as units,
        sum(revenue)::integer as revenue,
        sum(discount_amount)::integer as discount_amount
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

-- Keep the fast storefront bootstrap aligned with the expanded promotion row.
create or replace function public.get_storefront_bootstrap(p_shop_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
  storefront_shop public.shops;
  catalog_shop_id uuid;
begin
  select * into storefront_shop
  from public.shops
  where slug = lower(btrim(p_shop_slug)) and active;
  if not found then
    raise exception 'Shop not found or inactive';
  end if;
  catalog_shop_id := coalesce(
    storefront_shop.catalog_source_shop_id,
    storefront_shop.id
  );
  if not exists (
    select 1 from public.shops where id = catalog_shop_id and active
  ) then
    raise exception 'Catalog shop not found or inactive';
  end if;

  with product_rows as (
    select
      product.id,
      product.shop_id,
      product.name,
      product.collection,
      product.description,
      product.price_vnd,
      product.sale_price_vnd,
      product.effective_price_vnd,
      product.promotion_eligible,
      product.item_code,
      product.quantity_available,
      product.category,
      product.badge,
      product.badge_color,
      product.stock_status,
      product.stock_note,
      product.images,
      product.image_variants,
      product.featured,
      product.sort_order,
      product.active
    from public.products product
    where product.shop_id = catalog_shop_id and product.active
    order by product.featured desc, product.sort_order, product.id
    limit 25
  ), booth_row as (
    select
      booth.id,
      booth.shop_id,
      booth.booth_name,
      booth.subtitle,
      booth.booth_code,
      booth.location,
      booth.open_hours,
      booth.logo_url,
      booth.instagram_url,
      booth.instagram_visible,
      booth.facebook_url,
      booth.facebook_visible,
      booth.tiktok_url,
      booth.tiktok_visible,
      booth.x_url,
      booth.x_visible,
      booth.threads_url,
      booth.threads_visible,
      booth.youtube_url,
      booth.youtube_visible,
      booth.social_qr_logo_url,
      booth.theme_primary,
      booth.theme_secondary,
      booth.theme_accent,
      booth.theme_background,
      booth.layout_order,
      booth.corner_radius,
      booth.card_style,
      booth.featured_style,
      booth.controls_style,
      booth.product_style,
      booth.catalog_locale,
      booth.featured_autoplay
    from public.booth_settings booth
    where booth.shop_id = catalog_shop_id
    limit 1
  ), promotion_row as (
    select jsonb_build_object(
      'shop_id', catalog_shop_id,
      'enabled', coalesce(promotion.enabled, false),
      'kind', coalesce(promotion.kind, 'buy_get'),
      'percentage_off', coalesce(promotion.percentage_off, 10),
      'minimum_subtotal_vnd', coalesce(promotion.minimum_subtotal_vnd, 0),
      'starts_at', promotion.starts_at,
      'ends_at', promotion.ends_at,
      'buy_quantity', coalesce(promotion.buy_quantity, 3),
      'free_quantity', coalesce(promotion.free_quantity, 1),
      'repeatable', coalesce(promotion.repeatable, true),
      'qualifying_product_ids', coalesce((
        select jsonb_agg(mapping.product_id order by mapping.product_id)
        from public.promotion_products mapping
        where mapping.shop_id = catalog_shop_id
          and mapping.role in ('qualifying', 'both')
      ), '[]'::jsonb),
      'reward_product_ids', coalesce((
        select jsonb_agg(mapping.product_id order by mapping.product_id)
        from public.promotion_products mapping
        where mapping.shop_id = catalog_shop_id
          and mapping.role in ('reward', 'both')
      ), '[]'::jsonb)
    ) value
    from (select 1) seed
    left join public.promotions promotion on promotion.shop_id = catalog_shop_id
  )
  select jsonb_build_object(
    'shop', jsonb_build_object(
      'id', storefront_shop.id,
      'name', storefront_shop.name,
      'slug', storefront_shop.slug,
      'active', storefront_shop.active,
      'accepting_orders', storefront_shop.accepting_orders,
      'catalog_source_shop_id', storefront_shop.catalog_source_shop_id
    ),
    'catalog_shop_id', catalog_shop_id,
    'products', coalesce((
      select jsonb_agg(to_jsonb(product_row) order by product_row.featured desc, product_row.sort_order, product_row.id)
      from (select * from product_rows limit 24) product_row
    ), '[]'::jsonb),
    'has_more', (select count(*) > 24 from product_rows),
    'booth', (select to_jsonb(booth_row) from booth_row),
    'categories', coalesce((
      select jsonb_agg(category order by category)
      from (
        select distinct btrim(product.category) category
        from public.products product
        where product.shop_id = catalog_shop_id
          and product.active
          and btrim(product.category) <> ''
      ) category_rows
    ), '[]'::jsonb),
    'promotion', (select value from promotion_row),
    'gacha_enabled', exists(
      select 1 from public.gacha_published_configs config
      where config.shop_id = catalog_shop_id
        and (config.config #>> '{settings,enabled}')::boolean
    )
  ) into result;

  return result;
end;
$$;



-- Activation freezes whether the scheduled offer is active on this tablet.
create or replace function public.activate_offline_event_session(
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
    'enabled', coalesce(
      promotion.enabled
        and (promotion.starts_at is null or now() >= promotion.starts_at)
        and (promotion.ends_at is null or now() < promotion.ends_at),
      false
    ),
    'kind', coalesce(promotion.kind, 'buy_get'),
    'percentage_off', coalesce(promotion.percentage_off, 10),
    'minimum_subtotal_vnd', coalesce(promotion.minimum_subtotal_vnd, 0),
    'starts_at', null,
    'ends_at', null,
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



-- Replace the renamed integrity core so percentage Event orders are checked
-- against the frozen server snapshot instead of trusted client totals.
create or replace function public.sync_offline_event_orders_integrity_core(
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
  incoming_payment_method text;
  incoming_payment_state text;
  incoming_fulfillment_status text;
  existing_fulfillment_rank integer;
  incoming_fulfillment_rank integer;
  existing_payment_rank integer;
  incoming_payment_rank integer;
  incoming_revision bigint;
  incoming_updated_at timestamptz;
  item_quantity integer;
  item_price integer;
  item_discount integer;
  item_free_quantity integer;
  qualifying_quantity integer;
  requested_rewards integer;
  max_rewards integer;
  authoritative_total bigint;
  paid_subtotal bigint;
  expected_discount integer;
  promotion_kind text;
  promotion_enabled boolean;
  percentage_off integer;
  minimum_subtotal_vnd integer;
  inserted_count integer := 0;
  updated_count integer := 0;
  stale_count integer := 0;
  acknowledgements jsonb := '{}'::jsonb;
begin
  select * into event_session from public.offline_event_sessions
  where id = p_session_id and device_id = p_device_id for update;
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
    incoming_payment_method := order_payload ->> 'payment_method';
    incoming_payment_state := order_payload ->> 'payment_state';
    incoming_revision := coalesce((order_payload ->> 'client_revision')::bigint, 0);
    incoming_updated_at := (order_payload ->> 'updated_at')::timestamptz;
    incoming_fulfillment_status := coalesce(order_payload ->> 'fulfillment_status',
      case when order_status = 'confirmed' then 'preparing' else 'unfulfilled' end);

    if incoming_revision < 0
      or order_payload ->> 'created_at' is null
      or incoming_updated_at is null
      or incoming_updated_at < (order_payload ->> 'created_at')::timestamptz
      or not private.offline_payment_state_valid(
        incoming_payment_method, incoming_payment_state, order_status
      )
      or incoming_fulfillment_status not in ('unfulfilled', 'preparing', 'ready', 'picked_up')
      or (order_status = 'confirmed' and incoming_fulfillment_status = 'unfulfilled')
      or (order_status <> 'confirmed' and incoming_fulfillment_status <> 'unfulfilled')
      or length(coalesce(order_payload ->> 'order_code', '')) not between 4 and 32
      or length(coalesce(order_payload ->> 'customer_name', '')) > 30
      or length(coalesce(order_payload ->> 'confirmed_by_label', '')) > 320
      or length(coalesce(order_payload ->> 'cancelled_by_label', '')) > 320
      or length(coalesce(order_payload ->> 'fulfillment_updated_by_label', '')) > 320 then
      raise exception 'Offline order fields are invalid';
    end if;

    if (select count(*) from jsonb_array_elements(order_payload -> 'items')) <>
      (select count(distinct item ->> 'product_id') from jsonb_array_elements(order_payload -> 'items') item) then
      raise exception 'Each offline order product may only appear once';
    end if;

    authoritative_total := 0;
    qualifying_quantity := 0;
    requested_rewards := 0;
    promotion_kind := coalesce(
      event_session.promotion_snapshot ->> 'kind',
      'buy_get'
    );
    promotion_enabled := coalesce(
      (event_session.promotion_snapshot ->> 'enabled')::boolean,
      false
    );
    percentage_off := coalesce(
      (event_session.promotion_snapshot ->> 'percentage_off')::integer,
      10
    );
    minimum_subtotal_vnd := coalesce(
      (event_session.promotion_snapshot ->> 'minimum_subtotal_vnd')::integer,
      0
    );
    select coalesce(sum(
      coalesce(
        (allocation.product_snapshot ->> 'effective_price_vnd')::integer,
        (allocation.product_snapshot ->> 'sale_price_vnd')::integer,
        (allocation.product_snapshot ->> 'price_vnd')::integer
      )::bigint * (item ->> 'quantity')::integer
    ), 0)
    into paid_subtotal
    from jsonb_array_elements(order_payload -> 'items') item
    join public.offline_event_allocations allocation
      on allocation.session_id = p_session_id
     and allocation.product_id = item ->> 'product_id';
    for item_payload in select value from jsonb_array_elements(order_payload -> 'items')
    loop
      item_quantity := (item_payload ->> 'quantity')::integer;
      item_discount := coalesce((item_payload ->> 'discount_amount')::integer, 0);
      select coalesce(
        (allocation.product_snapshot ->> 'effective_price_vnd')::integer,
        (allocation.product_snapshot ->> 'sale_price_vnd')::integer,
        (allocation.product_snapshot ->> 'price_vnd')::integer
      ) into item_price
      from public.offline_event_allocations allocation
      where allocation.session_id = p_session_id
        and allocation.product_id = item_payload ->> 'product_id';
      if item_quantity is null or item_quantity <= 0 or item_price is null
        or item_discount < 0
        or item_discount::bigint > item_price::bigint * item_quantity then
        raise exception 'Offline order pricing is invalid';
      end if;
      if promotion_kind = 'percentage' then
        expected_discount := case
          when promotion_enabled
            and paid_subtotal >= minimum_subtotal_vnd
            and (event_session.promotion_snapshot -> 'qualifying_product_ids')
              ? (item_payload ->> 'product_id')
            then floor(
              item_price::numeric * item_quantity * percentage_off / 100
            )::integer
          else 0
        end;
        if item_discount <> expected_discount then
          raise exception 'Offline order pricing is invalid';
        end if;
        item_free_quantity := 0;
      else
        if (item_price > 0 and item_discount % item_price <> 0)
          or (item_price = 0 and item_discount <> 0) then
          raise exception 'Offline order pricing is invalid';
        end if;
        item_free_quantity := case
          when item_price = 0 then 0
          else item_discount / item_price
        end;
        if item_free_quantity > 0 and not (
          (event_session.promotion_snapshot -> 'reward_product_ids')
            ? (item_payload ->> 'product_id')
        ) then
          raise exception 'Offline order contains an invalid reward item';
        end if;
        if (event_session.promotion_snapshot -> 'qualifying_product_ids')
          ? (item_payload ->> 'product_id') then
          qualifying_quantity := qualifying_quantity
            + item_quantity - item_free_quantity;
        end if;
        requested_rewards := requested_rewards + item_free_quantity;
      end if;
      authoritative_total := authoritative_total + item_price::bigint * item_quantity - item_discount;
    end loop;

    if requested_rewards > 0 then
      if not coalesce((event_session.promotion_snapshot ->> 'enabled')::boolean, false) then
        raise exception 'The offline promotion snapshot does not allow rewards';
      end if;
      max_rewards := case
        when coalesce((event_session.promotion_snapshot ->> 'repeatable')::boolean, true) then
          (qualifying_quantity / (event_session.promotion_snapshot ->> 'buy_quantity')::integer)
            * (event_session.promotion_snapshot ->> 'free_quantity')::integer
        when qualifying_quantity >= (event_session.promotion_snapshot ->> 'buy_quantity')::integer then
          (event_session.promotion_snapshot ->> 'free_quantity')::integer
        else 0
      end;
      if requested_rewards > max_rewards then raise exception 'Offline order contains too many reward items'; end if;
    end if;
    if authoritative_total > 2147483647 then raise exception 'Offline order total is too large'; end if;

    select * into existing_order from public.offline_event_orders
    where id = v_order_id and session_id = p_session_id for update;

    if existing_order.id is null then
      if order_status <> 'cancelled' then
        for item_payload in select value from jsonb_array_elements(order_payload -> 'items')
        loop
          item_quantity := (item_payload ->> 'quantity')::integer;
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
        status, payment_method, payment_state, fulfillment_status,
        fulfillment_updated_at, confirmed_at, cancelled_at,
        confirmed_by_label, cancelled_by_label,
        fulfillment_updated_by_label, client_revision, created_at, updated_at
      ) values (
        v_order_id, p_session_id, event_session.shop_id,
        order_payload ->> 'order_code', nullif(btrim(order_payload ->> 'customer_name'), ''),
        authoritative_total::integer, order_status,
        incoming_payment_method, incoming_payment_state,
        incoming_fulfillment_status, (order_payload ->> 'fulfillment_updated_at')::timestamptz,
        case when order_status = 'confirmed' then incoming_updated_at end,
        case when order_status = 'cancelled' then incoming_updated_at end,
        nullif(order_payload ->> 'confirmed_by_label', ''),
        nullif(order_payload ->> 'cancelled_by_label', ''),
        nullif(order_payload ->> 'fulfillment_updated_by_label', ''),
        incoming_revision, (order_payload ->> 'created_at')::timestamptz, incoming_updated_at
      );
      insert into public.offline_event_order_items(
        order_id, session_id, shop_id, product_id, quantity, unit_price, discount_amount
      )
      select v_order_id, p_session_id, event_session.shop_id,
        item ->> 'product_id', (item ->> 'quantity')::integer,
        coalesce(
          (allocation.product_snapshot ->> 'effective_price_vnd')::integer,
          (allocation.product_snapshot ->> 'sale_price_vnd')::integer,
          (allocation.product_snapshot ->> 'price_vnd')::integer
        ), coalesce((item ->> 'discount_amount')::integer, 0)
      from jsonb_array_elements(order_payload -> 'items') item
      join public.offline_event_allocations allocation
        on allocation.session_id = p_session_id and allocation.product_id = item ->> 'product_id';
      inserted_count := inserted_count + 1;
      acknowledgements := acknowledgements || jsonb_build_object(v_order_id::text, incoming_revision);
    else
      if order_payload ? 'client_revision' then
        if incoming_revision <= existing_order.client_revision then
          stale_count := stale_count + 1;
          acknowledgements := acknowledgements || jsonb_build_object(v_order_id::text, existing_order.client_revision);
          continue;
        end if;
      elsif incoming_updated_at <= existing_order.updated_at then
        stale_count := stale_count + 1;
        acknowledgements := acknowledgements || jsonb_build_object(v_order_id::text, existing_order.client_revision);
        continue;
      end if;

      if existing_order.status = 'confirmed' and order_status <> 'confirmed' then raise exception 'Confirmed offline orders are immutable'; end if;
      if existing_order.status = 'cancelled' and order_status <> 'cancelled' then raise exception 'Cancelled offline orders cannot be reopened'; end if;
      if existing_order.payment_method <> incoming_payment_method then
        raise exception 'Offline payment method is immutable';
      end if;
      if existing_order.total_amount <> authoritative_total::integer
        or (select count(*) from public.offline_event_order_items stored
            where stored.order_id = existing_order.id)
          <> jsonb_array_length(order_payload -> 'items')
        or exists (
          select 1
          from jsonb_array_elements(order_payload -> 'items') incoming
          left join public.offline_event_order_items stored
            on stored.order_id = existing_order.id
           and stored.product_id = incoming ->> 'product_id'
          where stored.product_id is null
            or stored.quantity <> (incoming ->> 'quantity')::integer
            or stored.discount_amount <>
              coalesce((incoming ->> 'discount_amount')::integer, 0)
        ) then
        raise exception 'Offline order items and totals are immutable';
      end if;
      existing_payment_rank := case existing_order.payment_state
        when 'awaiting_payment' then 0
        when 'bank_verification_pending' then 1
        when 'cash_confirmed' then 2
        when 'bank_confirmed' then 2
        else -1
      end;
      incoming_payment_rank := case incoming_payment_state
        when 'awaiting_payment' then 0
        when 'bank_verification_pending' then 1
        when 'cash_confirmed' then 2
        when 'bank_confirmed' then 2
        else -1
      end;
      if existing_order.status = order_status
        and incoming_payment_rank < existing_payment_rank then
        stale_count := stale_count + 1;
        acknowledgements := acknowledgements || jsonb_build_object(
          v_order_id::text, existing_order.client_revision
        );
        continue;
      end if;
      if existing_order.status <> 'cancelled' and order_status = 'cancelled' then
        update public.offline_event_allocations allocation
        set quantity_sold = allocation.quantity_sold - item.quantity
        from public.offline_event_order_items item
        where item.order_id = existing_order.id
          and allocation.session_id = item.session_id
          and allocation.product_id = item.product_id;
      end if;
      existing_fulfillment_rank := case existing_order.fulfillment_status when 'preparing' then 1 when 'ready' then 2 when 'picked_up' then 3 else 0 end;
      incoming_fulfillment_rank := case incoming_fulfillment_status when 'preparing' then 1 when 'ready' then 2 when 'picked_up' then 3 else 0 end;
      update public.offline_event_orders
      set status = order_status,
          payment_state = incoming_payment_state,
          confirmed_at = coalesce(
            existing_order.confirmed_at,
            case when order_status = 'confirmed' then incoming_updated_at end
          ),
          cancelled_at = coalesce(
            existing_order.cancelled_at,
            case when order_status = 'cancelled' then incoming_updated_at end
          ),
          fulfillment_status = case when incoming_fulfillment_rank > existing_fulfillment_rank then incoming_fulfillment_status else existing_order.fulfillment_status end,
          fulfillment_updated_at = case
            when incoming_fulfillment_rank > existing_fulfillment_rank then greatest(
              existing_order.fulfillment_updated_at,
              (order_payload ->> 'fulfillment_updated_at')::timestamptz
            )
            else existing_order.fulfillment_updated_at
          end,
          fulfillment_updated_by_label = case when incoming_fulfillment_rank > existing_fulfillment_rank then nullif(order_payload ->> 'fulfillment_updated_by_label', '') else existing_order.fulfillment_updated_by_label end,
          confirmed_by_label = coalesce(existing_order.confirmed_by_label, nullif(order_payload ->> 'confirmed_by_label', '')),
          cancelled_by_label = coalesce(existing_order.cancelled_by_label, nullif(order_payload ->> 'cancelled_by_label', '')),
          client_revision = case when order_payload ? 'client_revision' then incoming_revision else existing_order.client_revision end,
          updated_at = greatest(existing_order.updated_at, incoming_updated_at),
          synced_at = now()
      where id = existing_order.id;
      updated_count := updated_count + 1;
      acknowledgements := acknowledgements || jsonb_build_object(
        v_order_id::text,
        case when order_payload ? 'client_revision' then incoming_revision else existing_order.client_revision end
      );
    end if;
  end loop;
  return jsonb_build_object(
    'inserted', inserted_count,
    'updated', updated_count,
    'stale', stale_count,
    'acknowledged_revisions', acknowledgements
  );
end;
$$;



notify pgrst, 'reload schema';
