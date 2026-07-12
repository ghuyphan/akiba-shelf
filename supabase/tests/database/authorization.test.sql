begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at) values
('10000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','owner@test.local','',now(),now(),now()),
('10000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','admin@test.local','',now(),now(),now()),
('10000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','staff@test.local','',now(),now(),now()),
('10000000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','outsider@test.local','',now(),now(),now());
insert into public.shops(id,name,slug,created_by) values
('11000000-0000-4000-8000-000000000001','Shop A','auth-shop-a','10000000-0000-4000-8000-000000000001'),
('11000000-0000-4000-8000-000000000002','Shop B','auth-shop-b','10000000-0000-4000-8000-000000000004');
insert into public.shop_members(shop_id,user_id,role) values
('11000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','owner'),
('11000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','admin'),
('11000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003','staff'),
('11000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000004','owner');
insert into public.products(id,shop_id,name,item_code,quantity_available,category,active) values
('auth-a-active','11000000-0000-4000-8000-000000000001','Active A','AUTH-A',5,'Test',true),
('auth-a-hidden','11000000-0000-4000-8000-000000000001','Hidden A','AUTH-H',5,'Test',false),
('auth-b-hidden','11000000-0000-4000-8000-000000000002','Hidden B','AUTH-H',5,'Test',false);
insert into public.booth_settings(id,shop_id,booth_name) values('auth-a','11000000-0000-4000-8000-000000000001','Shop A'),('auth-b','11000000-0000-4000-8000-000000000002','Shop B');
insert into public.payment_settings(id,shop_id) values('auth-a','11000000-0000-4000-8000-000000000001'),('auth-b','11000000-0000-4000-8000-000000000002');

set local role anon;
select results_eq($$select id from public.products where shop_id='11000000-0000-4000-8000-000000000001' order by id$$,array['auth-a-active'::text],'anonymous sees active products only');
select throws_ok($$insert into public.orders(shop_id,customer_name,total_amount) values('11000000-0000-4000-8000-000000000001','attack',0)$$,'42501',null,'anonymous cannot insert orders');
select throws_ok($$select id from public.orders$$,'42501',null,'anonymous cannot enumerate orders');
select throws_ok($$select user_id from public.shop_members$$,'42501',null,'anonymous cannot enumerate memberships');

set local role authenticated;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000003';
select results_eq($$select id from public.products where shop_id='11000000-0000-4000-8000-000000000001' order by id$$,array['auth-a-active'::text,'auth-a-hidden'::text],'staff sees own operational catalog');
select is_empty($$select id from public.products where id='auth-b-hidden'$$,'staff cannot see another shop private product');
select is_empty($$update public.products set name='attack' where id='auth-a-active' returning id$$,'staff cannot edit products');
select is_empty($$update public.payment_settings set bank_account_name='attack' where id='auth-a' returning id$$,'staff cannot edit payment settings');

set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000002';
select lives_ok($$update public.payment_settings set bank_account_name='Admin' where id='auth-a'$$,'admin edits own payment settings');
select is_empty($$update public.payment_settings set bank_account_name='attack' where id='auth-b' returning id$$,'admin cannot edit another shop');
select is_empty($$select * from public.get_shop_members('11000000-0000-4000-8000-000000000001')$$,'admin cannot enumerate members');

set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
select lives_ok($$select public.save_shop_member('11000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000004','staff',true)$$,'owner manages own members');
select throws_ok($$select public.save_shop_member('11000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003','staff',true)$$,'42501','Shop owner access required','owner cannot manage another shop');
select throws_ok($$select public.delete_shop_member('11000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001')$$,'A shop must keep at least one active owner','final owner is protected');

select * from finish();
rollback;
