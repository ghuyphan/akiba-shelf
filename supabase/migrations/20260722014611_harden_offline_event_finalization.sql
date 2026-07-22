-- Preserve exact server receipts for finalization retries and isolate sessions
-- created before the server-authoritative Event Mode contract.
alter table public.offline_event_sessions
  add column integrity_version smallint not null default 1,
  add constraint offline_event_sessions_integrity_version_check
    check (integrity_version in (1, 2));
alter table public.offline_event_sessions
  alter column integrity_version set default 2;

alter function public.sync_offline_event_orders(uuid, uuid, jsonb)
  rename to sync_offline_event_orders_integrity_core;

create function public.sync_offline_event_orders(
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
begin
  select * into event_session
  from public.offline_event_sessions
  where id = p_session_id and device_id = p_device_id;
  if event_session.id is null then raise exception 'Offline event not found'; end if;
  if auth.uid() is null or not private.is_shop_member(event_session.shop_id) then
    raise exception 'Active shop access required' using errcode = '42501';
  end if;
  if jsonb_typeof(p_orders) <> 'array' or jsonb_array_length(p_orders) > 500 then
    raise exception 'Offline order batch is invalid';
  end if;
  if event_session.integrity_version = 1 and exists (
    select 1
    from jsonb_to_recordset(p_orders) submitted(id uuid)
    left join public.offline_event_orders stored
      on stored.session_id = event_session.id and stored.id = submitted.id
    where submitted.id is null or stored.id is null
  ) then
    raise exception 'Legacy offline event contains orders that require manual reconciliation';
  end if;
  return public.sync_offline_event_orders_integrity_core(
    p_session_id,
    p_device_id,
    p_orders
  );
end;
$$;

create table public.offline_event_finalization_receipts (
  session_id uuid not null references public.offline_event_sessions(id) on delete cascade,
  order_id uuid not null references public.offline_event_orders(id) on delete cascade,
  client_revision bigint not null check (client_revision >= 0),
  finalized_at timestamptz not null default now(),
  primary key (session_id, order_id)
);

alter table public.offline_event_finalization_receipts enable row level security;
revoke all on public.offline_event_finalization_receipts
from public, anon, authenticated;
grant select, insert, update, delete
on public.offline_event_finalization_receipts to service_role;

insert into public.offline_event_finalization_receipts(
  session_id,
  order_id,
  client_revision,
  finalized_at
)
select event_order.session_id,
  event_order.id,
  event_order.client_revision,
  coalesce(event_session.closed_at, event_order.synced_at, event_order.updated_at)
from public.offline_event_orders event_order
join public.offline_event_sessions event_session
  on event_session.id = event_order.session_id
where event_session.status = 'closed'
on conflict (session_id, order_id) do nothing;

-- Existing legacy rows are grandfathered as stored server state. During the
-- final close, transition-only updates use their persisted items and totals so
-- bad historical client prices cannot prevent cancellation and stock return.
create function private.reconcile_legacy_offline_event_orders(
  p_session_id uuid,
  p_orders jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_payload jsonb;
  existing_order public.offline_event_orders;
  incoming_id uuid;
  incoming_revision bigint;
  incoming_status text;
  incoming_payment_state text;
  incoming_updated_at timestamptz;
  incoming_fulfillment_status text;
  existing_fulfillment_rank integer;
  incoming_fulfillment_rank integer;
  remaining_orders jsonb := '[]'::jsonb;
  acknowledgements jsonb := '{}'::jsonb;
begin
  for order_payload in select value from jsonb_array_elements(p_orders)
  loop
    incoming_id := (order_payload ->> 'id')::uuid;
    incoming_revision := (order_payload ->> 'client_revision')::bigint;
    incoming_status := order_payload ->> 'status';
    incoming_payment_state := order_payload ->> 'payment_state';
    incoming_updated_at := (order_payload ->> 'updated_at')::timestamptz;
    incoming_fulfillment_status := coalesce(
      order_payload ->> 'fulfillment_status',
      case when incoming_status = 'confirmed' then 'preparing' else 'unfulfilled' end
    );
    if incoming_id is null or incoming_revision is null or incoming_revision < 0
      or incoming_status not in ('pending', 'confirmed', 'cancelled')
      or incoming_updated_at is null then
      raise exception 'Offline order fields are invalid';
    end if;

    select * into existing_order
    from public.offline_event_orders
    where id = incoming_id and session_id = p_session_id
    for update;
    if existing_order.id is null then
      remaining_orders := remaining_orders || jsonb_build_array(order_payload);
      continue;
    end if;
    if incoming_revision < existing_order.client_revision then
      acknowledgements := acknowledgements || jsonb_build_object(
        incoming_id::text,
        existing_order.client_revision
      );
      continue;
    end if;
    if existing_order.status = 'confirmed' and incoming_status <> 'confirmed' then
      raise exception 'Confirmed offline orders are immutable';
    end if;
    if existing_order.status = 'cancelled' and incoming_status <> 'cancelled' then
      raise exception 'Cancelled offline orders cannot be reopened';
    end if;
    if not private.offline_payment_state_valid(
      existing_order.payment_method,
      incoming_payment_state,
      incoming_status
    ) then
      raise exception 'Offline order fields are invalid';
    end if;

    if existing_order.status <> 'cancelled' and incoming_status = 'cancelled' then
      if exists (
        select 1
        from public.offline_event_order_items item
        left join public.offline_event_allocations allocation
          on allocation.session_id = item.session_id
         and allocation.product_id = item.product_id
        where item.order_id = existing_order.id
          and (
            allocation.product_id is null
            or allocation.quantity_sold < item.quantity
          )
      ) then
        raise exception 'Legacy offline allocation reconciliation failed';
      end if;
      update public.offline_event_allocations allocation
      set quantity_sold = allocation.quantity_sold - item.quantity
      from public.offline_event_order_items item
      where item.order_id = existing_order.id
        and allocation.session_id = item.session_id
        and allocation.product_id = item.product_id;
    end if;

    existing_fulfillment_rank := case existing_order.fulfillment_status
      when 'preparing' then 1 when 'ready' then 2 when 'picked_up' then 3 else 0 end;
    incoming_fulfillment_rank := case incoming_fulfillment_status
      when 'preparing' then 1 when 'ready' then 2 when 'picked_up' then 3 else 0 end;
    update public.offline_event_orders
    set status = incoming_status,
        payment_state = incoming_payment_state,
        confirmed_at = coalesce(
          existing_order.confirmed_at,
          case when incoming_status = 'confirmed' then incoming_updated_at end
        ),
        cancelled_at = coalesce(
          existing_order.cancelled_at,
          case when incoming_status = 'cancelled' then incoming_updated_at end
        ),
        fulfillment_status = case
          when incoming_status = 'confirmed'
            and incoming_fulfillment_rank > existing_fulfillment_rank
            then incoming_fulfillment_status
          else existing_order.fulfillment_status
        end,
        fulfillment_updated_at = case
          when incoming_status = 'confirmed'
            and incoming_fulfillment_rank > existing_fulfillment_rank
            then greatest(
              existing_order.fulfillment_updated_at,
              (order_payload ->> 'fulfillment_updated_at')::timestamptz
            )
          else existing_order.fulfillment_updated_at
        end,
        confirmed_by_label = coalesce(
          existing_order.confirmed_by_label,
          nullif(order_payload ->> 'confirmed_by_label', '')
        ),
        cancelled_by_label = coalesce(
          existing_order.cancelled_by_label,
          nullif(order_payload ->> 'cancelled_by_label', '')
        ),
        fulfillment_updated_by_label = case
          when incoming_status = 'confirmed'
            and incoming_fulfillment_rank > existing_fulfillment_rank
            then nullif(order_payload ->> 'fulfillment_updated_by_label', '')
          else existing_order.fulfillment_updated_by_label
        end,
        client_revision = incoming_revision,
        updated_at = greatest(existing_order.updated_at, incoming_updated_at),
        synced_at = now()
    where id = existing_order.id;
    acknowledgements := acknowledgements || jsonb_build_object(
      incoming_id::text,
      incoming_revision
    );
  end loop;
  return jsonb_build_object(
    'orders', remaining_orders,
    'acknowledged_revisions', acknowledgements
  );
end;
$$;

create or replace function public.finalize_offline_event_session(
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
  sync_result jsonb;
  close_result jsonb;
  legacy_result jsonb;
  remaining_orders jsonb;
  acknowledgements jsonb := '{}'::jsonb;
  receipt_acknowledgements jsonb := '{}'::jsonb;
begin
  select * into event_session
  from public.offline_event_sessions
  where id = p_session_id and device_id = p_device_id
  for update;
  if event_session.id is null then raise exception 'Offline event not found'; end if;
  if auth.uid() is null
    or not private.has_shop_role(event_session.shop_id, array['owner', 'admin']) then
    raise exception 'Active shop owner or admin access required' using errcode = '42501';
  end if;
  if jsonb_typeof(p_orders) <> 'array' or jsonb_array_length(p_orders) > 500 then
    raise exception 'Offline order batch is invalid';
  end if;
  if (select count(*) from jsonb_to_recordset(p_orders) submitted(id uuid)) <>
    (select count(distinct submitted.id) from jsonb_to_recordset(p_orders) submitted(id uuid)
      where submitted.id is not null) then
    raise exception 'Offline order batch contains duplicate or invalid identifiers';
  end if;

  if event_session.status = 'closed' then
    select coalesce(
      jsonb_object_agg(receipt.order_id::text, receipt.client_revision),
      '{}'::jsonb
    ) into receipt_acknowledgements
    from public.offline_event_finalization_receipts receipt
    where receipt.session_id = event_session.id;
    return jsonb_build_object(
      'sync', jsonb_build_object(
        'inserted', 0,
        'updated', 0,
        'stale', 0,
        'acknowledged_revisions', receipt_acknowledgements
      ),
      'status', 'closed'
    );
  end if;

  if event_session.integrity_version = 1 then
    legacy_result := private.reconcile_legacy_offline_event_orders(
      p_session_id,
      p_orders
    );
    remaining_orders := legacy_result -> 'orders';
    acknowledgements := coalesce(
      legacy_result -> 'acknowledged_revisions',
      '{}'::jsonb
    );
    if jsonb_array_length(remaining_orders) > 0 then
      raise exception 'Legacy offline event contains orders that require manual reconciliation';
    end if;
  else
    sync_result := public.sync_offline_event_orders(p_session_id, p_device_id, p_orders);
    acknowledgements := coalesce(
      sync_result -> 'acknowledged_revisions',
      '{}'::jsonb
    );
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_orders) submitted(id uuid, client_revision bigint)
    where submitted.id is null or submitted.client_revision is null
      or (acknowledgements ->> submitted.id::text)::bigint
        is distinct from submitted.client_revision
  ) then
    raise exception 'Offline finalization acknowledgements are incomplete';
  end if;

  close_result := public.close_offline_event_session(p_session_id, p_device_id);
  insert into public.offline_event_finalization_receipts(
    session_id,
    order_id,
    client_revision
  )
  select event_order.session_id, event_order.id, event_order.client_revision
  from public.offline_event_orders event_order
  where event_order.session_id = p_session_id
  on conflict (session_id, order_id) do update
  set client_revision = excluded.client_revision,
      finalized_at = now();

  select coalesce(
    jsonb_object_agg(receipt.order_id::text, receipt.client_revision),
    '{}'::jsonb
  ) into receipt_acknowledgements
  from public.offline_event_finalization_receipts receipt
  where receipt.session_id = p_session_id;
  return jsonb_build_object(
    'sync', jsonb_build_object(
      'inserted', coalesce((sync_result ->> 'inserted')::integer, 0),
      'updated', coalesce((sync_result ->> 'updated')::integer, 0),
      'stale', coalesce((sync_result ->> 'stale')::integer, 0),
      'acknowledged_revisions', receipt_acknowledgements
    ),
    'status', close_result ->> 'status'
  );
end;
$$;

revoke all on function private.reconcile_legacy_offline_event_orders(uuid, jsonb)
from public, anon, authenticated;
revoke all on function public.sync_offline_event_orders_integrity_core(uuid, uuid, jsonb)
from public, anon, authenticated;
revoke all on function public.sync_offline_event_orders(uuid, uuid, jsonb)
from public, anon, authenticated;
revoke all on function public.close_offline_event_session(uuid, uuid)
from public, anon, authenticated;
revoke all on function public.finalize_offline_event_session(uuid, uuid, jsonb)
from public, anon, authenticated;
grant execute on function public.finalize_offline_event_session(uuid, uuid, jsonb)
to authenticated;
grant execute on function public.sync_offline_event_orders(uuid, uuid, jsonb)
to authenticated;

notify pgrst, 'reload schema';
