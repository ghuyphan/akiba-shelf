-- Durable notification queue -------------------------------------------------

create extension if not exists pg_net with schema extensions;

alter table public.order_notification_events
  drop constraint if exists order_notification_events_status_check;

alter table public.order_notification_events
  alter column status set default 'queued',
  add column if not exists next_attempt_at timestamptz not null default now(),
  add column if not exists max_attempts integer not null default 6,
  add column if not exists successful_delivery_count integer not null default 0,
  add column if not exists dead_lettered_at timestamptz,
  add constraint order_notification_events_status_check
    check (status in (
      'pending', 'queued', 'sending', 'retryable_failed', 'delivered',
      'skipped', 'dead_letter'
    )),
  add constraint order_notification_events_max_attempts_check
    check (max_attempts between 1 and 1000);

update public.order_notification_events
set status = 'queued', next_attempt_at = now()
where status = 'pending';

create index if not exists order_notification_events_due_idx
  on public.order_notification_events(next_attempt_at, created_at, order_id)
  where status in ('queued', 'retryable_failed', 'sending');
create index if not exists order_notification_events_shop_updated_idx
  on public.order_notification_events(shop_id, updated_at desc, order_id);

alter table public.order_notification_events
  add column if not exists skipped_at timestamptz;

create table public.order_notification_attempts (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.order_notification_events(order_id)
    on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  attempt_number integer not null check (attempt_number > 0),
  lease_token uuid not null,
  outcome text not null check (outcome in (
    'delivered', 'skipped', 'retryable_failed', 'dead_letter'
  )),
  failed_endpoint_count integer not null default 0
    check (failed_endpoint_count >= 0),
  sent_endpoint_count integer not null default 0
    check (sent_endpoint_count >= 0),
  error_code text,
  started_at timestamptz not null,
  completed_at timestamptz not null default now(),
  unique(order_id, attempt_number)
);

create index order_notification_attempts_shop_completed_idx
  on public.order_notification_attempts(shop_id, completed_at desc);

alter table public.order_notification_attempts enable row level security;
revoke all on public.order_notification_attempts from public, anon, authenticated;
grant select, insert, delete on public.order_notification_attempts to service_role;

create table public.order_notification_requeue_actions (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  previous_status text not null check (previous_status in ('skipped', 'dead_letter')),
  reason text check (length(coalesce(reason, '')) <= 240),
  created_at timestamptz not null default now()
);

create index order_notification_requeue_actions_shop_created_idx
  on public.order_notification_requeue_actions(shop_id, created_at desc);

alter table public.order_notification_requeue_actions enable row level security;
revoke all on public.order_notification_requeue_actions
from public, anon, authenticated;
grant select on public.order_notification_requeue_actions to authenticated;
grant select, insert, delete on public.order_notification_requeue_actions
to service_role;
create policy "Members read notification requeue history"
on public.order_notification_requeue_actions for select to authenticated
using ((select private.is_shop_member(shop_id)));

create table public.order_notification_archive (
  order_id uuid primary key,
  shop_id uuid not null,
  final_status text not null check (final_status in (
    'delivered', 'skipped', 'dead_letter'
  )),
  attempt_count integer not null,
  successful_delivery_count integer not null default 0,
  created_at timestamptz not null,
  completed_at timestamptz,
  skipped_at timestamptz,
  dead_lettered_at timestamptz,
  attempts jsonb not null default '[]'::jsonb,
  archived_at timestamptz not null default now()
);

create index order_notification_archive_shop_archived_idx
  on public.order_notification_archive(shop_id, archived_at desc);

alter table public.order_notification_archive enable row level security;
revoke all on public.order_notification_archive from public, anon, authenticated;
grant select, insert, delete on public.order_notification_archive to service_role;

create or replace function public.enqueue_order_notification(
  p_order_id uuid,
  p_shop_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.orders
    where id = p_order_id and shop_id = p_shop_id and status = 'pending'
  ) then
    raise exception 'Pending order not found';
  end if;

  insert into public.order_notification_events(
    order_id, shop_id, status, next_attempt_at
  ) values (
    p_order_id, p_shop_id, 'queued', now()
  )
  on conflict (order_id) do update
  set next_attempt_at = least(
        public.order_notification_events.next_attempt_at,
        excluded.next_attempt_at
      )
  where public.order_notification_events.status in (
    'queued', 'retryable_failed'
  );
