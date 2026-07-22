begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users(
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at
) values (
  '83000000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'offline-draft@test.local', '',
  now(), now(), now()
);
insert into public.shops(id, name, slug, created_by)
values (
  '84000000-0000-4000-8000-000000000001',
  'Offline Draft', 'offline-draft-test',
  '83000000-0000-4000-8000-000000000001'
);
insert into public.shop_members(shop_id, user_id, role)
values (
  '84000000-0000-4000-8000-000000000001',
  '83000000-0000-4000-8000-000000000001',
  'owner'
);
insert into public.products(
  id, shop_id, name, item_code, price_vnd,
  quantity_available, category, active
) values (
  'offline-draft-product',
  '84000000-0000-4000-8000-000000000001',
  'Draft Product', 'OFFLINE-DRAFT', 12000, 5, 'Test', true
);
insert into public.payment_settings(id, shop_id, bank_label)
values (
  'offline-draft-payment',
  '84000000-0000-4000-8000-000000000001',
  'Draft bank'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.save_offline_event_draft(uuid,uuid,text,timestamptz,timestamptz,jsonb)',
    'execute'
  ),
  'anonymous users cannot save event drafts'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.save_offline_event_draft(uuid,uuid,text,timestamptz,timestamptz,jsonb)',
    'execute'
  ),
  'authenticated admins can save event drafts'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.list_offline_events(uuid,integer)',
    'execute'
  ),
  'anonymous users cannot list events'
);

set local role authenticated;
set local request.jwt.claim.sub = '83000000-0000-4000-8000-000000000001';
create temporary table draft_result as
select public.save_offline_event_draft(
  '84000000-0000-4000-8000-000000000001',
  null,
  'Artist alley',
  '2026-08-01T01:00:00Z',
  '2026-08-01T09:00:00Z',
  '[{"product_id":"offline-draft-product","quantity":2}]'
) payload;

set local role postgres;
select is(
  (select status from public.offline_event_sessions),
  'draft',
  'saved event remains a draft'
);
select is(
  (select device_id from public.offline_event_sessions),
  null::uuid,
  'draft is not bound to a device'
);
select is(
  (select quantity_available from public.products where id = 'offline-draft-product'),
  5,
  'saving a draft does not reserve stock'
);
select is(
  (select quantity_allocated from public.offline_event_allocations),
  2,
  'draft stores its planned allocation'
);
select is(
  (select payload #>> '{session,scheduled_end_at}' from draft_result),
  '2026-08-01T09:00:00+00:00',
  'draft response includes the schedule'
);

set local role authenticated;
set local request.jwt.claim.sub = '83000000-0000-4000-8000-000000000001';
select is(
  jsonb_array_length(public.list_offline_events(
    '84000000-0000-4000-8000-000000000001',
    50
  )),
  1,
  'saved drafts appear in the event list'
);
select lives_ok(
  format(
    $$select public.activate_offline_event_session(%L,%L)$$,
    (select payload #>> '{session,id}' from draft_result),
    '85000000-0000-4000-8000-000000000001'
  ),
  'a saved draft can activate on the designated device'
);

set local role postgres;
select is(
  (select status from public.offline_event_sessions),
  'active',
  'activation changes the event lifecycle state'
);
select is(
  (select quantity_available from public.products where id = 'offline-draft-product'),
  3,
  'activation reserves only the planned quantity'
);
select ok(
  (select started_at is not null from public.offline_event_sessions),
  'activation records the actual start time'
);

set local role authenticated;
set local request.jwt.claim.sub = '83000000-0000-4000-8000-000000000001';
select is(
  public.get_offline_event_orders(
    '84000000-0000-4000-8000-000000000001',
    1,
    12,
    'all',
    null,
    null,
    (select payload #>> '{session,id}' from draft_result)::uuid
  ) ->> 'total',
  '0',
  'event order query accepts a specific event id'
);

select * from finish();
rollback;
