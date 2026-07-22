-- Make Offline Event Mode server-authoritative while retaining the existing
-- RPC signatures for already-installed clients.

alter table public.offline_event_orders
  add column client_revision bigint not null default 0,
  add column confirmed_at timestamptz,
  add column cancelled_at timestamptz,
  add constraint offline_event_orders_client_revision_check
    check (client_revision >= 0);

update public.offline_event_orders
set confirmed_at = case when status = 'confirmed' then updated_at end,
    cancelled_at = case when status = 'cancelled' then updated_at end;

alter table public.offline_event_order_items
  add constraint offline_event_order_items_discount_limit_check
    check (discount_amount <= unit_price::bigint * quantity) not valid;

create or replace function private.sanitize_offline_product_snapshot(snapshot jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', snapshot ->> 'id',
    'shop_id', snapshot ->> 'shop_id',
    'name', coalesce(snapshot ->> 'name', ''),
    'collection', coalesce(snapshot ->> 'collection', ''),
    'description', coalesce(snapshot ->> 'description', ''),
    'price_vnd', coalesce((snapshot ->> 'price_vnd')::integer, 0),
    'sale_price_vnd', case when snapshot ? 'sale_price_vnd' then snapshot -> 'sale_price_vnd' else 'null'::jsonb end,
    'effective_price_vnd', coalesce(
      (snapshot ->> 'effective_price_vnd')::integer,
      (snapshot ->> 'sale_price_vnd')::integer,
      (snapshot ->> 'price_vnd')::integer,
      0
    ),
    'promotion_eligible', coalesce((snapshot ->> 'promotion_eligible')::boolean, false),
    'item_code', coalesce(snapshot ->> 'item_code', ''),
    'quantity_available', coalesce((snapshot ->> 'quantity_available')::integer, 0),
    'category', coalesce(snapshot ->> 'category', ''),
    'badge', snapshot -> 'badge',
    'badge_color', snapshot -> 'badge_color',
    'stock_status', coalesce(snapshot ->> 'stock_status', 'sold_out'),
    'stock_note', coalesce(snapshot ->> 'stock_note', ''),
    'images', case when jsonb_typeof(snapshot -> 'images') = 'array' then snapshot -> 'images' else '[]'::jsonb end,
    'image_variants', case when jsonb_typeof(snapshot -> 'image_variants') = 'array' then snapshot -> 'image_variants' else '[]'::jsonb end,
    'featured', coalesce((snapshot ->> 'featured')::boolean, false),
    'sort_order', coalesce((snapshot ->> 'sort_order')::integer, 0),
    'active', coalesce((snapshot ->> 'active')::boolean, false)
  )
$$;

create or replace function private.offline_product_snapshot(product public.products)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select private.sanitize_offline_product_snapshot(to_jsonb(product))
$$;