end;
$$;

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
  if current_user not in ('postgres', 'service_role') then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  perform public.enqueue_order_notification(p_order_id, p_shop_id);

  select * into event_row
  from public.order_notification_events
  where order_id = p_order_id
  for update;

  if event_row.shop_id <> p_shop_id then
    raise exception 'Notification shop mismatch';
  end if;
  if event_row.status = 'delivered' then
    return jsonb_build_object('outcome', 'delivered');
  end if;
  if event_row.status = 'skipped' then
    return jsonb_build_object('outcome', 'skipped');
  end if;
  if event_row.status = 'dead_letter' then
    return jsonb_build_object('outcome', 'dead_letter');
  end if;
  if event_row.status = 'sending' and event_row.lease_expires_at > now() then
    return jsonb_build_object('outcome', 'in_progress');
  end if;
  if event_row.status <> 'sending' and event_row.next_attempt_at > now() then
    return jsonb_build_object(
      'outcome', 'not_due',
      'next_attempt_at', event_row.next_attempt_at
    );
  end if;

  if event_row.status = 'sending' and event_row.lease_expires_at <= now() then
    insert into public.order_notification_attempts(
      order_id, shop_id, attempt_number, lease_token, outcome,
      failed_endpoint_count, sent_endpoint_count, error_code, started_at
    ) values (
      event_row.order_id, event_row.shop_id, event_row.attempt_count,
      event_row.lease_token,
      case when event_row.attempt_count >= event_row.max_attempts
        then 'dead_letter' else 'retryable_failed' end,
      cardinality(event_row.retry_endpoints), 0,
      'notification_worker_lease_expired',
      coalesce(event_row.updated_at, event_row.created_at)
    ) on conflict (order_id, attempt_number) do nothing;
    if event_row.attempt_count >= event_row.max_attempts then
      update public.order_notification_events
      set status = 'dead_letter', dead_lettered_at = now(),
          lease_expires_at = null, lease_token = null,
          last_error = 'notification_worker_lease_exhausted'
      where order_id = p_order_id;
      return jsonb_build_object('outcome', 'dead_letter');
    end if;
  end if;

  next_lease_token := gen_random_uuid();
  update public.order_notification_events
  set status = 'sending',
      attempt_count = attempt_count + 1,
      lease_expires_at = now() + interval '2 minutes',
      lease_token = next_lease_token,
      last_error = null
  where order_id = p_order_id
  returning * into event_row;

  return jsonb_build_object(
    'outcome', 'claimed',
    'lease_token', next_lease_token,
    'retry_endpoints', to_jsonb(event_row.retry_endpoints),
    'attempt_number', event_row.attempt_count
  );
end;
$$;

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
  select order_id, shop_id, attempt_count, lease_token, 'retryable_failed',
    cardinality(retry_endpoints), 0, 'notification_worker_lease_expired',
    coalesce(updated_at, created_at)
  from expired_retry_candidates
  where lease_token is not null
  on conflict (order_id, attempt_number) do nothing;

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

create or replace function public.complete_order_notification_delivery(
  p_order_id uuid,
  p_lease_token uuid,
  p_delivered boolean,
  p_error text,
  p_failed_endpoints text[],
  p_sent_count integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.order_notification_events;
  normalized_failed text[];
  final_status text;
  safe_error text;
  normalized_sent_count integer;
  cumulative_sent_count integer;
begin
  if current_user not in ('postgres', 'service_role') then
    raise exception 'Service role required' using errcode = '42501';
  end if;

  select * into event_row
  from public.order_notification_events
  where order_id = p_order_id
    and status = 'sending'
    and lease_token = p_lease_token
  for update;
  if not found then return false; end if;

  select coalesce(array_agg(endpoint order by endpoint), '{}')
  into normalized_failed
  from (
    select distinct left(btrim(endpoint), 2048) endpoint
    from unnest(coalesce(p_failed_endpoints, '{}')) endpoint
    where btrim(endpoint) <> ''
    limit 500
  ) bounded;

  safe_error := left(
    coalesce(nullif(btrim(p_error), ''), 'notification_delivery_failed'),
    120
  );
  normalized_sent_count := greatest(0, least(coalesce(p_sent_count, 0), 500));
  cumulative_sent_count := event_row.successful_delivery_count + normalized_sent_count;
  final_status := case
    when p_delivered and cumulative_sent_count = 0 and safe_error in (
      'no_valid_subscriptions', 'order_not_pending'
    ) then 'skipped'
    when p_delivered then 'delivered'
    when event_row.attempt_count >= event_row.max_attempts then 'dead_letter'
    else 'retryable_failed'
  end;

  update public.order_notification_events
  set status = final_status,
      delivered_at = case
        when final_status = 'delivered' then now()
        else delivered_at
      end,
      skipped_at = case
        when final_status = 'skipped' then now()
        else skipped_at
      end,
      dead_lettered_at = case
        when final_status = 'dead_letter' then now()
        else dead_lettered_at
      end,
      successful_delivery_count = cumulative_sent_count,
      lease_expires_at = null,
      lease_token = null,
      retry_endpoints = case when p_delivered then '{}' else normalized_failed end,
      next_attempt_at = case
        when final_status = 'retryable_failed' then
          now() + make_interval(
            secs => least(
              3600,
              15 * power(2, least(event_row.attempt_count - 1, 8))::integer
            )
          )
        else now()
      end,
      last_error = case
        when final_status = 'delivered' then null
        else safe_error
      end
  where order_id = p_order_id;

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
  ) values (
    event_row.order_id,
    event_row.shop_id,
    event_row.attempt_count,
    p_lease_token,
    final_status,
    cardinality(normalized_failed),
    normalized_sent_count,
    case when final_status = 'delivered' then null else safe_error end,
    coalesce(event_row.updated_at, event_row.created_at)
  )
  on conflict (order_id, attempt_number) do nothing;

  return true;
