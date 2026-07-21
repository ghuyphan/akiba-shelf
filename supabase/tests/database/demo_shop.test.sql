begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users(
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at
)
values (
  '40000000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'demo-owner@test.local',
  '',
  now(),
  now(),
  now()
);

insert into public.shops(id, name, slug, created_by)
values (
  '41000000-0000-4000-8000-000000000001',
  'Arigato-san',
  'arigatosan',
  '40000000-0000-4000-8000-000000000001'
);

select is(
  (select name from public.shops where slug = 'demo-booth'),
  'demo-booth',
  'creating Arigato-san creates the named demo tenant'
);
select is(
  (select accepting_orders from public.shops where slug = 'demo-booth'),
  false,
  'demo tenant never accepts orders'
);
select is(
  (select catalog_source_shop_id from public.shops where slug = 'demo-booth'),
  '41000000-0000-4000-8000-000000000001'::uuid,
  'demo tenant mirrors Arigato-san as its catalog source'
);

set local role service_role;
select throws_ok(
  $$select * from public.create_order_rate_limited('demo-booth', null, '[]', gen_random_uuid(), repeat('d', 32), repeat('d', 64))$$,
  'This storefront is a read-only demo and does not accept orders',
  'demo checkout is rejected before cart processing'
);

set local role postgres;
select is(
  (select count(*) from public.orders where shop_id = '00000000-0000-4000-8000-000000000002'),
  0::bigint,
  'rejected demo checkout creates no order'
);

update public.shops set active = false where slug = 'arigatosan';
select is(
  (select active from public.shops where slug = 'demo-booth'),
  false,
  'demo availability follows the source shop'
);

select * from finish();
rollback;
