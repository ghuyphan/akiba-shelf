begin;
create extension if not exists pgtap with schema extensions;
select plan(53);
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at) values('20000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','staff-orders@test.local','',now(),now(),now());
insert into public.shops(id,name,slug,created_by) values('21000000-0000-4000-8000-000000000001','Orders','orders-test','20000000-0000-4000-8000-000000000001');
insert into public.shop_members(shop_id,user_id,role) values('21000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','staff');
insert into public.products(id,shop_id,name,item_code,price_vnd,quantity_available,category,active) values
('order-a','21000000-0000-4000-8000-000000000001','A','ORDER-A',10000,10,'Test',true),
('order-b','21000000-0000-4000-8000-000000000001','B','ORDER-B',20000,1,'Test',true),
('order-inactive','21000000-0000-4000-8000-000000000001','Inactive','ORDER-I',30000,5,'Test',false);

set local role service_role;
select throws_ok($$select * from public.create_order('orders-test',null,'[]',gen_random_uuid(),repeat('a',32))$$,'Cart must contain between 1 and 50 items','empty cart fails');
select throws_ok($$select * from public.create_order('orders-test',null,'[{"product_id":"order-a","quantity":0}]',gen_random_uuid(),repeat('b',32))$$,'Cart contains an invalid item','invalid quantity fails');
select throws_ok($$select * from public.create_order('orders-test',null,'[{"product_id":"missing","quantity":1}]',gen_random_uuid(),repeat('c',32))$$,'One or more items are sold out or no longer have enough stock','missing product fails');
select throws_ok($$select * from public.create_order('orders-test',null,'[{"product_id":"order-b","quantity":2}]',gen_random_uuid(),repeat('d',32))$$,'One or more items are sold out or no longer have enough stock','insufficient stock fails');
select throws_ok($$select * from public.create_order('missing-shop',null,'[{"product_id":"order-a","quantity":1}]',gen_random_uuid(),repeat('e',32))$$,'Shop not found or inactive','unknown shop fails');
select lives_ok($$select * from public.create_order_rate_limited('orders-test','Customer','[{"product_id":"order-a","quantity":1},{"product_id":"order-a","quantity":2}]','30000000-0000-4000-8000-000000000001',repeat('f',32),repeat('1',64))$$,'valid rate-limited order succeeds');

set local role postgres;
create temporary table test_order_ids(label text primary key,id uuid not null);
grant select on test_order_ids to anon,authenticated;
insert into test_order_ids values('first',(select id from public.orders where client_request_id='30000000-0000-4000-8000-000000000001'));
select is((select total_amount from public.orders where client_request_id='30000000-0000-4000-8000-000000000001'),30000,'database prices determine total');
select is((select quantity from public.order_items where order_id=(select id from test_order_ids where label='first')),3,'duplicate cart rows aggregate');
select is((select quantity_available from public.products where id='order-a'),7,'creation reserves once');

set local role service_role;
select lives_ok($$select * from public.create_order_rate_limited('orders-test','Customer','[{"product_id":"order-a","quantity":3}]','30000000-0000-4000-8000-000000000001',repeat('f',32),repeat('1',64))$$,'rate-limited retry is idempotent');

set local role postgres;
select is((select count(*) from public.orders where client_request_id='30000000-0000-4000-8000-000000000001'),1::bigint,'retry creates one order');
select is((select count(*) from private.checkout_reservation_clients where client_request_id='30000000-0000-4000-8000-000000000001'),1::bigint,'retry stores one client reservation record');

set local role authenticated;set local request.jwt.claim.sub='20000000-0000-4000-8000-000000000001';
select is((public.confirm_order_payment((select id from test_order_ids where label='first'))->>'outcome'),'confirmed','staff confirms own order');
set local role postgres;
select is((select fulfillment_status from public.orders where id=(select id from test_order_ids where label='first')),'preparing','payment confirmation starts fulfilment preparation');
select is((select fulfillment_updated_by from public.orders where id=(select id from test_order_ids where label='first')),'20000000-0000-4000-8000-000000000001'::uuid,'payment confirmation records the initial fulfilment actor');
set local role authenticated;set local request.jwt.claim.sub='20000000-0000-4000-8000-000000000001';
select is((public.update_order_fulfillment((select id from test_order_ids where label='first'),'ready')->>'outcome'),'updated','staff marks confirmed order ready');
select is((public.update_order_fulfillment((select id from test_order_ids where label='first'),'picked_up')->>'outcome'),'updated','staff marks ready order picked up');
select is((public.update_order_fulfillment((select id from test_order_ids where label='first'),'ready')->>'outcome'),'invalid_transition','fulfilment cannot move backward');

set local role postgres;
select is((select quantity_available from public.products where id='order-a'),7,'confirmation does not deduct twice');

set local role authenticated;set local request.jwt.claim.sub='20000000-0000-4000-8000-000000000001';
select is((public.cancel_order((select id from test_order_ids where label='first'))->>'outcome'),'already_confirmed','confirmed order is terminal');