end;
$$;

-- Preserve the previous worker completion contract for one rollback window.
create or replace function public.complete_order_notification_delivery(
  p_order_id uuid,
  p_lease_token uuid,
  p_delivered boolean,
  p_error text,
  p_failed_endpoints text[]
)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select public.complete_order_notification_delivery(
    p_order_id, p_lease_token, p_delivered, p_error, p_failed_endpoints, 0
  );
$$;

create or replace function public.archive_order_notification_events(
  p_retention_days integer default 30,
  p_batch_size integer default 500
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  archived_count integer;
begin
  if current_user not in ('postgres', 'service_role') then
    raise exception 'Service role required' using errcode = '42501';
  end if;

  with candidates as (
    select event.*
    from public.order_notification_events event
    where event.status in ('delivered', 'skipped', 'dead_letter')
      and event.updated_at < now() - make_interval(
        days => greatest(1, least(coalesce(p_retention_days, 30), 365))
      )
    order by event.updated_at, event.order_id
    limit greatest(1, least(coalesce(p_batch_size, 500), 2000))
  ), archived as (
    insert into public.order_notification_archive(
      order_id,
      shop_id,
      final_status,
      attempt_count,
      successful_delivery_count,
      created_at,
      completed_at,
      skipped_at,
      dead_lettered_at,
      attempts
    )
    select
      candidate.order_id,
      candidate.shop_id,
      candidate.status,
      candidate.attempt_count,
      candidate.successful_delivery_count,
      candidate.created_at,
      candidate.delivered_at,
      candidate.skipped_at,
      candidate.dead_lettered_at,
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'attempt_number', attempt.attempt_number,
            'outcome', attempt.outcome,
            'failed_endpoint_count', attempt.failed_endpoint_count,
            'sent_endpoint_count', attempt.sent_endpoint_count,
            'error_code', attempt.error_code,
            'started_at', attempt.started_at,
            'completed_at', attempt.completed_at
          ) order by attempt.attempt_number
        )
        from public.order_notification_attempts attempt
        where attempt.order_id = candidate.order_id
      ), '[]'::jsonb)
    from candidates candidate
    on conflict (order_id) do nothing
    returning order_id
  ), deleted as (
    delete from public.order_notification_events event
    using archived
    where event.order_id = archived.order_id
    returning event.order_id
  )
  select count(*)::integer into archived_count from deleted;
  return archived_count;
end;
$$;

create or replace function public.request_order_notification_drain()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  worker_url text;
  worker_secret text;
  request_id bigint;
begin
  if current_user not in ('postgres', 'service_role') then
    raise exception 'Service role required' using errcode = '42501';
  end if;

  select decrypted_secret into worker_url
  from vault.decrypted_secrets
  where name = 'notification_worker_url'
  order by created_at desc
  limit 1;
  select decrypted_secret into worker_secret
  from vault.decrypted_secrets
  where name = 'notification_worker_secret'
  order by created_at desc
  limit 1;
  if nullif(worker_url, '') is null or nullif(worker_secret, '') is null then
    raise exception 'Notification worker Vault secrets are not configured';
  end if;

  select net.http_post(
    url := worker_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-notification-worker-secret', worker_secret
    ),
    body := jsonb_build_object('action', 'drain', 'batchSize', 25),
    timeout_milliseconds := 10000
  ) into request_id;
  return request_id;
