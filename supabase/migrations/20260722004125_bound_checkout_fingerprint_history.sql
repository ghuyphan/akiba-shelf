-- Pending reservations cannot outlive the reservation window, so avoid joining
-- a shared network fingerprint's complete order history on every checkout.
create or replace function public.create_order_rate_limited(
  p_shop_slug text,
  p_customer_name text,
  p_items jsonb,
  p_client_request_id uuid,
  p_recovery_token text,
  p_fingerprint_hash text
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
  v_shop_id uuid;
  v_existing_order boolean;
  v_pending_count integer;
  v_recent_count integer;
  v_order record;
begin
  if p_fingerprint_hash is null or p_fingerprint_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid checkout fingerprint';
  end if;

  select shop.id into v_shop_id
  from public.shops shop
  where shop.slug = lower(btrim(p_shop_slug)) and shop.active;
  if v_shop_id is null then raise exception 'Shop not found or inactive'; end if;

  perform pg_advisory_xact_lock(
    hashtextextended(v_shop_id::text || ':' || p_fingerprint_hash, 0)
  );

  select exists(
    select 1 from public.orders existing_order
    where existing_order.client_request_id = p_client_request_id
  ) into v_existing_order;

  if not v_existing_order then
    select count(*)::integer into v_pending_count
    from (
      select 1
      from private.checkout_reservation_clients client
      join public.orders existing_order on existing_order.id = client.order_id
      where client.shop_id = v_shop_id
        and client.fingerprint_hash = p_fingerprint_hash
        and client.created_at > now() - private.reservation_duration() - interval '1 minute'
        and existing_order.status = 'pending'
        and existing_order.expires_at > now()
      limit 8
    ) bounded_pending;
    if v_pending_count >= 8 then
      raise exception 'Too many active checkout reservations. Complete or cancel an existing order first.';
    end if;

    select count(*)::integer into v_recent_count
    from (
      select 1
      from private.checkout_reservation_clients client
      where client.shop_id = v_shop_id
        and client.fingerprint_hash = p_fingerprint_hash
        and client.created_at > now() - interval '10 minutes'
      limit 30
    ) bounded_recent;
    if v_recent_count >= 30 then
      raise exception 'Too many checkout attempts. Please wait a few minutes and try again.';
    end if;
  end if;

  select * into v_order
  from public.create_order(
    p_shop_slug,
    p_customer_name,
    p_items,
    p_client_request_id,
    p_recovery_token
  );
  if v_order.id is null then raise exception 'Order creation returned no result'; end if;

  insert into private.checkout_reservation_clients(
    order_id, client_request_id, shop_id, fingerprint_hash
  ) values (
    v_order.id, p_client_request_id, v_shop_id, p_fingerprint_hash
  )
  on conflict (order_id) do nothing;

  return query select
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

revoke all on function public.create_order_rate_limited(
  text, text, jsonb, uuid, text, text
) from public, anon, authenticated;
grant execute on function public.create_order_rate_limited(
  text, text, jsonb, uuid, text, text
) to service_role;
