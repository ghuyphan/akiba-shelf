begin;
create extension if not exists pgtap with schema extensions;
select plan(33);

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
insert into public.products(id,shop_id,name,item_code,quantity_available,category,active)
values('auth-b-active','11000000-0000-4000-8000-000000000002','Inactive shop product','AUTH-B',5,'Test',true);
update public.shops set active=false where id='11000000-0000-4000-8000-000000000002';
insert into public.booth_settings(id,shop_id,booth_name) values('auth-a','11000000-0000-4000-8000-000000000001','Shop A'),('auth-b','11000000-0000-4000-8000-000000000002','Shop B');
insert into public.payment_settings(id,shop_id) values('auth-a','11000000-0000-4000-8000-000000000001'),('auth-b','11000000-0000-4000-8000-000000000002');

set local role anon;
select results_eq($$select id from public.products where shop_id='11000000-0000-4000-8000-000000000001' order by id$$,array['auth-a-active'::text],'anonymous sees active products only');
select throws_ok($$insert into public.orders(shop_id,customer_name,total_amount) values('11000000-0000-4000-8000-000000000001','attack',0)$$,'42501',null,'anonymous cannot insert orders');
select throws_ok($$select id from public.orders$$,'42501',null,'anonymous cannot enumerate orders');
select throws_ok($$select user_id from public.shop_members$$,'42501',null,'anonymous cannot enumerate memberships');
select throws_ok($$select image_paths from public.products$$,'42501',null,'anonymous cannot select product storage paths');
select throws_ok($$select logo_path from public.booth_settings$$,'42501',null,'anonymous cannot select booth logo paths');
select throws_ok($$select social_qr_logo_path from public.booth_settings$$,'42501',null,'anonymous cannot select social QR storage paths');
select lives_ok($$select id,name,images,image_variants from public.products$$,'anonymous can select public product fields');
select lives_ok($$select id,booth_name,logo_url,theme_primary from public.booth_settings$$,'anonymous can select public booth fields');
select is_empty($$select id from public.products where id='auth-b-active'$$,'anonymous cannot read products from inactive shops');

set local role authenticated;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000004';
select throws_ok($$select created_by from public.shops$$,'42501',null,'authenticated non-member cannot select shop ownership metadata');
select throws_ok($$update public.shops set name='attack' where id='11000000-0000-4000-8000-000000000001'$$,'42501',null,'direct authenticated shop update is denied');

set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
select lives_ok($$select * from public.update_shop_details('11000000-0000-4000-8000-000000000001','Renamed Shop A')$$,'owner updates own shop through protected RPC');
select throws_ok($$select * from public.update_shop_details('11000000-0000-4000-8000-000000000002','Attack')$$,'42501','Active shop owner access required','owner cannot update another shop');

set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000002';
select throws_ok($$select * from public.update_shop_details('11000000-0000-4000-8000-000000000001','Attack')$$,'42501','Active shop owner access required','admin cannot update shop details');

reset role;
insert into public.shop_invitations(id,shop_id,email,role,invited_by,status,expires_at) values
('12000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000001','outsider@test.local','staff','10000000-0000-4000-8000-000000000001','pending',now()+interval '1 day'),
('12000000-0000-4000-8000-000000000002','11000000-0000-4000-8000-000000000001','staff@test.local','admin','10000000-0000-4000-8000-000000000001','pending',now()-interval '1 day'),
('12000000-0000-4000-8000-000000000003','11000000-0000-4000-8000-000000000001','staff@test.local','admin','10000000-0000-4000-8000-000000000001','revoked',now()+interval '1 day'),
('12000000-0000-4000-8000-000000000004','11000000-0000-4000-8000-000000000001','owner@test.local','staff','10000000-0000-4000-8000-000000000001','pending',now()+interval '1 day');

set local role authenticated;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000003';
set local request.jwt.claims='{"sub":"10000000-0000-4000-8000-000000000003","email":"staff@test.local"}';
select throws_ok($$select public.accept_shop_invitation('12000000-0000-4000-8000-000000000001')$$,null,null,'wrong authenticated email cannot accept an invitation');
select throws_ok($$select public.accept_shop_invitation('12000000-0000-4000-8000-000000000002')$$,null,null,'expired invitation cannot be accepted');
select throws_ok($$select public.accept_shop_invitation('12000000-0000-4000-8000-000000000003')$$,null,null,'revoked invitation cannot be accepted');

set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000004';
set local request.jwt.claims='{"sub":"10000000-0000-4000-8000-000000000004","email":"outsider@test.local"}';
select is(public.accept_shop_invitation('12000000-0000-4000-8000-000000000001'),'11000000-0000-4000-8000-000000000001'::uuid,'matching account accepts the intended invitation');
select throws_ok($$select public.accept_shop_invitation('12000000-0000-4000-8000-000000000001')$$,null,null,'accepted invitation cannot be used twice');
select is((select role from public.shop_members where shop_id='11000000-0000-4000-8000-000000000001' and user_id='10000000-0000-4000-8000-000000000004'),'staff','accepted invitation creates the requested membership');

set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
set local request.jwt.claims='{"sub":"10000000-0000-4000-8000-000000000001","email":"owner@test.local"}';
select is(public.accept_shop_invitation('12000000-0000-4000-8000-000000000004'),'11000000-0000-4000-8000-000000000001'::uuid,'owner invitation is consumed safely');
select is((select role from public.shop_members where shop_id='11000000-0000-4000-8000-000000000001' and user_id='10000000-0000-4000-8000-000000000001'),'owner','invitation never downgrades an existing owner');

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
