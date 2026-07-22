begin;
create extension if not exists pgtap with schema extensions;
select plan(39);

insert into auth.users(
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at
) values (
  '73000000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'offline-event@test.local', '',
  now(), now(), now()
);
insert into public.shops(id, name, slug, created_by)
values (
  '74000000-0000-4000-8000-000000000001',
  'Offline Event', 'offline-event-test',
  '73000000-0000-4000-8000-000000000001'
);
insert into public.shop_members(shop_id, user_id, role)
values (
  '74000000-0000-4000-8000-000000000001',
  '73000000-0000-4000-8000-000000000001',
  'owner'
);
insert into public.products(
  id, shop_id, name, item_code, price_vnd,
  quantity_available, category, active
) values (
  'offline-event-product',
  '74000000-0000-4000-8000-000000000001',
  'Event Product', 'OFFLINE-EVENT', 10000, 5, 'Test', true
);
insert into public.payment_settings(id, shop_id, bank_label)
values (
  'offline-event-payment',
  '74000000-0000-4000-8000-000000000001',
  'Server-authoritative bank'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.start_offline_event_session(uuid,uuid,text,jsonb,jsonb,jsonb)',
    'execute'
  ),
  'anonymous users cannot allocate event inventory'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.start_offline_event_session(uuid,uuid,text,jsonb,jsonb,jsonb)',
    'execute'
  ),
  'authenticated staff can call the guarded event allocator'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.close_offline_event_session(uuid,uuid)',
    'execute'
  ),
  'browser roles cannot bypass atomic finalization receipts'
);

set local role authenticated;
set local request.jwt.claim.sub = '73000000-0000-4000-8000-000000000001';
create temporary table event_result as
select public.start_offline_event_session(
  '74000000-0000-4000-8000-000000000001',
  '75000000-0000-4000-8000-000000000001',
  'Convention day',
  '[{"product_id":"offline-event-product","quantity":4}]',
  '{}',
  '{}'
) as payload;

