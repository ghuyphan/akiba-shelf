alter table public.push_subscriptions
  add constraint push_subscriptions_endpoint_format_check
    check (
      length(endpoint) between 1 and 2048
      and endpoint ~ '^https://[^[:space:]]+$'
    ) not valid,
  add constraint push_subscriptions_p256dh_length_check
    check (length(p256dh) between 1 and 512) not valid,
  add constraint push_subscriptions_auth_length_check
    check (length(auth) between 1 and 512) not valid,
  add constraint push_subscriptions_user_agent_length_check
    check (user_agent is null or length(user_agent) <= 1024) not valid;

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

  -- Checkout locks selected product rows before reading promotion state. Lock
  -- the shop catalog in the same stable order so either transaction observes
  -- the complete old configuration or the complete new configuration.
  perform product.id
  from public.products product
  where product.shop_id = p_shop_id
  order by product.id
  for update;

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
    shop_id,
    enabled,
    buy_quantity,
    free_quantity,
    repeatable,
    updated_at
  ) values (
    p_shop_id,
    p_enabled,
    p_buy_quantity,
    p_free_quantity,
    p_repeatable,
    now()
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
      when requested.product_id = any(
        coalesce(p_qualifying_product_ids, '{}'::text[])
      ) and requested.product_id = any(
        coalesce(p_reward_product_ids, '{}'::text[])
      ) then 'both'
      when requested.product_id = any(
        coalesce(p_qualifying_product_ids, '{}'::text[])
      ) then 'qualifying'
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

revoke insert, update, delete on public.promotions
from public, anon, authenticated;
revoke insert, update, delete on public.promotion_products
from public, anon, authenticated;

revoke all on function public.save_promotion_settings(
  uuid, boolean, integer, integer, boolean, text[], text[]
) from public, anon, authenticated;
grant execute on function public.save_promotion_settings(
  uuid, boolean, integer, integer, boolean, text[], text[]
) to authenticated;

create or replace function public.cancel_customer_order(
  p_order_id uuid,
  p_recovery_token text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.orders;
begin
  if p_recovery_token is null
    or length(p_recovery_token) not between 32 and 160 then
    return jsonb_build_object('outcome', 'not_found', 'order', null);
  end if;

  select * into o
  from public.orders
  where id = p_order_id
  for update;

  if not found or o.recovery_token_hash is distinct from encode(
    extensions.digest(p_recovery_token, 'sha256'),
    'hex'
  ) then
    return jsonb_build_object('outcome', 'not_found', 'order', null);
  end if;
  if o.status = 'cancelled' then
    return jsonb_build_object(
      'outcome', 'already_cancelled',
      'order', to_jsonb(o) - 'recovery_token_hash'
    );
  end if;
  if o.status = 'confirmed' then
    return jsonb_build_object(
      'outcome', 'already_confirmed',
      'order', to_jsonb(o) - 'recovery_token_hash'
    );
  end if;
  if o.status = 'expired' then
    return jsonb_build_object(
      'outcome', 'already_expired',
      'order', to_jsonb(o) - 'recovery_token_hash'
    );
  end if;

  o := private.release_reservation(o.id, 'cancelled', null);
  return jsonb_build_object(
    'outcome', 'cancelled',
    'order', to_jsonb(o) - 'recovery_token_hash'
  );
end;
$$;

create or replace function public.get_customer_order(
  p_order_id uuid,
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
  o public.orders;
begin
  if p_recovery_token is null
    or length(p_recovery_token) not between 32 and 160 then
    return;
  end if;

  select * into o
  from public.orders
  where orders.id = p_order_id
    and recovery_token_hash = encode(
      extensions.digest(p_recovery_token, 'sha256'),
      'hex'
    )
  for update;

  if not found then return; end if;
  if o.status = 'pending' and o.expires_at <= now() then
    o := private.release_reservation(o.id, 'expired');
  end if;

  return query
  select
    o.id,
    o.order_code,
    o.customer_name,
    o.total_amount,
    o.status,
    o.created_at,
    o.updated_at,
    o.expires_at,
    o.confirmed_at,
    o.cancelled_at,
    o.expired_at;
end;
$$;

revoke all on function public.cancel_customer_order(uuid, text)
from public, anon, authenticated;
revoke all on function public.get_customer_order(uuid, text)
from public, anon, authenticated;
grant execute on function public.cancel_customer_order(uuid, text),
  public.get_customer_order(uuid, text) to anon, authenticated;

notify pgrst, 'reload schema';
