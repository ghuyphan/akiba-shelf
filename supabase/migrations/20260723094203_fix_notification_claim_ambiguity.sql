create or replace function public.claim_order_notification_batch(
  p_batch_size integer default 10
)
returns table(
  order_id uuid,
  shop_id uuid,
  lease_token uuid,
  retry_endpoints text[],
  attempt_number integer
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_user not in ('postgres', 'service_role') then
    raise exception 'Service role required' using errcode = '42501';
  end if;

  with terminal_candidates as (
    select event.order_id
    from public.order_notification_events event
    join public.orders order_row on order_row.id = event.order_id
    where order_row.status <> 'pending'
      and event.status in ('queued', 'retryable_failed', 'sending')
    order by event.updated_at, event.order_id
    for update of event skip locked
    limit 500
  )
  update public.order_notification_events event
  set status = 'skipped',
      skipped_at = now(),
      lease_expires_at = null,
      lease_token = null,
      retry_endpoints = '{}',
      next_attempt_at = now(),
      last_error = 'order_not_pending'
  from terminal_candidates candidate
  where event.order_id = candidate.order_id;

  with exhausted_candidates as (
    select
      event.order_id,
      event.lease_token,
      event.updated_at as started_at
    from public.order_notification_events event
    where event.status = 'sending'
      and event.lease_expires_at <= now()
      and event.attempt_count >= event.max_attempts
    order by event.lease_expires_at, event.order_id
    for update skip locked
    limit 500
  ), exhausted as (
    update public.order_notification_events event
    set status = 'dead_letter',
        dead_lettered_at = now(),
        lease_expires_at = null,
        lease_token = null,
        next_attempt_at = now(),
        last_error = 'notification_worker_lease_exhausted'
    from exhausted_candidates candidate
    where event.order_id = candidate.order_id
    returning
      event.order_id,
      event.shop_id,
      event.attempt_count,
      event.retry_endpoints,
      candidate.lease_token,
      candidate.started_at
  )
  insert into public.order_notification_attempts(
    order_id,
    shop_id,
    attempt_number,
    lease_token,
    outcome,
    failed_endpoint_count,
    sent_endpoint_count,
    error_code,
    started_at
  )
  select
    exhausted.order_id,
    exhausted.shop_id,
    exhausted.attempt_count,
    exhausted.lease_token,
    'dead_letter',
    cardinality(exhausted.retry_endpoints),
    0,
    'notification_worker_lease_exhausted',
    exhausted.started_at
  from exhausted
  where exhausted.lease_token is not null
  on conflict on constraint order_notification_attempts_order_id_attempt_number_key
  do nothing;

  with expired_retry_candidates as (
    select event.*
    from public.order_notification_events event
    join public.orders order_row on order_row.id = event.order_id
    where event.status = 'sending'
      and event.lease_expires_at <= now()
      and event.attempt_count < event.max_attempts
      and order_row.status = 'pending'
    order by event.lease_expires_at, event.order_id
    for update of event skip locked
    limit 500
  )
  insert into public.order_notification_attempts(
    order_id, shop_id, attempt_number, lease_token, outcome,
    failed_endpoint_count, sent_endpoint_count, error_code, started_at
  )
  select
    candidate.order_id,
    candidate.shop_id,
    candidate.attempt_count,
    candidate.lease_token,
    'retryable_failed',
    cardinality(candidate.retry_endpoints),
    0,
    'notification_worker_lease_expired',
    coalesce(candidate.updated_at, candidate.created_at)
  from expired_retry_candidates candidate
  where candidate.lease_token is not null
  on conflict on constraint order_notification_attempts_order_id_attempt_number_key
  do nothing;

  return query
  with due as (
    select event.order_id
    from public.order_notification_events event
    join public.orders order_row on order_row.id = event.order_id
    where ((
      event.status in ('queued', 'retryable_failed')
      and event.next_attempt_at <= now()
    ) or (
      event.status = 'sending'
      and event.lease_expires_at <= now()
    ))
      and order_row.status = 'pending'
    order by event.next_attempt_at, event.created_at, event.order_id
    for update of event skip locked
    limit greatest(1, least(coalesce(p_batch_size, 10), 50))
  ), claimed as (
    update public.order_notification_events event
    set status = 'sending',
        attempt_count = event.attempt_count + 1,
        lease_expires_at = now() + interval '2 minutes',
        lease_token = gen_random_uuid(),
        last_error = null
    from due
    where event.order_id = due.order_id
    returning event.*
  )
  select
    claimed.order_id,
    claimed.shop_id,
    claimed.lease_token,
    claimed.retry_endpoints,
    claimed.attempt_count
  from claimed;
end;
$$;

revoke all on function public.claim_order_notification_batch(integer)
from public, anon, authenticated;
grant execute on function public.claim_order_notification_batch(integer)
to service_role;

notify pgrst, 'reload schema';