create or replace function private.offline_payment_state_valid(
  payment_method text,
  payment_state text,
  order_status text
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when payment_method = 'cash' and order_status = 'pending'
      then payment_state = 'awaiting_payment'
    when payment_method = 'cash' and order_status = 'confirmed'
      then payment_state = 'cash_confirmed'
    when payment_method = 'cash' and order_status = 'cancelled'
      then payment_state in ('awaiting_payment', 'cash_confirmed')
    when payment_method = 'vietqr' and order_status = 'pending'
      then payment_state in ('awaiting_payment', 'bank_verification_pending')
    when payment_method = 'vietqr' and order_status = 'confirmed'
      then payment_state = 'bank_confirmed'
    when payment_method = 'vietqr' and order_status = 'cancelled'
      then payment_state in ('awaiting_payment', 'bank_verification_pending', 'bank_confirmed')
    else false
  end
$$;

alter table public.offline_event_orders
  add constraint offline_event_orders_payment_state_matrix_check
    check (private.offline_payment_state_valid(payment_method, payment_state, status))
    not valid;

update public.offline_event_allocations
set product_snapshot = private.sanitize_offline_product_snapshot(product_snapshot);

create or replace function public.start_offline_event_session(
  p_shop_id uuid,
  p_device_id uuid,
  p_name text,
  p_allocations jsonb,
  p_payment_snapshot jsonb,
  p_promotion_snapshot jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_session public.offline_event_sessions;
  requested_count integer;
  product_row record;
  authoritative_payment jsonb;
  authoritative_promotion jsonb;
begin
  if auth.uid() is null
    or not private.has_shop_role(p_shop_id, array['owner', 'admin']) then
    raise exception 'Active shop owner or admin access required' using errcode = '42501';
  end if;
  if p_device_id is null then raise exception 'A device identifier is required'; end if;
  if length(btrim(coalesce(p_name, ''))) not between 1 and 80 then
    raise exception 'Event name must be between 1 and 80 characters';
  end if;
  if jsonb_typeof(p_allocations) <> 'array'
    or jsonb_array_length(p_allocations) not between 1 and 200 then
    raise exception 'Choose between 1 and 200 allocated products';
  end if;
  -- Retained for signature compatibility; stored snapshots are built below.
  if jsonb_typeof(p_payment_snapshot) <> 'object'
    or jsonb_typeof(p_promotion_snapshot) <> 'object' then
    raise exception 'Offline checkout settings are invalid';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('offline-event:' || p_shop_id::text, 0));
  if exists (select 1 from public.offline_event_sessions where shop_id = p_shop_id and status = 'active') then
    raise exception 'This shop already has an active offline event';
  end if;

  select count(*)::integer into requested_count
  from jsonb_to_recordset(p_allocations) item(product_id text, quantity integer);
  if requested_count <> (
    select count(distinct item.product_id)::integer
    from jsonb_to_recordset(p_allocations) item(product_id text, quantity integer)
  ) then
    raise exception 'Each product may only be allocated once';
  end if;

  -- Match checkout's product-id lock order to prevent cross-flow deadlocks.
  perform product.id
  from public.products product
  join jsonb_to_recordset(p_allocations) item(product_id text, quantity integer)
    on item.product_id = product.id
  where product.shop_id = p_shop_id
  order by product.id
  for update of product;

  if exists (
    select 1
    from jsonb_to_recordset(p_allocations) item(product_id text, quantity integer)
    left join public.products product
      on product.shop_id = p_shop_id and product.id = item.product_id
    where product.id is null or not product.active or item.quantity is null
      or item.quantity <= 0 or item.quantity > product.quantity_available
  ) then
    raise exception 'One or more offline allocations are invalid or exceed current stock';
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
  where payment.shop_id = p_shop_id;
  if authoritative_payment is null then raise exception 'Shop payment settings are missing'; end if;

  select jsonb_build_object(
    'shop_id', p_shop_id,
    'enabled', coalesce(promotion.enabled, false),
    'buy_quantity', coalesce(promotion.buy_quantity, 3),
    'free_quantity', coalesce(promotion.free_quantity, 1),
    'repeatable', coalesce(promotion.repeatable, true),
    'qualifying_product_ids', coalesce((
      select jsonb_agg(mapping.product_id order by mapping.product_id)
      from public.promotion_products mapping
      where mapping.shop_id = p_shop_id and mapping.role in ('qualifying', 'both')
    ), '[]'::jsonb),
    'reward_product_ids', coalesce((
      select jsonb_agg(mapping.product_id order by mapping.product_id)
      from public.promotion_products mapping
      where mapping.shop_id = p_shop_id and mapping.role in ('reward', 'both')
    ), '[]'::jsonb)
  ) into authoritative_promotion
  from (select 1) seed
  left join public.promotions promotion on promotion.shop_id = p_shop_id;

  insert into public.offline_event_sessions(
    shop_id, device_id, name, payment_snapshot, promotion_snapshot, created_by
  ) values (
    p_shop_id, p_device_id, btrim(p_name), authoritative_payment,
    authoritative_promotion, auth.uid()
  ) returning * into event_session;

  insert into public.offline_event_allocations(
    session_id, shop_id, product_id, quantity_allocated, product_snapshot
  )
  select event_session.id, p_shop_id, product.id, item.quantity,
    private.offline_product_snapshot(product)
  from jsonb_to_recordset(p_allocations) item(product_id text, quantity integer)
  join public.products product
    on product.shop_id = p_shop_id and product.id = item.product_id;

  for product_row in
    update public.products product
    set quantity_available = product.quantity_available - item.quantity
    from jsonb_to_recordset(p_allocations) item(product_id text, quantity integer)
    where product.shop_id = p_shop_id and product.id = item.product_id
    returning product.id
  loop
    perform private.sync_product_stock(product_row.id);
  end loop;

  return jsonb_build_object(
    'session', jsonb_build_object(
      'id', event_session.id,
      'shop_id', event_session.shop_id,
      'device_id', event_session.device_id,
      'name', event_session.name,
      'status', event_session.status,
      'payment_snapshot', event_session.payment_snapshot,
      'promotion_snapshot', event_session.promotion_snapshot,
      'created_at', event_session.created_at,
      'updated_at', event_session.updated_at
    ),
    'allocations', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'product_id', allocation.product_id,
        'quantity_allocated', allocation.quantity_allocated,
        'quantity_sold', allocation.quantity_sold,
        'product_snapshot', allocation.product_snapshot
      ) order by allocation.product_id), '[]'::jsonb)
      from public.offline_event_allocations allocation
      where allocation.session_id = event_session.id
    )
  );