end;
$$;

create or replace function public.configure_order_notification_drain_schedule()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  scheduled_job_id bigint;
begin
  if current_user not in ('postgres', 'service_role') then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  if not exists(select 1 from pg_extension where extname = 'pg_cron') then
    raise exception 'pg_cron is not available';
  end if;
  if (select count(distinct name) from vault.decrypted_secrets
      where name in ('notification_worker_url', 'notification_worker_secret')) <> 2 then
    raise exception 'Notification worker Vault secrets are not configured';
  end if;

  perform cron.unschedule(jobid)
  from cron.job
  where jobname = 'drain-order-notification-queue';
  select cron.schedule(
    'drain-order-notification-queue',
    '* * * * *',
    'select public.request_order_notification_drain();'
  ) into scheduled_job_id;
  return scheduled_job_id;
end;
$$;

create or replace function public.get_order_notification_status(
  p_shop_id uuid,
  p_limit integer default 50
)
returns table(
  order_id uuid,
  status text,
  attempt_count integer,
  failed_endpoint_count integer,
  next_attempt_at timestamptz,
  delivered_at timestamptz,
  skipped_at timestamptz,
  dead_lettered_at timestamptz,
  updated_at timestamptz,
  last_error text,
  due_count bigint,
  retryable_failed_count bigint,
  dead_letter_count bigint,
  oldest_due_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.is_shop_member(p_shop_id) then
    raise exception 'Active shop member access required' using errcode = '42501';
  end if;

  return query
  with health as (
    select
      count(*) filter (
        where (event.status in ('queued', 'retryable_failed')
          and event.next_attempt_at <= now())
          or (event.status = 'sending' and event.lease_expires_at <= now())
      ) due_count,
      count(*) filter (
        where event.status = 'retryable_failed'
      ) retryable_failed_count,
      count(*) filter (
        where event.status = 'dead_letter'
      ) dead_letter_count,
      min(case
        when event.status in ('queued', 'retryable_failed')
          and event.next_attempt_at <= now() then event.next_attempt_at
        when event.status = 'sending'
          and event.lease_expires_at <= now() then event.lease_expires_at
      end) oldest_due_at
    from public.order_notification_events event
    where event.shop_id = p_shop_id
  )
  select
    event.order_id,
    event.status,
    event.attempt_count,
    cardinality(event.retry_endpoints),
    event.next_attempt_at,
    event.delivered_at,
    event.skipped_at,
    event.dead_lettered_at,
    event.updated_at,
    event.last_error,
    health.due_count,
    health.retryable_failed_count,
    health.dead_letter_count,
    health.oldest_due_at
  from public.order_notification_events event
  cross join health
  where event.shop_id = p_shop_id
  order by
    case
      when event.status = 'dead_letter' then 0
      when event.status in ('queued', 'retryable_failed')
        and event.next_attempt_at <= now() then 1
      when event.status = 'sending' and event.lease_expires_at <= now() then 1
      else 2
    end,
    case
      when event.status in ('queued', 'retryable_failed')
        and event.next_attempt_at <= now() then event.next_attempt_at
      when event.status = 'sending' and event.lease_expires_at <= now()
        then event.lease_expires_at
    end asc nulls last,
    event.updated_at desc,
    event.order_id
  limit greatest(1, least(coalesce(p_limit, 50), 200));
end;
$$;

create or replace function public.retry_order_notification(
  p_shop_id uuid,
  p_order_id uuid,
  p_reason text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.order_notification_events;
begin
  if auth.uid() is null
    or not private.has_shop_role(p_shop_id, array['owner', 'admin']) then
    raise exception 'Shop admin access required' using errcode = '42501';
  end if;
  if length(coalesce(p_reason, '')) > 240 then
    raise exception 'Notification retry reason is too long';
  end if;

  select event.* into event_row
  from public.order_notification_events event
  join public.orders order_row on order_row.id = event.order_id
  where event.order_id = p_order_id
    and event.shop_id = p_shop_id
    and event.status in ('skipped', 'dead_letter')
    and order_row.status = 'pending'
  for update of event;
  if not found then return false; end if;

  update public.order_notification_events
  set status = 'queued',
      max_attempts = least(1000, greatest(max_attempts, attempt_count + 6)),
      next_attempt_at = now(),
      skipped_at = null,
      dead_lettered_at = null,
      lease_expires_at = null,
      lease_token = null,
      retry_endpoints = case
        when event_row.status = 'dead_letter' then event_row.retry_endpoints
        else '{}'
      end,
      last_error = null
  where order_id = p_order_id;

  insert into public.order_notification_requeue_actions(
    order_id,
    shop_id,
    actor_user_id,
    previous_status,
    reason
  ) values (
    p_order_id,
    p_shop_id,
    auth.uid(),
    event_row.status,
    nullif(left(btrim(coalesce(p_reason, '')), 240), '')
  );

  return true;
end;
$$;

-- Protected push subscription mutation --------------------------------------

alter table public.push_subscriptions
  add column if not exists last_seen_at timestamptz not null default now();

revoke insert, update, delete on public.push_subscriptions
from public, anon, authenticated;

create or replace function public.register_push_subscription(
  p_user_id uuid,
  p_shop_id uuid,
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_endpoint text := btrim(coalesce(p_endpoint, ''));
  existing public.push_subscriptions;
  subscription_count integer;
  result_id uuid;
begin
  if current_user not in ('postgres', 'service_role') then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  if not exists (
    select 1
    from public.shop_members member
    join public.shops shop on shop.id = member.shop_id
    where member.shop_id = p_shop_id
      and member.user_id = p_user_id
      and member.active
      and shop.active
  ) then
    raise exception 'Active shop member access required' using errcode = '42501';
  end if;
  if length(normalized_endpoint) not between 1 and 2048
    or normalized_endpoint !~ '^https://[^[:space:]]+$'
    or length(coalesce(p_p256dh, '')) not between 1 and 512
    or length(coalesce(p_auth, '')) not between 1 and 512
    or length(coalesce(p_user_agent, '')) > 1024 then
    raise exception 'Invalid push subscription';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('push-subscription:' || p_shop_id::text || ':' || p_user_id::text, 0)
  );

  delete from public.push_subscriptions
  where user_id = p_user_id
    and shop_id = p_shop_id
    and last_seen_at < now() - interval '90 days';

  select * into existing
  from public.push_subscriptions
  where shop_id = p_shop_id and endpoint = normalized_endpoint
  for update;

  if found and existing.user_id <> p_user_id then
    raise exception 'Push endpoint is already registered';
  end if;

  if not found then
    select count(*)::integer into subscription_count
    from public.push_subscriptions
    where shop_id = p_shop_id and user_id = p_user_id;
    if subscription_count >= 5 then
      raise exception 'Push subscription limit reached';
    end if;
  end if;

  insert into public.push_subscriptions(
    user_id, shop_id, endpoint, p256dh, auth, user_agent, last_seen_at, updated_at
  ) values (
    p_user_id,
    p_shop_id,
    normalized_endpoint,
    p_p256dh,
    p_auth,
    nullif(left(coalesce(p_user_agent, ''), 1024), ''),
    now(),
    now()
  )
  on conflict (shop_id, endpoint) do update
  set p256dh = excluded.p256dh,
      auth = excluded.auth,
      user_agent = excluded.user_agent,
      last_seen_at = now(),
      updated_at = now()
  where public.push_subscriptions.user_id = p_user_id
  returning id into result_id;

  if result_id is null then raise exception 'Push subscription conflict'; end if;
  return result_id;
end;
$$;

create or replace function public.unregister_push_subscription(
  p_user_id uuid,
  p_shop_id uuid,
  p_endpoint text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_user not in ('postgres', 'service_role') then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  delete from public.push_subscriptions
  where user_id = p_user_id
    and shop_id = p_shop_id
    and endpoint = btrim(coalesce(p_endpoint, ''));
  return found;
end;
$$;

create or replace function public.get_active_push_subscriptions(
  p_shop_id uuid,
  p_limit integer default 100
)
returns table(endpoint text, p256dh text, auth text)
language sql
stable
security definer
set search_path = ''
as $$
  select subscription.endpoint, subscription.p256dh, subscription.auth
  from public.push_subscriptions subscription
  join public.shop_members member
    on member.shop_id = subscription.shop_id
   and member.user_id = subscription.user_id
   and member.active
  join public.shops shop
    on shop.id = subscription.shop_id
   and shop.active
  where subscription.shop_id = p_shop_id
  order by subscription.updated_at desc, subscription.id
  limit greatest(1, least(coalesce(p_limit, 100), 100));
$$;

create or replace function public.touch_push_subscriptions(
  p_shop_id uuid,
  p_endpoints text[]
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  touched integer;
begin
  update public.push_subscriptions
  set last_seen_at = now()
  where shop_id = p_shop_id
    and endpoint = any(coalesce(p_endpoints, '{}'));
  get diagnostics touched = row_count;
  return touched;
end;
$$;

create index if not exists push_subscriptions_last_seen_idx
  on public.push_subscriptions(last_seen_at, id);

create or replace function private.cleanup_member_push_subscriptions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' or (old.active and not new.active) then
    delete from public.push_subscriptions
    where shop_id = old.shop_id and user_id = old.user_id;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger cleanup_member_push_subscriptions
after update of active or delete on public.shop_members
for each row execute function private.cleanup_member_push_subscriptions();

create or replace function public.cleanup_stale_push_subscriptions(
  p_retention_days integer default 90,
  p_batch_size integer default 1000
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count integer;
begin
  if current_user not in ('postgres', 'service_role') then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  with stale as (
    select id
    from public.push_subscriptions
    where last_seen_at < now() - make_interval(
      days => greatest(30, least(coalesce(p_retention_days, 90), 365))
    )
    order by last_seen_at, id
    limit greatest(1, least(coalesce(p_batch_size, 1000), 5000))
  ), deleted as (
    delete from public.push_subscriptions subscription
    using stale
    where subscription.id = stale.id
    returning subscription.id
  )
  select count(*)::integer into deleted_count from deleted;
  return deleted_count;
end;
$$;

-- Checkout abuse controls ----------------------------------------------------

alter table private.checkout_reservation_clients
  add column if not exists ip_hash text,
  add column if not exists device_hash text;
update private.checkout_reservation_clients
set ip_hash = coalesce(ip_hash, fingerprint_hash),
    device_hash = coalesce(device_hash, fingerprint_hash)
where ip_hash is null or device_hash is null;
alter table private.checkout_reservation_clients
  alter column device_hash set not null,
  add constraint checkout_reservation_clients_ip_hash_check
    check (ip_hash is null or ip_hash ~ '^[0-9a-f]{64}$'),
  add constraint checkout_reservation_clients_device_hash_check
    check (device_hash ~ '^[0-9a-f]{64}$');
create index if not exists checkout_reservation_clients_ip_recent_idx
  on private.checkout_reservation_clients(shop_id, ip_hash, created_at desc);
create index if not exists checkout_reservation_clients_device_recent_idx
  on private.checkout_reservation_clients(shop_id, device_hash, created_at desc);
create index if not exists checkout_reservation_clients_shop_recent_idx
  on private.checkout_reservation_clients(shop_id, created_at desc);

create or replace function public.create_order_rate_limited(
  p_shop_slug text,
  p_customer_name text,
  p_items jsonb,
  p_client_request_id uuid,
  p_recovery_token text,
  p_fingerprint_hash text,
  p_device_hash text,
  p_ip_hash text
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
  v_identity_pending integer;
  v_identity_recent integer;
  v_identity_expired integer;
  v_device_pending integer;
  v_device_recent integer;
  v_device_expired integer;
  v_ip_pending integer;
  v_ip_recent integer;
  v_shop_pending integer;
  v_shop_recent integer;
  v_order record;
begin
  if p_fingerprint_hash is null or p_fingerprint_hash !~ '^[0-9a-f]{64}$'
    or p_device_hash is null or p_device_hash !~ '^[0-9a-f]{64}$'
    or (p_ip_hash is not null and p_ip_hash !~ '^[0-9a-f]{64}$') then
    raise exception 'Invalid checkout identity';
  end if;

  select shop.id into v_shop_id
  from public.shops shop
  where shop.slug = lower(btrim(p_shop_slug)) and shop.active;
  if v_shop_id is null then raise exception 'Shop not found or inactive'; end if;

  if p_ip_hash is not null then
    perform pg_advisory_xact_lock(hashtextextended(
      'checkout-ip:' || v_shop_id::text || ':' || p_ip_hash,
      0
    ));
  end if;
  perform pg_advisory_xact_lock(hashtextextended(
    'checkout-device:' || v_shop_id::text || ':' || p_device_hash,
    0
  ));
  perform pg_advisory_xact_lock(hashtextextended(
    'checkout-identity:' || v_shop_id::text || ':' || p_fingerprint_hash,
    0
  ));

  select exists(
    select 1 from public.orders existing_order
    where existing_order.client_request_id = p_client_request_id
  ) into v_existing_order;

  if not v_existing_order then
    select count(*)::integer into v_identity_pending
    from (
      select 1
      from private.checkout_reservation_clients client
      join public.orders existing_order on existing_order.id = client.order_id
      where client.shop_id = v_shop_id
        and client.fingerprint_hash = p_fingerprint_hash
        and client.created_at > now() - private.reservation_duration() - interval '1 minute'
        and existing_order.status = 'pending'
        and existing_order.expires_at > now()
      limit 4
    ) bounded;
    if v_identity_pending >= 4 then
      raise exception 'Too many active checkout reservations. Complete or cancel an existing order first.';
    end if;

    select count(*)::integer into v_identity_recent
    from (
      select 1 from private.checkout_reservation_clients client
      where client.shop_id = v_shop_id
        and client.fingerprint_hash = p_fingerprint_hash
        and client.created_at > now() - interval '10 minutes'
      limit 12
    ) bounded;
    if v_identity_recent >= 12 then
      raise exception 'Too many checkout attempts. Please wait a few minutes and try again.';
    end if;

    select count(*)::integer into v_identity_expired
    from (
      select 1
      from private.checkout_reservation_clients client
      join public.orders existing_order on existing_order.id = client.order_id
      where client.shop_id = v_shop_id
        and client.fingerprint_hash = p_fingerprint_hash
        and client.created_at > now() - interval '24 hours'
        and existing_order.status = 'expired'
      limit 3
    ) bounded;
    if v_identity_expired >= 3 then
      raise exception 'Too many expired checkout reservations. Please wait before trying again.';
    end if;

    select count(*)::integer into v_device_pending
    from (
      select 1
      from private.checkout_reservation_clients client
      join public.orders existing_order on existing_order.id = client.order_id
      where client.shop_id = v_shop_id
        and client.device_hash = p_device_hash
        and client.created_at > now() - private.reservation_duration() - interval '1 minute'
        and existing_order.status = 'pending'
        and existing_order.expires_at > now()
      limit 4
    ) bounded;
    select count(*)::integer into v_device_recent
    from (
      select 1
      from private.checkout_reservation_clients client
      where client.shop_id = v_shop_id
        and client.device_hash = p_device_hash
        and client.created_at > now() - interval '10 minutes'
      limit 12
    ) bounded;
    select count(*)::integer into v_device_expired
    from (
      select 1
      from private.checkout_reservation_clients client
      join public.orders existing_order on existing_order.id = client.order_id
      where client.shop_id = v_shop_id
        and client.device_hash = p_device_hash
        and client.created_at > now() - interval '24 hours'
        and existing_order.status = 'expired'
      limit 3
    ) bounded;
    if v_device_pending >= 4 or v_device_recent >= 12 or v_device_expired >= 3 then
      raise exception 'Too many checkout attempts. Please wait a few minutes and try again.';
    end if;

    if p_ip_hash is not null then
      select count(*)::integer into v_ip_pending
      from (
        select 1
        from private.checkout_reservation_clients client
        join public.orders existing_order on existing_order.id = client.order_id
        where client.shop_id = v_shop_id
          and client.ip_hash = p_ip_hash
          and client.created_at > now() - private.reservation_duration() - interval '1 minute'
          and existing_order.status = 'pending'
          and existing_order.expires_at > now()
        limit 8
      ) bounded;
      select count(*)::integer into v_ip_recent
      from (
        select 1
        from private.checkout_reservation_clients client
        where client.shop_id = v_shop_id
          and client.ip_hash = p_ip_hash
          and client.created_at > now() - interval '10 minutes'
        limit 30
      ) bounded;
      if v_ip_pending >= 8 or v_ip_recent >= 30 then
        raise exception 'Too many checkout attempts. Please wait a few minutes and try again.';
      end if;
    end if;

    -- Serialize only the final shop-cap check and order transaction. Identity
    -- checks above still run concurrently, while the cap cannot be overrun by
    -- many distinct devices racing the same snapshot.
    perform pg_advisory_xact_lock(hashtextextended(
      'checkout-shop-cap:' || v_shop_id::text,
      0
    ));

    select count(*)::integer into v_shop_pending
    from (
      select 1
      from public.orders existing_order
      where existing_order.shop_id = v_shop_id
        and existing_order.status = 'pending'
        and existing_order.expires_at > now()
      limit 120
    ) bounded;
    if v_shop_pending >= 120 then
      raise exception 'Checkout is temporarily busy. Please try again shortly.';
    end if;

    select count(*)::integer into v_shop_recent
    from (
      select 1
      from private.checkout_reservation_clients client
      where client.shop_id = v_shop_id
        and client.created_at > now() - interval '10 minutes'
      limit 500
    ) bounded;
    if v_shop_recent >= 500 then
      raise exception 'Checkout is temporarily busy. Please try again shortly.';
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
    order_id, client_request_id, shop_id, fingerprint_hash, device_hash, ip_hash
  ) values (
    v_order.id, p_client_request_id, v_shop_id, p_fingerprint_hash,
    p_device_hash, p_ip_hash
  )
  on conflict (order_id) do nothing;

  if v_order.status = 'pending' then
    perform public.enqueue_order_notification(v_order.id, v_shop_id);
  end if;

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

-- Preserve the previous Edge Function contract for one rollback window.
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
language sql
security definer
set search_path = ''
as $$
  select *
  from public.create_order_rate_limited(
    p_shop_slug,
    p_customer_name,
    p_items,
    p_client_request_id,
    p_recovery_token,
    p_fingerprint_hash,
    p_fingerprint_hash,
    p_fingerprint_hash
  );
$$;

-- Public storefront bootstrap ------------------------------------------------

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

-- Least privilege ------------------------------------------------------------

revoke all on function public.enqueue_order_notification(uuid, uuid),
  public.create_order_rate_limited(text, text, jsonb, uuid, text, text),
  public.create_order_rate_limited(text, text, jsonb, uuid, text, text, text, text),
  public.claim_order_notification_delivery(uuid, uuid),
  public.claim_order_notification_batch(integer),
  public.complete_order_notification_delivery(uuid, uuid, boolean, text, text[]),
  public.complete_order_notification_delivery(uuid, uuid, boolean, text, text[], integer),
  public.archive_order_notification_events(integer, integer),
  public.request_order_notification_drain(),
  public.get_active_push_subscriptions(uuid, integer),
  public.touch_push_subscriptions(uuid, text[]),
  public.register_push_subscription(uuid, uuid, text, text, text, text),
  public.unregister_push_subscription(uuid, uuid, text),
  public.cleanup_stale_push_subscriptions(integer, integer)
from public, anon, authenticated;

grant execute on function public.enqueue_order_notification(uuid, uuid),
  public.create_order_rate_limited(text, text, jsonb, uuid, text, text),
  public.create_order_rate_limited(text, text, jsonb, uuid, text, text, text, text),
  public.claim_order_notification_delivery(uuid, uuid),
  public.claim_order_notification_batch(integer),
  public.complete_order_notification_delivery(uuid, uuid, boolean, text, text[]),
  public.complete_order_notification_delivery(uuid, uuid, boolean, text, text[], integer),
  public.archive_order_notification_events(integer, integer),
  public.request_order_notification_drain(),
  public.get_active_push_subscriptions(uuid, integer),
  public.touch_push_subscriptions(uuid, text[]),
  public.register_push_subscription(uuid, uuid, text, text, text, text),
  public.unregister_push_subscription(uuid, uuid, text),
  public.cleanup_stale_push_subscriptions(integer, integer)
to service_role;

revoke all on function public.get_order_notification_status(uuid, integer)
from public, anon, authenticated;
grant execute on function public.get_order_notification_status(uuid, integer)
to authenticated;

revoke all on function public.retry_order_notification(uuid, uuid, text)
from public, anon, authenticated;
grant execute on function public.retry_order_notification(uuid, uuid, text)
to authenticated;

revoke all on function public.configure_order_notification_drain_schedule()
from public, anon, authenticated;
grant execute on function public.configure_order_notification_drain_schedule()
to service_role;

revoke all on function public.get_storefront_bootstrap(text)
from public, anon, authenticated;
grant execute on function public.get_storefront_bootstrap(text)
to anon, authenticated;

do $$
begin
  if exists(select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname in (
      'drain-order-notification-queue',
      'archive-order-notification-events',
      'cleanup-stale-push-subscriptions'
    );
    if (select count(distinct name) = 2 from vault.decrypted_secrets
        where name in ('notification_worker_url', 'notification_worker_secret')) then
      perform public.configure_order_notification_drain_schedule();
    end if;
    perform cron.schedule(
      'archive-order-notification-events',
      '17 3 * * *',
      'select public.archive_order_notification_events(30, 500);'
    );
    perform cron.schedule(
      'cleanup-stale-push-subscriptions',
      '47 3 * * *',
      'select public.cleanup_stale_push_subscriptions(90, 1000);'
    );
  end if;
end
$$;

notify pgrst, 'reload schema';