set local role postgres;
select is(
  (select quantity_available from public.products where id = 'offline-event-product'),
  1,
  'starting event mode removes the allocation from online stock'
);
select is(
  (select quantity_allocated from public.offline_event_allocations),
  4,
  'event allocation is recorded'
);
select is(
  (select payload #>> '{session,payment_snapshot,bank_label}' from event_result),
  'Server-authoritative bank',
  'event payment snapshot is read from the database'
);
select ok(
  not ((select payload #> '{allocations,0,product_snapshot}' from event_result) ? 'image_paths'),
  'event recovery snapshot excludes private product storage paths'
);

set local role authenticated;
set local request.jwt.claim.sub = '73000000-0000-4000-8000-000000000001';
select lives_ok(
  format(
    $$select public.sync_offline_event_orders(%L,%L,%L::jsonb)$$,
    (select payload -> 'session' ->> 'id' from event_result),
    '75000000-0000-4000-8000-000000000001',
    '[{"id":"76000000-0000-4000-8000-000000000001","order_code":"EVT-TEST01","customer_name":"Customer","total_amount":1,"status":"pending","payment_method":"vietqr","payment_state":"bank_verification_pending","client_revision":1,"created_at":"2026-07-21T00:00:00Z","updated_at":"2026-07-21T00:00:00Z","items":[{"product_id":"offline-event-product","quantity":2,"unit_price":1,"discount_amount":0}]}]'
  ),
  'offline order batch synchronizes'
);

set local role postgres;
select is((select count(*) from public.offline_event_orders), 1::bigint, 'one offline order is stored');
select is((select quantity_sold from public.offline_event_allocations), 2, 'synced order consumes allocated stock');
select is((select total_amount from public.offline_event_orders),20000,'server snapshot determines the offline order total');
select is((select unit_price from public.offline_event_order_items),10000,'server snapshot determines the offline line price');
select ok(
  not has_function_privilege(
    'anon',
    'public.get_offline_event_orders(uuid,integer,integer,text,timestamptz,timestamptz)',
    'execute'
  ),
  'anonymous users cannot list event orders'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.get_offline_event_orders(uuid,integer,integer,text,timestamptz,timestamptz)',
    'execute'
  ),
  'authenticated staff can call the guarded event order list'
);

set local role authenticated;
set local request.jwt.claim.sub = '73000000-0000-4000-8000-000000000001';
create temporary table event_orders_result as
select public.get_offline_event_orders(
  '74000000-0000-4000-8000-000000000001',
  1,
  12,
  'all',
  null,
  null
) as payload;
select is(
  (select (payload ->> 'total')::integer from event_orders_result),
  1,
  'event order list returns the matching total'
);
select is(
  (select payload #>> '{orders,0,offline_event_name}' from event_orders_result),
  'Convention day',
  'event order list includes the session name'
);
select is(
  (select payload #>> '{orders,0,order_items,0,product,name}' from event_orders_result),
  'Event Product',
  'event order list includes the product snapshot'
);
select is(
  (
    public.get_offline_event_orders(
      '74000000-0000-4000-8000-000000000001',
      1,
      12,
      'all',
      '2026-07-22T00:00:00Z',
      null
    ) ->> 'total'
  )::integer,
  0,
  'event order list applies the requested date scope'
);
set local request.jwt.claim.sub = '73000000-0000-4000-8000-000000000099';
select throws_ok(
  $$select public.get_offline_event_orders('74000000-0000-4000-8000-000000000001',1,12,'all',null,null)$$,
  '42501',
  'Active shop access required',
  'non-members cannot list event orders'
);

set local role authenticated;
set local request.jwt.claim.sub = '73000000-0000-4000-8000-000000000001';
select throws_ok(
  format(
    $$select public.sync_offline_event_orders(%L,%L,%L::jsonb)$$,
    (select payload -> 'session' ->> 'id' from event_result),
    '75000000-0000-4000-8000-000000000001',
    '[{"id":"76000000-0000-4000-8000-000000000001","order_code":"EVT-TEST01","customer_name":"Customer","total_amount":20000,"status":"confirmed","payment_method":"vietqr","payment_state":"bank_verification_pending","client_revision":2,"created_at":"2026-07-21T00:00:00Z","updated_at":"2026-07-21T00:03:00Z","items":[{"product_id":"offline-event-product","quantity":2,"unit_price":10000,"discount_amount":0}]}]'
  ),
  'Offline order fields are invalid',
  'confirmed offline orders require a verified payment state'
);
select lives_ok(
  format(
    $$select public.sync_offline_event_orders(%L,%L,%L::jsonb)$$,
    (select payload -> 'session' ->> 'id' from event_result),
    '75000000-0000-4000-8000-000000000001',
    '[{"id":"76000000-0000-4000-8000-000000000001","order_code":"EVT-TEST01","customer_name":"Customer","total_amount":20000,"status":"confirmed","payment_method":"vietqr","payment_state":"bank_confirmed","fulfillment_status":"ready","fulfillment_updated_at":"2026-07-21T00:05:00Z","confirmed_by_label":"Event device 75000000","fulfillment_updated_by_label":"Event device 75000000","client_revision":2,"created_at":"2026-07-21T00:00:00Z","updated_at":"2026-07-21T00:05:00Z","items":[{"product_id":"offline-event-product","quantity":2,"unit_price":10000,"discount_amount":0}]}]'
  ),
  'retry updates the existing order without consuming stock twice'
);

set local role postgres;
select is((select quantity_sold from public.offline_event_allocations), 2, 'idempotent update preserves sold quantity');
select is((select fulfillment_status from public.offline_event_orders), 'ready', 'offline fulfilment syncs to the server');
select is((select client_revision from public.offline_event_orders),2::bigint,'server acknowledges the latest offline client revision');
select is(
  (select confirmed_at::text from public.offline_event_orders),
  '2026-07-21 00:05:00+00',
  'confirmation stores an immutable transition timestamp'
);

set local role authenticated;
set local request.jwt.claim.sub = '73000000-0000-4000-8000-000000000001';
select is(
  public.get_offline_event_orders(
    '74000000-0000-4000-8000-000000000001', 1, 12, 'all', null, null
  ) #>> '{orders,0,confirmed_at}',
  '2026-07-21T00:05:00+00:00',
  'event order list returns the stored confirmation timestamp'
);

select lives_ok(
  format(
    $$select public.sync_offline_event_orders(%L,%L,%L::jsonb)$$,
    (select payload -> 'session' ->> 'id' from event_result),
    '75000000-0000-4000-8000-000000000001',
    '[{"id":"76000000-0000-4000-8000-000000000001","order_code":"EVT-TEST01","customer_name":"Customer","total_amount":20000,"status":"confirmed","payment_method":"vietqr","payment_state":"bank_confirmed","fulfillment_status":"preparing","client_revision":1,"created_at":"2026-07-21T00:00:00Z","updated_at":"2026-07-21T00:04:00Z","items":[{"product_id":"offline-event-product","quantity":2,"unit_price":10000,"discount_amount":0}]}]'
  ),
  'stale offline fulfilment retry remains idempotent'
);

set local role postgres;
select is((select fulfillment_status from public.offline_event_orders), 'ready', 'stale sync cannot move fulfilment backward');

set local role authenticated;
set local request.jwt.claim.sub = '73000000-0000-4000-8000-000000000001';
select is(
  (
    public.finalize_offline_event_session(
      (select (payload -> 'session' ->> 'id')::uuid from event_result),
      '75000000-0000-4000-8000-000000000001',
      '[{"id":"76000000-0000-4000-8000-000000000001","order_code":"EVT-TEST01","customer_name":"Customer","total_amount":20000,"status":"confirmed","payment_method":"vietqr","payment_state":"bank_confirmed","fulfillment_status":"ready","fulfillment_updated_at":"2026-07-21T00:05:00Z","confirmed_by_label":"Event device 75000000","fulfillment_updated_by_label":"Event device 75000000","client_revision":2,"created_at":"2026-07-21T00:00:00Z","updated_at":"2026-07-21T00:05:00Z","items":[{"product_id":"offline-event-product","quantity":2,"unit_price":10000,"discount_amount":0}]}]'::jsonb
    ) ->> 'status'
  ),
  'closed',
  'final sync and close complete atomically'
);

set local role postgres;
select is(
  (select quantity_available from public.products where id = 'offline-event-product'),
  3,
  'closing returns only unsold allocated stock'
);

set local role authenticated;
set local request.jwt.claim.sub = '73000000-0000-4000-8000-000000000001';
select is(
  (
    public.finalize_offline_event_session(
      (select (payload -> 'session' ->> 'id')::uuid from event_result),
      '75000000-0000-4000-8000-000000000001',
      '[]'::jsonb
    ) ->> 'status'
  ),
  'closed',
  'finalization retry remains idempotent after a lost response'
);
select is(
  public.finalize_offline_event_session(
    (select (payload -> 'session' ->> 'id')::uuid from event_result),
    '75000000-0000-4000-8000-000000000001',
    jsonb_build_array(jsonb_build_object(
      'id', '76000000-0000-4000-8000-000000000001',
      'client_revision', 2
    ))
  ) #>> '{sync,acknowledged_revisions,76000000-0000-4000-8000-000000000001}',
  '2',
  'finalization retry acknowledges the frozen local order revisions'
);

select ok(
  (retry.payload #> '{sync,acknowledged_revisions}') ? '76000000-0000-4000-8000-000000000001'
    and not ((retry.payload #> '{sync,acknowledged_revisions}') ? '76000000-0000-4000-8000-000000000099'),
  'closed retries return only persisted finalization receipts'
)
from (
  select public.finalize_offline_event_session(
    (select (payload -> 'session' ->> 'id')::uuid from event_result),
    '75000000-0000-4000-8000-000000000001',
    '[{"id":"76000000-0000-4000-8000-000000000099","client_revision":99}]'::jsonb
  ) payload
) retry;

set local role postgres;
insert into public.offline_event_sessions(
  id, shop_id, device_id, name, status, payment_snapshot,
  promotion_snapshot, created_by, integrity_version
) values (
  '71000000-0000-4000-8000-000000000099',
  '74000000-0000-4000-8000-000000000001',
  '75000000-0000-4000-8000-000000000099',
  'Legacy convention', 'active', '{}',
  '{"enabled":false,"buy_quantity":3,"free_quantity":1,"repeatable":true,"qualifying_product_ids":[],"reward_product_ids":[]}',
  '73000000-0000-4000-8000-000000000001', 1
);
insert into public.offline_event_allocations(
  session_id, shop_id, product_id, quantity_allocated, quantity_sold,
  product_snapshot
) select
  '71000000-0000-4000-8000-000000000099',
  '74000000-0000-4000-8000-000000000001',
  product.id, 1, 1, private.offline_product_snapshot(product)
from public.products product where product.id = 'offline-event-product';
update public.products
set quantity_available = quantity_available - 1
where id = 'offline-event-product';
insert into public.offline_event_orders(
  id, session_id, shop_id, order_code, customer_name, total_amount,
  status, payment_method, payment_state, client_revision, created_at, updated_at
) values (
  '76000000-0000-4000-8000-000000000099',
  '71000000-0000-4000-8000-000000000099',
  '74000000-0000-4000-8000-000000000001',
  'EVT-LEGACY', 'Legacy customer', 1,
  'pending', 'vietqr', 'bank_verification_pending', 0,
  '2026-07-20T00:00:00Z', '2026-07-20T00:00:00Z'
);
insert into public.offline_event_order_items(
  order_id, session_id, shop_id, product_id, quantity, unit_price,
  discount_amount
) values (
  '76000000-0000-4000-8000-000000000099',
  '71000000-0000-4000-8000-000000000099',
  '74000000-0000-4000-8000-000000000001',
  'offline-event-product', 1, 1, 0
);

set local role authenticated;
set local request.jwt.claim.sub = '73000000-0000-4000-8000-000000000001';
select throws_ok(
  $$select public.sync_offline_event_orders(
    '71000000-0000-4000-8000-000000000099',
    '75000000-0000-4000-8000-000000000099',
    '[{"id":"76000000-0000-4000-8000-000000000098"}]'::jsonb
  )$$,
  'Legacy offline event contains orders that require manual reconciliation',
  'legacy sessions quarantine orders that were never persisted by Supabase'
);
create temporary table legacy_finalize_result as
select public.finalize_offline_event_session(
  '71000000-0000-4000-8000-000000000099',
  '75000000-0000-4000-8000-000000000099',
  '[{"id":"76000000-0000-4000-8000-000000000099","order_code":"EVT-LEGACY","customer_name":"Legacy customer","total_amount":999999,"status":"cancelled","payment_method":"vietqr","payment_state":"bank_verification_pending","fulfillment_status":"unfulfilled","client_revision":1,"created_at":"2026-07-20T00:00:00Z","updated_at":"2026-07-22T00:00:00Z","items":[{"product_id":"offline-event-product","quantity":1,"unit_price":999999,"discount_amount":999999}]}]'::jsonb
) payload;
select is((select payload ->> 'status' from legacy_finalize_result),'closed','legacy finalization can safely close after cancellation');

set local role postgres;
select is((select status from public.offline_event_orders where id='76000000-0000-4000-8000-000000000099'),'cancelled','legacy pending orders can be cancelled without trusting client prices');
select is((select quantity_sold from public.offline_event_allocations where session_id='71000000-0000-4000-8000-000000000099'),0,'legacy cancellation restores the allocation exactly once');
select is((select quantity_available from public.products where id='offline-event-product'),3,'legacy close returns only the reconciled unused allocation');
select is((select client_revision from public.offline_event_finalization_receipts where order_id='76000000-0000-4000-8000-000000000099'),1::bigint,'legacy close persists an exact finalization receipt');

select * from finish();
rollback;