end;
$$;

create or replace function public.get_active_offline_event_session(
  p_shop_id uuid,
  p_device_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare event_session public.offline_event_sessions;
begin
  if auth.uid() is null or not private.is_shop_member(p_shop_id) then
    raise exception 'Active shop access required' using errcode = '42501';
  end if;
  select * into event_session from public.offline_event_sessions
  where shop_id = p_shop_id and device_id = p_device_id and status = 'active';
  if event_session.id is null then return null; end if;
  return jsonb_build_object(
    'session', jsonb_build_object(
      'id', event_session.id,
      'shop_id', event_session.shop_id,
      'device_id', event_session.device_id,
      'name', event_session.name,
      'status', event_session.status,
      'payment_snapshot', event_session.payment_snapshot,
      'promotion_snapshot', event_session.promotion_snapshot,
      'created_at', event_session.created_at,
      'updated_at', event_session.updated_at
    ),
    'allocations', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'product_id', allocation.product_id,
        'quantity_allocated', allocation.quantity_allocated,
        'quantity_sold', allocation.quantity_sold,
        'product_snapshot', private.sanitize_offline_product_snapshot(allocation.product_snapshot)
      ) order by allocation.product_id), '[]'::jsonb)
      from public.offline_event_allocations allocation
      where allocation.session_id = event_session.id
    )
  );
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
        or item_discount < 0 or item_discount::bigint > item_price::bigint * item_quantity
        or (item_price > 0 and item_discount % item_price <> 0)
        or (item_price = 0 and item_discount <> 0) then
        raise exception 'Offline order pricing is invalid';
      end if;
      item_free_quantity := case when item_price = 0 then 0 else item_discount / item_price end;
      if item_free_quantity > 0 and not (
        (event_session.promotion_snapshot -> 'reward_product_ids') ? (item_payload ->> 'product_id')
      ) then
        raise exception 'Offline order contains an invalid reward item';
      end if;
      if (event_session.promotion_snapshot -> 'qualifying_product_ids') ? (item_payload ->> 'product_id') then
        qualifying_quantity := qualifying_quantity + item_quantity - item_free_quantity;
      end if;
      requested_rewards := requested_rewards + item_free_quantity;
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
  if auth.uid() is null or not private.is_shop_member(p_shop_id) then
    raise exception 'Active shop access required' using errcode = '42501';
  end if;
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
        'confirmed_at', event_order.confirmed_at,
        'cancelled_at', event_order.cancelled_at,
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

