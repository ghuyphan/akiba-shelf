-- Convert the one-shot dedupe marker into a retryable delivery lease.
alter table public.order_notification_events
  add column status text not null default 'pending',
  add column attempt_count integer not null default 0,
  add column lease_expires_at timestamptz,
  add column lease_token uuid,
  add column delivered_at timestamptz,
  add column last_error text,
  add column updated_at timestamptz not null default now(),
  add constraint order_notification_events_status_check
    check (status in ('pending', 'sending', 'retryable_failed', 'delivered')),
  add constraint order_notification_events_attempt_count_check
    check (attempt_count >= 0),
  add constraint order_notification_events_error_length_check
    check (length(coalesce(last_error, '')) <= 1000);

-- Historical rows were already treated as delivered by the old one-shot flow.
update public.order_notification_events
set status = 'delivered',
    delivered_at = coalesce(created_at, now()),
    updated_at = now();

create index order_notification_events_retry_idx
  on public.order_notification_events (status, lease_expires_at, created_at)
  where status in ('pending', 'sending', 'retryable_failed');

drop trigger if exists order_notification_events_set_updated_at
  on public.order_notification_events;
create trigger order_notification_events_set_updated_at
  before update on public.order_notification_events
  for each row execute function public.set_updated_at();

create function public.claim_order_notification_delivery(
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
    'lease_token', next_lease_token
  );
end;
$$;

create function public.complete_order_notification_delivery(
  p_order_id uuid,
  p_lease_token uuid,
  p_delivered boolean,
  p_error text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.order_notification_events
  set status = case when p_delivered then 'delivered' else 'retryable_failed' end,
      delivered_at = case when p_delivered then now() else delivered_at end,
      lease_expires_at = null,
      lease_token = null,
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

revoke all on function public.claim_order_notification_delivery(uuid, uuid),
  public.complete_order_notification_delivery(uuid, uuid, boolean, text)
from public, anon, authenticated;
grant execute on function public.claim_order_notification_delivery(uuid, uuid),
  public.complete_order_notification_delivery(uuid, uuid, boolean, text)
to service_role;

notify pgrst, 'reload schema';
