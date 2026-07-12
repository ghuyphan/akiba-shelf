begin;
create extension if not exists pgtap with schema extensions;
select plan(20);
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at) values('20000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','staff-orders@test.local','',now(),now(),now());
insert into public.shops(id,name,slug,created_by) values('21000000-0000-4000-8000-000000000001','Orders','orders-test','20000000-0000-4000-8000-000000000001');
insert into public.shop_members(shop_id,user_id,role) values('21000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','staff');
insert into public.products(id,shop_id,name,item_code,price_vnd,quantity_available,category,active) values
('order-a','21000000-0000-4000-8000-000000000001','A','ORDER-A',10000,10,'Test',true),
('order-b','21000000-0000-4000-8000-000000000001','B','ORDER-B',20000,1,'Test',true),
('order-inactive','21000000-0000-4000-8000-000000000001','Inactive','ORDER-I',30000,5,'Test',false);

set local role anon;
select throws_ok($$select * from public.create_order('orders-test',null,'[]',gen_random_uuid(),repeat('a',32))$$,'Cart must contain between 1 and 50 items','empty cart fails');
select throws_ok($$select * from public.create_order('orders-test',null,'[{"product_id":"order-a","quantity":0}]',gen_random_uuid(),repeat('b',32))$$,'Cart contains an invalid item','invalid quantity fails');
select throws_ok($$select * from public.create_order('orders-test',null,'[{"product_id":"missing","quantity":1}]',gen_random_uuid(),repeat('c',32))$$,'One or more items are sold out or no longer have enough stock','missing product fails');
select throws_ok($$select * from public.create_order('orders-test',null,'[{"product_id":"order-b","quantity":2}]',gen_random_uuid(),repeat('d',32))$$,'One or more items are sold out or no longer have enough stock','insufficient stock fails');
select throws_ok($$select * from public.create_order('missing-shop',null,'[{"product_id":"order-a","quantity":1}]',gen_random_uuid(),repeat('e',32))$$,'Shop not found or inactive','unknown shop fails');
select lives_ok($$select * from public.create_order('orders-test','Customer','[{"product_id":"order-a","quantity":1},{"product_id":"order-a","quantity":2}]','30000000-0000-4000-8000-000000000001',repeat('f',32))$$,'valid order succeeds');
select is((select total_amount from public.orders where client_request_id='30000000-0000-4000-8000-000000000001'),30000,'database prices determine total');
select is((select quantity from public.order_items limit 1),3,'duplicate cart rows aggregate');
select is((select quantity_available from public.products where id='order-a'),7,'creation reserves once');
select lives_ok($$select * from public.create_order('orders-test','Customer','[{"product_id":"order-a","quantity":3}]','30000000-0000-4000-8000-000000000001',repeat('f',32))$$,'retry is idempotent');
select is((select count(*) from public.orders),1::bigint,'retry creates one order');

set local role authenticated;set local request.jwt.claim.sub='20000000-0000-4000-8000-000000000001';
select is((public.confirm_order_payment((select id from public.orders limit 1))->>'outcome'),'confirmed','staff confirms own order');
select is((select quantity_available from public.products where id='order-a'),7,'confirmation does not deduct twice');
select is((public.cancel_order((select id from public.orders limit 1))->>'outcome'),'already_confirmed','confirmed order is terminal');

set local role anon;
select lives_ok($$select * from public.create_order('orders-test',null,'[{"product_id":"order-a","quantity":2}]','30000000-0000-4000-8000-000000000002',repeat('h',32))$$,'second order succeeds');
select is((public.cancel_customer_order((select id from public.orders where client_request_id='30000000-0000-4000-8000-000000000002'),repeat('x',32))->>'outcome'),'not_found','wrong token reveals nothing');
select is((public.cancel_customer_order((select id from public.orders where client_request_id='30000000-0000-4000-8000-000000000002'),repeat('h',32))->>'outcome'),'cancelled','correct token cancels');
select is((select quantity_available from public.products where id='order-a'),7,'cancellation restores once');
select is((public.cancel_customer_order((select id from public.orders where client_request_id='30000000-0000-4000-8000-000000000002'),repeat('h',32))->>'outcome'),'already_cancelled','cancellation is idempotent');
select is((select quantity_available from public.products where id='order-a'),7,'terminal retry does not restore twice');
select * from finish();rollback;
