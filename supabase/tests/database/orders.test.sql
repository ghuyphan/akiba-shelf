begin;
create extension if not exists pgtap with schema extensions;
select plan(32);
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

set local role postgres;
create temporary table test_order_ids(label text primary key,id uuid not null);
grant select on test_order_ids to anon,authenticated;
insert into test_order_ids values('first',(select id from public.orders where client_request_id='30000000-0000-4000-8000-000000000001'));
select is((select total_amount from public.orders where client_request_id='30000000-0000-4000-8000-000000000001'),30000,'database prices determine total');
select is((select quantity from public.order_items limit 1),3,'duplicate cart rows aggregate');
select is((select quantity_available from public.products where id='order-a'),7,'creation reserves once');

set local role anon;
select lives_ok($$select * from public.create_order('orders-test','Customer','[{"product_id":"order-a","quantity":3}]','30000000-0000-4000-8000-000000000001',repeat('f',32))$$,'retry is idempotent');

set local role postgres;
select is((select count(*) from public.orders),1::bigint,'retry creates one order');

set local role authenticated;set local request.jwt.claim.sub='20000000-0000-4000-8000-000000000001';
select is((public.confirm_order_payment((select id from test_order_ids where label='first'))->>'outcome'),'confirmed','staff confirms own order');

set local role postgres;
select is((select quantity_available from public.products where id='order-a'),7,'confirmation does not deduct twice');

set local role authenticated;set local request.jwt.claim.sub='20000000-0000-4000-8000-000000000001';
select is((public.cancel_order((select id from test_order_ids where label='first'))->>'outcome'),'already_confirmed','confirmed order is terminal');

set local role anon;
select lives_ok($$select * from public.create_order('orders-test',null,'[{"product_id":"order-a","quantity":2}]','30000000-0000-4000-8000-000000000002',repeat('h',32))$$,'second order succeeds');

set local role postgres;
insert into test_order_ids values('second',(select id from public.orders where client_request_id='30000000-0000-4000-8000-000000000002'));

set local role anon;
select is((public.cancel_customer_order((select id from test_order_ids where label='second'),repeat('x',32))->>'outcome'),'not_found','wrong token reveals nothing');
select is((public.cancel_customer_order((select id from test_order_ids where label='second'),repeat('h',32))->>'outcome'),'cancelled','correct token cancels');

set local role postgres;
select is((select quantity_available from public.products where id='order-a'),7,'cancellation restores once');

set local role anon;
select is((public.cancel_customer_order((select id from test_order_ids where label='second'),repeat('h',32))->>'outcome'),'already_cancelled','cancellation is idempotent');

set local role postgres;
select is((select quantity_available from public.products where id='order-a'),7,'terminal retry does not restore twice');
update public.products set sale_price_vnd=8000 where id='order-a';

set local role anon;
select lives_ok($$select * from public.create_order('orders-test',null,'[{"product_id":"order-a","quantity":1}]','30000000-0000-4000-8000-000000000003',repeat('s',32))$$,'sale-priced order succeeds');

set local role postgres;
select is((select total_amount from public.orders where client_request_id='30000000-0000-4000-8000-000000000003'),8000,'database sale price determines total');
select is((select oi.unit_price from public.order_items oi join public.orders o on o.id=oi.order_id where o.client_request_id='30000000-0000-4000-8000-000000000003'),8000,'order item snapshots sale price');

insert into public.products(id,shop_id,name,item_code,price_vnd,quantity_available,category,active,promotion_eligible) values
('order-c','21000000-0000-4000-8000-000000000001','C','ORDER-C',15000,10,'Test',true,true);
update public.products set promotion_eligible=true,quantity_available=10,sale_price_vnd=null where id in ('order-a','order-b');
insert into public.promotions(shop_id,enabled,buy_quantity,free_quantity,repeatable)
values('21000000-0000-4000-8000-000000000001',true,2,1,true);

set local role anon;
select lives_ok($$select * from public.create_order('orders-test',null,'[{"product_id":"order-a","quantity":1,"reward_quantity":1},{"product_id":"order-b","quantity":1},{"product_id":"order-c","quantity":1}]','30000000-0000-4000-8000-000000000004',repeat('p',32))$$,'dynamic mixed-product promotion succeeds');

set local role postgres;
select is((select total_amount from public.orders where client_request_id='30000000-0000-4000-8000-000000000004'),35000,'cheapest eligible item is free');
select is((select discount_amount from public.orders where client_request_id='30000000-0000-4000-8000-000000000004'),10000,'order snapshots the promotion discount');
select is((select oi.discount_amount from public.order_items oi join public.orders o on o.id=oi.order_id where o.client_request_id='30000000-0000-4000-8000-000000000004' and oi.product_id='order-a'),10000,'line snapshots the allocated free item');

update public.promotions set buy_quantity=1,free_quantity=1,repeatable=true where shop_id='21000000-0000-4000-8000-000000000001';
set local role anon;
select lives_ok($$select * from public.create_order('orders-test',null,'[{"product_id":"order-c","quantity":4,"reward_quantity":2}]','30000000-0000-4000-8000-000000000005',repeat('q',32))$$,'repeating dynamic promotion succeeds');
set local role postgres;
select is((select total_amount from public.orders where client_request_id='30000000-0000-4000-8000-000000000005'),30000,'repeating offer applies to every complete group');

update public.promotions set repeatable=false where shop_id='21000000-0000-4000-8000-000000000001';
set local role anon;
select lives_ok($$select * from public.create_order('orders-test',null,'[{"product_id":"order-c","quantity":4,"reward_quantity":1}]','30000000-0000-4000-8000-000000000006',repeat('r',32))$$,'non-repeating dynamic promotion succeeds');
set local role postgres;
select is((select total_amount from public.orders where client_request_id='30000000-0000-4000-8000-000000000006'),45000,'non-repeating offer applies only once');
select is((select quantity_available from public.products where id='order-c'),1,'free items are still reserved from stock');
select * from finish();rollback;
