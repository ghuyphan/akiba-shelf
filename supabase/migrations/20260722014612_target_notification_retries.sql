-- Retain only the endpoints that still need delivery so one flaky device does
-- not cause duplicate push notifications on every healthy staff device.
alter table public.order_notification_events
  add column retry_endpoints text[] not null default '{}',
  add constraint order_notification_events_retry_endpoint_count_check
    check (cardinality(retry_endpoints) <= 500);

create or replace function public.claim_order_notification_delivery(
  p_order_id uuid,
  p_shop_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.order_notification_events;
  next_lease_token uuid;
begin
  if not exists (
    select 1 from public.orders
    where id = p_order_id and shop_id = p_shop_id and status = 'pending'
  ) then
    raise exception 'Pending order not found';
  end if;

  insert into public.order_notification_events(order_id, shop_id)
  values (p_order_id, p_shop_id)
  on conflict (order_id) do nothing;

  select * into event_row from public.order_notification_events
  where order_id = p_order_id for update;
  if event_row.shop_id <> p_shop_id then raise exception 'Notification shop mismatch'; end if;
  if event_row.status = 'delivered' then
    return jsonb_build_object('outcome', 'delivered');
  end if;
  if event_row.status = 'sending' and event_row.lease_expires_at > now() then
    return jsonb_build_object('outcome', 'in_progress');
  end if;

  next_lease_token := gen_random_uuid();
  update public.order_notification_events
  set status = 'sending',
      attempt_count = attempt_count + 1,
      lease_expires_at = now() + interval '2 minutes',
      lease_token = next_lease_token,
      last_error = null
  where order_id = p_order_id;
  return jsonb_build_object(
    'outcome', 'claimed',
    'lease_token', next_lease_token,
    'retry_endpoints', to_jsonb(event_row.retry_endpoints)
  );
end;
$$;

create function public.complete_order_notification_delivery(
  p_order_id uuid,
  p_lease_token uuid,
  p_delivered boolean,
  p_error text,
  p_failed_endpoints text[]
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_failed text[];
begin
  select coalesce(array_agg(endpoint order by endpoint), '{}')
  into normalized_failed
  from (
    select distinct btrim(endpoint) endpoint
    from unnest(coalesce(p_failed_endpoints, '{}')) endpoint
    where btrim(endpoint) <> ''
    limit 500
  ) bounded;

  update public.order_notification_events
  set status = case when p_delivered then 'delivered' else 'retryable_failed' end,
      delivered_at = case when p_delivered then now() else delivered_at end,
      lease_expires_at = null,
      lease_token = null,
      retry_endpoints = case
        when p_delivered then '{}'
        else normalized_failed
      end,
      last_error = case
        when p_delivered then null
        else left(coalesce(nullif(btrim(p_error), ''), 'Notification delivery failed'), 1000)
      end
  where order_id = p_order_id
    and status = 'sending'
    and lease_token = p_lease_token;
  return found;
end;
$$;

revoke all on function public.complete_order_notification_delivery(
  uuid,
  uuid,
  boolean,
  text,
  text[]
) from public, anon, authenticated;
revoke all on function public.complete_order_notification_delivery(
  uuid,
  uuid,
  boolean,
  text
) from service_role;
grant execute on function public.complete_order_notification_delivery(
  uuid,
  uuid,
  boolean,
  text,
  text[]
) to service_role;

notify pgrst, 'reload schema';
