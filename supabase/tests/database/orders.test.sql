begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
values('20000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','staff-orders@test.local','',now(),now(),now());
insert into public.staff_members(user_id,role) values('20000000-0000-4000-8000-000000000001','staff');
insert into public.products(id,name,item_code,price_vnd,quantity_available,category,active) values
 ('order-a','A','ORDER-A',10000,10,'Test',true),
 ('order-b','B','ORDER-B',20000,1,'Test',true),
 ('order-inactive','Inactive','ORDER-I',30000,5,'Test',false);

set local role anon;
select throws_ok($$select * from public.create_order(null,'[]',gen_random_uuid(),repeat('a',32))$$, 'Cart must contain between 1 and 50 items', 'empty cart fails');
select throws_ok($$select * from public.create_order(null,'[{"product_id":"order-a","quantity":0}]',gen_random_uuid(),repeat('b',32))$$, 'Cart contains an invalid item', 'invalid quantity fails');
select throws_ok($$select * from public.create_order(null,'[{"product_id":"missing","quantity":1}]',gen_random_uuid(),repeat('c',32))$$, 'One or more items are sold out or no longer have enough stock', 'missing product fails');
select throws_ok($$select * from public.create_order(null,'[{"product_id":"order-inactive","quantity":1}]',gen_random_uuid(),repeat('d',32))$$, 'One or more items are sold out or no longer have enough stock', 'inactive product fails');
select throws_ok($$select * from public.create_order(null,'[{"product_id":"order-b","quantity":2}]',gen_random_uuid(),repeat('e',32))$$, 'One or more items are sold out or no longer have enough stock', 'insufficient stock fails');
select is((select count(*) from public.orders),0::bigint,'failed requests leave no orders');

select lives_ok($$select * from public.create_order('Customer','[{"product_id":"order-a","quantity":1},{"product_id":"order-a","quantity":2}]','30000000-0000-4000-8000-000000000001',repeat('f',32))$$,'valid order succeeds');
select is((select total_amount from public.orders where client_request_id='30000000-0000-4000-8000-000000000001'),30000,'database price and duplicate aggregation determine total');
select is((select quantity from public.order_items where order_id=(select id from public.orders where client_request_id='30000000-0000-4000-8000-000000000001')),3,'duplicates create one aggregated item');
select is((select quantity_available from public.products where id='order-a'),7,'creation reserves stock once');
select lives_ok($$select * from public.create_order('Customer','[{"product_id":"order-a","quantity":3}]','30000000-0000-4000-8000-000000000001',repeat('f',32))$$,'same request and token is idempotent');
select is((select count(*) from public.orders),1::bigint,'idempotent retry creates one order');
select throws_ok($$select * from public.create_order('Customer','[{"product_id":"order-a","quantity":3}]','30000000-0000-4000-8000-000000000001',repeat('g',32))$$,'This request id belongs to another checkout','same request with another token fails');

set local role authenticated;
set local request.jwt.claim.sub = '20000000-0000-4000-8000-000000000001';
select is((public.confirm_order_payment((select id from public.orders limit 1))->>'outcome'),'confirmed','staff confirms order');
select is((select quantity_available from public.products where id='order-a'),7,'confirmation does not deduct again');
select is((public.cancel_order((select id from public.orders limit 1))->>'outcome'),'already_confirmed','confirmed order cannot be cancelled');
select is((select quantity_available from public.products where id='order-a'),7,'terminal retry leaves stock unchanged');

set local role anon;
select lives_ok($$select * from public.create_order(null,'[{"product_id":"order-a","quantity":2}]','30000000-0000-4000-8000-000000000002',repeat('h',32))$$,'second order succeeds');
select is((public.cancel_customer_order((select id from public.orders where client_request_id='30000000-0000-4000-8000-000000000002'),repeat('x',32))->>'outcome'),'not_found','wrong recovery token reveals nothing');
select is((public.cancel_customer_order((select id from public.orders where client_request_id='30000000-0000-4000-8000-000000000002'),repeat('h',32))->>'outcome'),'cancelled','correct recovery token cancels');
select is((select quantity_available from public.products where id='order-a'),7,'customer cancellation restores stock once');

select * from finish();
rollback;