set local role service_role;
select lives_ok($$select * from public.create_order('orders-test',null,'[{"product_id":"order-a","quantity":2}]','30000000-0000-4000-8000-000000000002',repeat('h',32))$$,'second order succeeds');

set local role postgres;
insert into test_order_ids values('second',(select id from public.orders where client_request_id='30000000-0000-4000-8000-000000000002'));

set local role anon;
select is((public.cancel_customer_order((select id from test_order_ids where label='second'),repeat('x',32))->>'outcome'),'not_found','wrong token reveals nothing');
select is((public.cancel_customer_order((select id from test_order_ids where label='second'),repeat('x',161))->>'outcome'),'not_found','oversized recovery token reveals nothing');
select is_empty($$select * from public.get_customer_order((select id from test_order_ids where label='second'),repeat('x',161))$$,'oversized recovery token is rejected before lookup');
select is((public.cancel_customer_order((select id from test_order_ids where label='second'),repeat('h',32))->>'outcome'),'cancelled','correct token cancels');

set local role postgres;
select is((select quantity_available from public.products where id='order-a'),7,'cancellation restores once');

set local role anon;
select is((public.cancel_customer_order((select id from test_order_ids where label='second'),repeat('h',32))->>'outcome'),'already_cancelled','cancellation is idempotent');

set local role postgres;
select is((select quantity_available from public.products where id='order-a'),7,'terminal retry does not restore twice');
update public.products set sale_price_vnd=8000 where id='order-a';

set local role service_role;
select lives_ok($$select * from public.create_order('orders-test',null,'[{"product_id":"order-a","quantity":1}]','30000000-0000-4000-8000-000000000003',repeat('s',32))$$,'sale-priced order succeeds');

set local role postgres;
select is((select total_amount from public.orders where client_request_id='30000000-0000-4000-8000-000000000003'),8000,'database sale price determines total');
select is((select oi.unit_price from public.order_items oi join public.orders o on o.id=oi.order_id where o.client_request_id='30000000-0000-4000-8000-000000000003'),8000,'order item snapshots sale price');

insert into public.products(id,shop_id,name,item_code,price_vnd,quantity_available,category,active,promotion_eligible) values
('order-c','21000000-0000-4000-8000-000000000001','C','ORDER-C',15000,10,'Test',true,true);
update public.products set promotion_eligible=true,quantity_available=10,sale_price_vnd=null where id in ('order-a','order-b');
insert into public.promotions(shop_id,enabled,buy_quantity,free_quantity,repeatable)
values('21000000-0000-4000-8000-000000000001',true,2,1,true);
insert into public.promotion_products(shop_id,product_id,role) values
('21000000-0000-4000-8000-000000000001','order-a','both'),
('21000000-0000-4000-8000-000000000001','order-b','both'),
('21000000-0000-4000-8000-000000000001','order-c','both');

set local role service_role;
select lives_ok($$select * from public.create_order('orders-test',null,'[{"product_id":"order-a","quantity":1,"reward_quantity":1},{"product_id":"order-b","quantity":1},{"product_id":"order-c","quantity":1}]','30000000-0000-4000-8000-000000000004',repeat('p',32))$$,'dynamic mixed-product promotion succeeds');

set local role postgres;
select is((select total_amount from public.orders where client_request_id='30000000-0000-4000-8000-000000000004'),35000,'cheapest eligible item is free');
select is((select discount_amount from public.orders where client_request_id='30000000-0000-4000-8000-000000000004'),10000,'order snapshots the promotion discount');
select is((select oi.discount_amount from public.order_items oi join public.orders o on o.id=oi.order_id where o.client_request_id='30000000-0000-4000-8000-000000000004' and oi.product_id='order-a'),10000,'line snapshots the allocated free item');

update public.promotions set buy_quantity=1,free_quantity=1,repeatable=true where shop_id='21000000-0000-4000-8000-000000000001';
set local role service_role;
select lives_ok($$select * from public.create_order('orders-test',null,'[{"product_id":"order-c","quantity":4,"reward_quantity":2}]','30000000-0000-4000-8000-000000000005',repeat('q',32))$$,'repeating dynamic promotion succeeds');
set local role postgres;
select is((select total_amount from public.orders where client_request_id='30000000-0000-4000-8000-000000000005'),30000,'repeating offer applies to every complete group');

update public.promotions set repeatable=false where shop_id='21000000-0000-4000-8000-000000000001';
set local role service_role;
select lives_ok($$select * from public.create_order('orders-test',null,'[{"product_id":"order-c","quantity":4,"reward_quantity":1}]','30000000-0000-4000-8000-000000000006',repeat('r',32))$$,'non-repeating dynamic promotion succeeds');
set local role postgres;
select is((select total_amount from public.orders where client_request_id='30000000-0000-4000-8000-000000000006'),45000,'non-repeating offer applies only once');
select is((select quantity_available from public.products where id='order-c'),1,'free items are still reserved from stock');

