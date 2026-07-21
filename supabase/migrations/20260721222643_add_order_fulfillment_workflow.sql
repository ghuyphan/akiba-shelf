-- Separate payment confirmation from fulfilment while preserving monotonic,
-- idempotent transitions for both online and Offline Event Mode orders.

alter table public.orders
  add column fulfillment_status text not null default 'unfulfilled',
  add column fulfillment_updated_at timestamptz,
  add column fulfillment_updated_by uuid references auth.users(id) on delete set null,
  add column confirmed_by_email text,
  add column cancelled_by_email text,
  add column fulfillment_updated_by_email text;

update public.orders
set fulfillment_status = 'preparing',
    fulfillment_updated_at = coalesce(confirmed_at, updated_at)
where status = 'confirmed';

alter table public.orders
  add constraint orders_fulfillment_status_check
    check (fulfillment_status in ('unfulfilled', 'preparing', 'ready', 'picked_up')),
  add constraint orders_actor_email_length_check
    check (
      length(coalesce(confirmed_by_email, '')) <= 320
      and length(coalesce(cancelled_by_email, '')) <= 320
      and length(coalesce(fulfillment_updated_by_email, '')) <= 320
    );

create index orders_fulfillment_updated_by_idx
  on public.orders (fulfillment_updated_by)
  where fulfillment_updated_by is not null;

grant select(
  fulfillment_status,
  fulfillment_updated_at,
  confirmed_by_email,
  cancelled_by_email,
  fulfillment_updated_by_email
) on public.orders to authenticated;

alter table public.offline_event_orders
  add column fulfillment_status text not null default 'unfulfilled',
  add column fulfillment_updated_at timestamptz,
  add column confirmed_by_label text,
  add column cancelled_by_label text,
  add column fulfillment_updated_by_label text;

update public.offline_event_orders
set fulfillment_status = 'preparing',
    fulfillment_updated_at = updated_at
where status = 'confirmed';

alter table public.offline_event_orders
  add constraint offline_event_orders_fulfillment_status_check
    check (fulfillment_status in ('unfulfilled', 'preparing', 'ready', 'picked_up')),
  add constraint offline_event_orders_actor_label_length_check
    check (
      length(coalesce(confirmed_by_label, '')) <= 320
      and length(coalesce(cancelled_by_label, '')) <= 320
      and length(coalesce(fulfillment_updated_by_label, '')) <= 320
    );