create or replace function public.close_offline_event_session(
  p_session_id uuid,
  p_device_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare event_session public.offline_event_sessions; allocation record;
begin
  select * into event_session from public.offline_event_sessions
  where id = p_session_id and device_id = p_device_id for update;
  if event_session.id is null then raise exception 'Offline event not found'; end if;
  if auth.uid() is null or not private.has_shop_role(event_session.shop_id, array['owner', 'admin']) then
    raise exception 'Active shop owner or admin access required' using errcode = '42501';
  end if;
  if event_session.status <> 'active' then return jsonb_build_object('status', event_session.status); end if;
  if exists (
    select 1 from public.offline_event_orders event_order
    where event_order.session_id = event_session.id
      and (
        event_order.status = 'pending'
        or not private.offline_payment_state_valid(
          event_order.payment_method, event_order.payment_state, event_order.status
        )
      )
  ) then
    raise exception 'Resolve pending offline payments before closing the event';
  end if;

  for allocation in
    select product_id, quantity_allocated - quantity_sold quantity_unused
    from public.offline_event_allocations
    where session_id = event_session.id
    order by product_id
    for update
  loop
    if allocation.quantity_unused > 0 then
      update public.products
      set quantity_available = quantity_available + allocation.quantity_unused
      where shop_id = event_session.shop_id and id = allocation.product_id;
      perform private.sync_product_stock(allocation.product_id);
    end if;
  end loop;
  update public.offline_event_sessions set status = 'closed', closed_at = now()
  where id = event_session.id;
  return jsonb_build_object('status', 'closed');
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
  closed_acknowledgements jsonb := '{}'::jsonb;
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
  if event_session.status = 'closed' then
    if jsonb_typeof(p_orders) <> 'array' or jsonb_array_length(p_orders) > 500 then
      raise exception 'Offline order batch is invalid';
    end if;
    select coalesce(
      jsonb_object_agg(submitted.id::text, greatest(submitted.client_revision, 0)),
      '{}'::jsonb
    ) into closed_acknowledgements
    from jsonb_to_recordset(p_orders) submitted(id uuid, client_revision bigint)
    where submitted.id is not null and submitted.client_revision is not null;
    return jsonb_build_object(
      'sync', jsonb_build_object(
        'inserted', 0,
        'updated', 0,
        'stale', 0,
        'acknowledged_revisions', closed_acknowledgements
      ),
      'status', 'closed'
    );
  end if;
  sync_result := public.sync_offline_event_orders(p_session_id, p_device_id, p_orders);
  close_result := public.close_offline_event_session(p_session_id, p_device_id);
  return jsonb_build_object(
    'sync', sync_result,
    'status', close_result ->> 'status'
  );
end;
$$;

revoke all on function private.sanitize_offline_product_snapshot(jsonb),
  private.offline_product_snapshot(public.products),
  private.offline_payment_state_valid(text, text, text)
from public, anon, authenticated;

revoke all on function public.start_offline_event_session(uuid, uuid, text, jsonb, jsonb, jsonb),
  public.get_active_offline_event_session(uuid, uuid),
  public.sync_offline_event_orders(uuid, uuid, jsonb),
  public.close_offline_event_session(uuid, uuid),
  public.finalize_offline_event_session(uuid, uuid, jsonb)
from public, anon, authenticated;

grant execute on function public.start_offline_event_session(uuid, uuid, text, jsonb, jsonb, jsonb),
  public.get_active_offline_event_session(uuid, uuid),
  public.sync_offline_event_orders(uuid, uuid, jsonb),
  public.close_offline_event_session(uuid, uuid),
  public.finalize_offline_event_session(uuid, uuid, jsonb)
to authenticated;

notify pgrst, 'reload schema';