set local role postgres;
with inserted as (
  insert into public.orders(shop_id,customer_name,total_amount,status,client_request_id,expires_at)
  select '21000000-0000-4000-8000-000000000001','rate-active-' || value,0,'pending',gen_random_uuid(),now()+interval '10 minutes'
  from generate_series(1,8) value
  returning id,client_request_id
)
insert into private.checkout_reservation_clients(order_id,client_request_id,shop_id,fingerprint_hash)
select id,client_request_id,'21000000-0000-4000-8000-000000000001',repeat('9',64) from inserted;

set local role service_role;
select throws_ok($$select * from public.create_order_rate_limited('orders-test',null,'[{"product_id":"order-a","quantity":1}]','30000000-0000-4000-8000-000000000009',repeat('w',32),repeat('9',64))$$,'Too many active checkout reservations. Complete or cancel an existing order first.','ninth active reservation for one network is rate limited');

set local role postgres;
with inserted as (
  insert into public.orders(shop_id,customer_name,total_amount,status,client_request_id,cancelled_at)
  select '21000000-0000-4000-8000-000000000001','rate-recent-' || value,0,'cancelled',gen_random_uuid(),now()
  from generate_series(1,30) value
  returning id,client_request_id
)
insert into private.checkout_reservation_clients(order_id,client_request_id,shop_id,fingerprint_hash)
select id,client_request_id,'21000000-0000-4000-8000-000000000001',repeat('8',64) from inserted;

set local role service_role;
select throws_ok($$select * from public.create_order_rate_limited('orders-test',null,'[{"product_id":"order-a","quantity":1}]','30000000-0000-4000-8000-000000000010',repeat('z',32),repeat('8',64))$$,'Too many checkout attempts. Please wait a few minutes and try again.','thirty-first recent reservation for one network is rate limited');

set local role postgres;
with inserted as (
  insert into public.orders(shop_id,customer_name,total_amount,status,client_request_id,cancelled_at)
  select '21000000-0000-4000-8000-000000000001','old-history-' || value,0,'cancelled',gen_random_uuid(),now()
  from generate_series(1,100) value
  returning id,client_request_id
)
insert into private.checkout_reservation_clients(order_id,client_request_id,shop_id,fingerprint_hash,created_at)
select id,client_request_id,'21000000-0000-4000-8000-000000000001',repeat('7',64),now()-interval '1 year' from inserted;
set local role service_role;
select lives_ok($$select * from public.create_order_rate_limited('orders-test',null,'[{"product_id":"order-a","quantity":1}]','30000000-0000-4000-8000-000000000011',repeat('v',32),repeat('7',64))$$,'historical fingerprint rows do not slow or block the active reservation window');

set local role postgres;
create temporary table notification_order_id as
with inserted as (
  insert into public.orders(shop_id,customer_name,total_amount,status,client_request_id,expires_at)
  values('21000000-0000-4000-8000-000000000001','notification-lease',0,'pending',gen_random_uuid(),now()+interval '10 minutes')
  returning id
)
select id from inserted;
create temporary table notification_claims(label text primary key, payload jsonb not null);
grant select on notification_order_id to service_role;
grant select, insert on notification_claims to service_role;
select ok(not has_function_privilege('authenticated','public.claim_order_notification_delivery(uuid,uuid)','execute'),'browser roles cannot claim notification delivery leases');
select ok(not has_function_privilege('service_role','public.complete_order_notification_delivery(uuid,uuid,boolean,text)','execute'),'service role cannot bypass targeted notification retry state');
set local role service_role;
insert into notification_claims values('first',public.claim_order_notification_delivery((select id from notification_order_id),'21000000-0000-4000-8000-000000000001'));
select is((select payload->>'outcome' from notification_claims where label='first'),'claimed','service role claims a new notification delivery');
select is(public.claim_order_notification_delivery((select id from notification_order_id),'21000000-0000-4000-8000-000000000001')->>'outcome','in_progress','concurrent delivery observes the active lease');
select ok(public.complete_order_notification_delivery((select id from notification_order_id),(select (payload->>'lease_token')::uuid from notification_claims where label='first'),false,'temporary push outage',array['https://push.test/retry']),'failed notification attempts remain retryable');
insert into notification_claims values('second',public.claim_order_notification_delivery((select id from notification_order_id),'21000000-0000-4000-8000-000000000001'));
select is((select payload->>'outcome' from notification_claims where label='second'),'claimed','retryable notification can be claimed again');
select is((select payload #>> '{retry_endpoints,0}' from notification_claims where label='second'),'https://push.test/retry','retry claims target only failed subscriptions');
select is(public.complete_order_notification_delivery((select id from notification_order_id),gen_random_uuid(),true,null,'{}'),false,'an expired delivery attempt cannot complete a newer lease');
select ok(public.complete_order_notification_delivery((select id from notification_order_id),(select (payload->>'lease_token')::uuid from notification_claims where label='second'),true,null,'{}'),'successful retry completes notification delivery');
select is(public.claim_order_notification_delivery((select id from notification_order_id),'21000000-0000-4000-8000-000000000001')->>'outcome','delivered','delivered notifications remain deduplicated');
select * from finish();rollback;
