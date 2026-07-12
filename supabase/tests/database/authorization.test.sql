begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('10000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','owner@test.local','',now(),now(),now()),
  ('10000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','admin@test.local','',now(),now(),now()),
  ('10000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','staff@test.local','',now(),now(),now()),
  ('10000000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','outsider@test.local','',now(),now(),now()),
  ('10000000-0000-4000-8000-000000000005','00000000-0000-0000-0000-000000000000','authenticated','authenticated','inactive@test.local','',now(),now(),now());
insert into public.staff_members(user_id,role,active) values
  ('10000000-0000-4000-8000-000000000001','owner',true),
  ('10000000-0000-4000-8000-000000000002','admin',true),
  ('10000000-0000-4000-8000-000000000003','staff',true),
  ('10000000-0000-4000-8000-000000000005','staff',false);
insert into public.products(id,name,item_code,quantity_available,category,active) values
  ('auth-active','Active','AUTH-A',5,'Test',true),('auth-hidden','Hidden','AUTH-H',5,'Test',false);
insert into public.booth_settings(id,booth_name) values('auth-test','Auth test');
insert into public.payment_settings(id) values('auth-test');

set local role anon;
select results_eq('select id from public.products order by id', array['auth-active'::text], 'anonymous sees only active products');
select throws_ok($$insert into public.orders(customer_name,total_amount) values('attack',0)$$, '42501', null, 'anonymous cannot directly insert orders');
select throws_ok($$insert into public.order_items(order_id,product_id,quantity,unit_price) values(gen_random_uuid(),'auth-active',1,1)$$, '42501', null, 'anonymous cannot directly insert order items');
select throws_ok($$select id from public.orders$$, '42501', null, 'anonymous cannot enumerate orders');
select throws_ok($$select user_id from public.staff_members$$, '42501', null, 'anonymous cannot enumerate staff');

set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000004';
select results_eq('select id from public.products order by id', array['auth-active'::text], 'non-staff cannot see hidden products');
select is_empty($$update public.booth_settings set booth_name='attack' where id='auth-test' returning id$$, 'non-staff cannot edit booth settings');
select throws_ok($$select public.confirm_order_payment(gen_random_uuid())$$, '42501', 'Active staff membership required', 'non-staff cannot process orders');

set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000005';
select is_empty('select * from public.get_staff_access() where active', 'inactive staff is not authorized');
select throws_ok($$select public.cancel_order(gen_random_uuid())$$, '42501', 'Active staff membership required', 'inactive staff cannot process orders');

set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000003';
select results_eq('select id from public.products order by id', array['auth-active'::text,'auth-hidden'::text], 'staff sees operational products');
select is_empty($$update public.payment_settings set bank_account_name='attack' where id='auth-test' returning id$$, 'staff cannot edit payment settings');
select is_empty($$update public.products set name='attack' where id='auth-active' returning id$$, 'staff cannot edit products');

set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000002';
select lives_ok($$update public.payment_settings set bank_account_name='Admin' where id='auth-test'$$, 'admin can edit payment settings');

set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000001';
select lives_ok($$select public.save_staff_member('10000000-0000-4000-8000-000000000004','staff',true)$$, 'owner can manage staff');

select * from finish();
rollback;
