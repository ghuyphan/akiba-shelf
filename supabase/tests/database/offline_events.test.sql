begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

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

set local role authenticated;
set local request.jwt.claim.sub = '73000000-0000-4000-8000-000000000001';
select lives_ok(
  format(
    $$select public.sync_offline_event_orders(%L,%L,%L::jsonb)$$,
    (select payload -> 'session' ->> 'id' from event_result),
    '75000000-0000-4000-8000-000000000001',
    '[{"id":"76000000-0000-4000-8000-000000000001","order_code":"EVT-TEST01","customer_name":"Customer","total_amount":20000,"status":"pending","payment_method":"vietqr","payment_state":"bank_verification_pending","created_at":"2026-07-21T00:00:00Z","updated_at":"2026-07-21T00:00:00Z","items":[{"product_id":"offline-event-product","quantity":2,"unit_price":10000,"discount_amount":0}]}]'
  ),
  'offline order batch synchronizes'
);

set local role postgres;
select is((select count(*) from public.offline_event_orders), 1::bigint, 'one offline order is stored');
select is((select quantity_sold from public.offline_event_allocations), 2, 'synced order consumes allocated stock');

set local role authenticated;
set local request.jwt.claim.sub = '73000000-0000-4000-8000-000000000001';
select lives_ok(
  format(
    $$select public.sync_offline_event_orders(%L,%L,%L::jsonb)$$,
    (select payload -> 'session' ->> 'id' from event_result),
    '75000000-0000-4000-8000-000000000001',
    '[{"id":"76000000-0000-4000-8000-000000000001","order_code":"EVT-TEST01","customer_name":"Customer","total_amount":20000,"status":"confirmed","payment_method":"vietqr","payment_state":"bank_confirmed","created_at":"2026-07-21T00:00:00Z","updated_at":"2026-07-21T00:05:00Z","items":[{"product_id":"offline-event-product","quantity":2,"unit_price":10000,"discount_amount":0}]}]'
  ),
  'retry updates the existing order without consuming stock twice'
);

set local role postgres;
select is((select quantity_sold from public.offline_event_allocations), 2, 'idempotent update preserves sold quantity');

set local role authenticated;
set local request.jwt.claim.sub = '73000000-0000-4000-8000-000000000001';
select lives_ok(
  format(
    $$select public.close_offline_event_session(%L,%L)$$,
    (select payload -> 'session' ->> 'id' from event_result),
    '75000000-0000-4000-8000-000000000001'
  ),
  'resolved event can close'
);

set local role postgres;
select is(
  (select quantity_available from public.products where id = 'offline-event-product'),
  3,
  'closing returns only unsold allocated stock'
);

select * from finish();
rollback;