create or replace function public.confirm_order_payment(target_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_row public.orders;
  actor_email text := lower(nullif(auth.jwt() ->> 'email', ''));
begin
  select * into order_row from public.orders where id = target_order_id for update;
  if not found then return jsonb_build_object('outcome', 'not_found', 'order', null); end if;
  if not private.is_shop_member(order_row.shop_id) then
    raise exception 'Active shop membership required' using errcode = '42501';
  end if;
  if order_row.status = 'confirmed' then return jsonb_build_object('outcome', 'already_confirmed', 'order', to_jsonb(order_row) - 'recovery_token_hash'); end if;
  if order_row.status = 'cancelled' then return jsonb_build_object('outcome', 'already_cancelled', 'order', to_jsonb(order_row) - 'recovery_token_hash'); end if;
  if order_row.status = 'expired' then return jsonb_build_object('outcome', 'already_expired', 'order', to_jsonb(order_row) - 'recovery_token_hash'); end if;
  if order_row.expires_at <= now() then
    order_row := private.release_reservation(order_row.id, 'expired');
    return jsonb_build_object('outcome', 'expired', 'order', to_jsonb(order_row) - 'recovery_token_hash');
  end if;
  update public.orders
  set status = 'confirmed',
      confirmed_at = now(),
      confirmed_by = auth.uid(),
      confirmed_by_email = actor_email,
      fulfillment_status = 'preparing',
      fulfillment_updated_at = now(),
      fulfillment_updated_by = auth.uid(),
      fulfillment_updated_by_email = actor_email
  where id = order_row.id
  returning * into order_row;
  return jsonb_build_object('outcome', 'confirmed', 'order', to_jsonb(order_row) - 'recovery_token_hash');
end;
$$;

create or replace function public.cancel_order(target_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_row public.orders;
begin
  select * into order_row from public.orders where id = target_order_id for update;
  if not found then return jsonb_build_object('outcome', 'not_found', 'order', null); end if;
  if not private.is_shop_member(order_row.shop_id) then
    raise exception 'Active shop membership required' using errcode = '42501';
  end if;
  if order_row.status = 'cancelled' then return jsonb_build_object('outcome', 'already_cancelled', 'order', to_jsonb(order_row) - 'recovery_token_hash'); end if;
  if order_row.status = 'confirmed' then return jsonb_build_object('outcome', 'already_confirmed', 'order', to_jsonb(order_row) - 'recovery_token_hash'); end if;
  if order_row.status = 'expired' then return jsonb_build_object('outcome', 'already_expired', 'order', to_jsonb(order_row) - 'recovery_token_hash'); end if;
  order_row := private.release_reservation(order_row.id, 'cancelled', auth.uid());
  update public.orders
  set cancelled_by_email = lower(nullif(auth.jwt() ->> 'email', ''))
  where id = order_row.id
  returning * into order_row;
  return jsonb_build_object('outcome', 'cancelled', 'order', to_jsonb(order_row) - 'recovery_token_hash');
end;
$$;

create function public.update_order_fulfillment(
  target_order_id uuid,
  next_status text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_row public.orders;
  current_rank integer;
  next_rank integer;
begin
  select * into order_row from public.orders where id = target_order_id for update;
  if not found then return jsonb_build_object('outcome', 'not_found', 'order', null); end if;
  if not private.is_shop_member(order_row.shop_id) then
    raise exception 'Active shop membership required' using errcode = '42501';
  end if;
  if order_row.status <> 'confirmed' then
    return jsonb_build_object('outcome', 'invalid_order_state', 'order', to_jsonb(order_row) - 'recovery_token_hash');
  end if;
  current_rank := case order_row.fulfillment_status when 'preparing' then 1 when 'ready' then 2 when 'picked_up' then 3 else 0 end;
  next_rank := case next_status when 'ready' then 2 when 'picked_up' then 3 else -1 end;
  if next_rank = -1 or next_rank < current_rank then
    return jsonb_build_object('outcome', 'invalid_transition', 'order', to_jsonb(order_row) - 'recovery_token_hash');
  end if;
  if next_rank = current_rank then
    return jsonb_build_object('outcome', 'unchanged', 'order', to_jsonb(order_row) - 'recovery_token_hash');
  end if;
  update public.orders
  set fulfillment_status = next_status,
      fulfillment_updated_at = now(),
      fulfillment_updated_by = auth.uid(),
      fulfillment_updated_by_email = lower(nullif(auth.jwt() ->> 'email', ''))
  where id = order_row.id
  returning * into order_row;
  return jsonb_build_object('outcome', 'updated', 'order', to_jsonb(order_row) - 'recovery_token_hash');
end;
$$;

create or replace function public.sync_offline_event_orders(
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
  incoming_fulfillment_status text;
  existing_fulfillment_rank integer;
  incoming_fulfillment_rank integer;
  item_quantity integer;
  inserted_count integer := 0;
  updated_count integer := 0;
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
    incoming_fulfillment_status := coalesce(order_payload ->> 'fulfillment_status',
      case when order_status = 'confirmed' then 'preparing' else 'unfulfilled' end);
    if order_status not in ('pending', 'confirmed', 'cancelled')
      or incoming_fulfillment_status not in ('unfulfilled', 'preparing', 'ready', 'picked_up')
      or (order_status = 'confirmed' and incoming_fulfillment_status = 'unfulfilled')
      or (order_status <> 'confirmed' and incoming_fulfillment_status <> 'unfulfilled')
      or (order_payload ->> 'payment_method') not in ('cash', 'vietqr')
      or (order_payload ->> 'payment_state') not in ('awaiting_payment', 'cash_confirmed', 'bank_verification_pending', 'bank_confirmed')
      or (order_payload ->> 'total_amount')::integer < 0
      or length(coalesce(order_payload ->> 'order_code', '')) not between 4 and 32
      or length(coalesce(order_payload ->> 'customer_name', '')) > 30
      or length(coalesce(order_payload ->> 'confirmed_by_label', '')) > 320
      or length(coalesce(order_payload ->> 'cancelled_by_label', '')) > 320
      or length(coalesce(order_payload ->> 'fulfillment_updated_by_label', '')) > 320 then
      raise exception 'Offline order fields are invalid';
    end if;

    select * into existing_order from public.offline_event_orders
    where id = v_order_id and session_id = p_session_id for update;

    if existing_order.id is null then
      if order_status <> 'cancelled' then
        for item_payload in select value from jsonb_array_elements(order_payload -> 'items')
        loop
          item_quantity := (item_payload ->> 'quantity')::integer;
          if item_quantity <= 0 then raise exception 'Offline order quantity is invalid'; end if;
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
        fulfillment_updated_at, confirmed_by_label, cancelled_by_label,
        fulfillment_updated_by_label, created_at, updated_at
      ) values (
        v_order_id, p_session_id, event_session.shop_id,
        order_payload ->> 'order_code', nullif(btrim(order_payload ->> 'customer_name'), ''),
        (order_payload ->> 'total_amount')::integer, order_status,
        order_payload ->> 'payment_method', order_payload ->> 'payment_state',
        incoming_fulfillment_status, (order_payload ->> 'fulfillment_updated_at')::timestamptz,
        nullif(order_payload ->> 'confirmed_by_label', ''),
        nullif(order_payload ->> 'cancelled_by_label', ''),
        nullif(order_payload ->> 'fulfillment_updated_by_label', ''),
        (order_payload ->> 'created_at')::timestamptz,
        (order_payload ->> 'updated_at')::timestamptz
      );
      insert into public.offline_event_order_items(
        order_id, session_id, shop_id, product_id, quantity, unit_price, discount_amount
      )
      select v_order_id, p_session_id, event_session.shop_id,
        item ->> 'product_id', (item ->> 'quantity')::integer,
        (item ->> 'unit_price')::integer,
        coalesce((item ->> 'discount_amount')::integer, 0)
      from jsonb_array_elements(order_payload -> 'items') item;
      inserted_count := inserted_count + 1;
    else
      if existing_order.status = 'confirmed' and order_status <> 'confirmed' then raise exception 'Confirmed offline orders are immutable'; end if;
      if existing_order.status = 'cancelled' and order_status <> 'cancelled' then raise exception 'Cancelled offline orders cannot be reopened'; end if;
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
          payment_state = order_payload ->> 'payment_state',
          fulfillment_status = case when incoming_fulfillment_rank > existing_fulfillment_rank then incoming_fulfillment_status else existing_order.fulfillment_status end,
          fulfillment_updated_at = case when incoming_fulfillment_rank > existing_fulfillment_rank then (order_payload ->> 'fulfillment_updated_at')::timestamptz else existing_order.fulfillment_updated_at end,
          fulfillment_updated_by_label = case when incoming_fulfillment_rank > existing_fulfillment_rank then nullif(order_payload ->> 'fulfillment_updated_by_label', '') else existing_order.fulfillment_updated_by_label end,
          confirmed_by_label = coalesce(existing_order.confirmed_by_label, nullif(order_payload ->> 'confirmed_by_label', '')),
          cancelled_by_label = coalesce(existing_order.cancelled_by_label, nullif(order_payload ->> 'cancelled_by_label', '')),
          updated_at = greatest(existing_order.updated_at, (order_payload ->> 'updated_at')::timestamptz),
          synced_at = now()
      where id = existing_order.id;
      updated_count := updated_count + 1;
    end if;
  end loop;
  return jsonb_build_object('inserted', inserted_count, 'updated', updated_count);
end;
$$;

create or replace function public.get_offline_event_orders(
  p_shop_id uuid,
  p_page integer default 1,
  p_page_size integer default 12,
  p_status text default 'all',
  p_created_after timestamptz default null,
  p_created_before timestamptz default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.is_shop_member(p_shop_id) then raise exception 'Active shop access required' using errcode = '42501'; end if;
  if p_page < 1 or p_page_size not between 1 and 100 then raise exception 'Invalid order page'; end if;
  if p_status not in ('all', 'pending', 'confirmed', 'cancelled', 'expired') then raise exception 'Invalid order status'; end if;
  return (
    with base as (
      select event_order.* from public.offline_event_orders event_order
      where event_order.shop_id = p_shop_id
        and (p_created_after is null or event_order.created_at >= p_created_after)
        and (p_created_before is null or event_order.created_at < p_created_before)
    ), filtered as (
      select * from base where p_status = 'all' or status = p_status
    ), page_rows as (
      select jsonb_build_object(
        'id', event_order.id, 'shop_id', event_order.shop_id,
        'order_code', event_order.order_code, 'customer_name', event_order.customer_name,
        'total_amount', event_order.total_amount,
        'discount_amount', coalesce((select sum(item.discount_amount) from public.offline_event_order_items item where item.order_id = event_order.id), 0),
        'status', event_order.status, 'created_at', event_order.created_at,
        'updated_at', event_order.updated_at, 'expires_at', null,
        'confirmed_at', case when event_order.status = 'confirmed' then event_order.updated_at end,
        'cancelled_at', case when event_order.status = 'cancelled' then event_order.updated_at end,
        'expired_at', null, 'fulfillment_status', event_order.fulfillment_status,
        'fulfillment_updated_at', event_order.fulfillment_updated_at,
        'confirmed_by_email', event_order.confirmed_by_label,
        'cancelled_by_email', event_order.cancelled_by_label,
        'fulfillment_updated_by_email', event_order.fulfillment_updated_by_label,
        'source', 'offline_event', 'offline_event_session_id', event_order.session_id,
        'offline_event_name', event_session.name, 'payment_method', event_order.payment_method,
        'payment_state', event_order.payment_state,
        'order_items', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', item.order_id::text || ':' || item.product_id,
            'order_id', item.order_id, 'product_id', item.product_id,
            'quantity', item.quantity, 'unit_price', item.unit_price,
            'free_quantity', 0, 'discount_amount', item.discount_amount,
            'product', jsonb_build_object(
              'id', item.product_id,
              'name', coalesce(allocation.product_snapshot ->> 'name', item.product_id),
              'item_code', coalesce(allocation.product_snapshot ->> 'item_code', ''),
              'images', case when jsonb_typeof(allocation.product_snapshot -> 'images') = 'array' then allocation.product_snapshot -> 'images' else '[]'::jsonb end
            )
          ) order by item.product_id)
          from public.offline_event_order_items item
          left join public.offline_event_allocations allocation
            on allocation.session_id = item.session_id and allocation.product_id = item.product_id
          where item.order_id = event_order.id
        ), '[]'::jsonb)
      ) payload, event_order.created_at sort_created_at, event_order.id sort_id
      from filtered event_order
      join public.offline_event_sessions event_session on event_session.id = event_order.session_id
      order by event_order.created_at desc, event_order.id desc
      limit p_page_size offset (p_page - 1) * p_page_size
    )
    select jsonb_build_object(
      'orders', coalesce((select jsonb_agg(payload order by sort_created_at desc, sort_id desc) from page_rows), '[]'::jsonb),
      'total', (select count(*) from filtered),
      'counts', jsonb_build_object(
        'pending', (select count(*) from base where status = 'pending'),
        'confirmed', (select count(*) from base where status = 'confirmed'),
        'cancelled', (select count(*) from base where status = 'cancelled'),
        'expired', 0, 'all', (select count(*) from base)
      )
    )
  );
end;
$$;

revoke all on function public.update_order_fulfillment(uuid, text) from public, anon, authenticated;
grant execute on function public.update_order_fulfillment(uuid, text) to authenticated;

revoke all on function public.confirm_order_payment(uuid), public.cancel_order(uuid),
  public.sync_offline_event_orders(uuid, uuid, jsonb),
  public.get_offline_event_orders(uuid, integer, integer, text, timestamptz, timestamptz)
from public, anon, authenticated;
grant execute on function public.confirm_order_payment(uuid), public.cancel_order(uuid),
  public.sync_offline_event_orders(uuid, uuid, jsonb),
  public.get_offline_event_orders(uuid, integer, integer, text, timestamptz, timestamptz)
to authenticated;

notify pgrst, 'reload schema';
