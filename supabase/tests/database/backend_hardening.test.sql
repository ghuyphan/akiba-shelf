begin;
create extension if not exists pgtap with schema extensions;
select plan(52);

insert into auth.users(
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at
) values
('70000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','backend-owner@test.local','',now(),now(),now()),
('70000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','backend-outsider@test.local','',now(),now(),now()),
('70000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','backend-admin@test.local','',now(),now(),now()),
('70000000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','backend-staff@test.local','',now(),now(),now());

insert into public.shops(id,name,slug,created_by) values
('71000000-0000-4000-8000-000000000001','Backend Source','backend-source','70000000-0000-4000-8000-000000000001'),
('71000000-0000-4000-8000-000000000002','Backend Demo','backend-demo','70000000-0000-4000-8000-000000000001');
update public.shops
set catalog_source_shop_id='71000000-0000-4000-8000-000000000001',
    accepting_orders=false
where id='71000000-0000-4000-8000-000000000002';
insert into public.shop_members(shop_id,user_id,role) values
('71000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001','owner'),
('71000000-0000-4000-8000-000000000002','70000000-0000-4000-8000-000000000001','owner'),
('71000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000003','admin'),
('71000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000004','staff');

insert into public.products(
  id,shop_id,name,item_code,price_vnd,quantity_available,category,featured,sort_order
)
select
  'backend-product-' || value,
  '71000000-0000-4000-8000-000000000001',
  'Product ' || value,
  'BACKEND-' || value,
  value * 1000,
  10,
  case when value % 2 = 0 then 'Even' else 'Odd' end,
  value = 25,
  value
from generate_series(1,25) value;
insert into public.booth_settings(id,shop_id,booth_name)
values('backend-booth','71000000-0000-4000-8000-000000000001','Backend Booth');
insert into public.promotions(shop_id,enabled,buy_quantity,free_quantity,repeatable)
values('71000000-0000-4000-8000-000000000001',true,2,1,true);
insert into public.promotion_products(shop_id,product_id,role)
values('71000000-0000-4000-8000-000000000001','backend-product-1','both');

select ok(has_function_privilege('anon','public.get_storefront_bootstrap(text)','execute'),'anonymous storefront can call the public bootstrap');
select ok(has_function_privilege('service_role','public.create_order_rate_limited(text,text,jsonb,uuid,text,text)','execute'),'previous checkout function contract remains available during rollback');
select ok(not has_function_privilege('anon','public.create_order_rate_limited(text,text,jsonb,uuid,text,text)','execute'),'legacy checkout compatibility remains service-only');
select ok(not has_function_privilege('anon','public.claim_order_notification_batch(integer)','execute'),'anonymous clients cannot claim notification jobs');
select ok(not has_function_privilege('authenticated','public.register_push_subscription(uuid,uuid,text,text,text,text)','execute'),'browser clients cannot spoof protected subscription actors');
select ok(has_function_privilege('authenticated','public.get_order_notification_status(uuid,integer)','execute'),'staff can call the safe notification status projection');
select ok(has_function_privilege('authenticated','public.retry_order_notification(uuid,uuid,text)','execute'),'authenticated staff can reach the role-checked notification retry RPC');
select ok(not has_function_privilege('authenticated','public.configure_order_notification_drain_schedule()','execute'),'only the service role can configure the notification drain schedule');

set local role anon;
select is((public.get_storefront_bootstrap('backend-demo')->'shop'->>'id')::uuid,'71000000-0000-4000-8000-000000000002'::uuid,'bootstrap resolves the storefront by slug');
select is((public.get_storefront_bootstrap('backend-demo')->>'catalog_shop_id')::uuid,'71000000-0000-4000-8000-000000000001'::uuid,'bootstrap resolves the catalog source server-side');
select is(jsonb_array_length(public.get_storefront_bootstrap('backend-demo')->'products'),24,'bootstrap returns the first 24 products');
select ok((public.get_storefront_bootstrap('backend-demo')->>'has_more')::boolean,'bootstrap reports the twenty-fifth product');
select is(public.get_storefront_bootstrap('backend-demo')->'products'->0->>'id','backend-product-25','recommended order keeps featured products first');
select is(public.get_storefront_bootstrap('backend-demo')->'booth'->>'booth_name','Backend Booth','bootstrap returns public booth settings from the source');
select is(public.get_storefront_bootstrap('backend-demo')->'categories','["Even", "Odd"]'::jsonb,'bootstrap returns sorted public categories');
select is(public.get_storefront_bootstrap('backend-demo')->'promotion'->'qualifying_product_ids','["backend-product-1"]'::jsonb,'bootstrap includes public promotion mappings');
select isnt(public.get_storefront_bootstrap('backend-demo') ? 'payment',true,'bootstrap keeps payment settings lazy');
select is((public.get_storefront_bootstrap('backend-demo')->>'gacha_enabled')::boolean,false,'bootstrap reports no enabled published gacha game');

set local role service_role;
select lives_ok($$select public.register_push_subscription('70000000-0000-4000-8000-000000000004','71000000-0000-4000-8000-000000000001','https://push.test/staff','key','auth','pgTAP')$$,'active staff can register a protected subscription');
select is((select count(*) from public.get_active_push_subscriptions('71000000-0000-4000-8000-000000000001',100)),1::bigint,'notification recipients include active members only');
set local role postgres;
update public.shop_members set active=false
where shop_id='71000000-0000-4000-8000-000000000001'
  and user_id='70000000-0000-4000-8000-000000000004';
select is((select count(*) from public.push_subscriptions where user_id='70000000-0000-4000-8000-000000000004'),0::bigint,'deactivating a member removes future push access');
set local role service_role;
select lives_ok($$select public.register_push_subscription('70000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000001','https://push.test/1','key','auth','pgTAP')$$,'protected subscription registration accepts an active member');
select lives_ok($$select public.register_push_subscription('70000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000001','https://push.test/2','key','auth','pgTAP')$$,'second protected subscription succeeds');
select lives_ok($$select public.register_push_subscription('70000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000001','https://push.test/3','key','auth','pgTAP')$$,'third protected subscription succeeds');
select lives_ok($$select public.register_push_subscription('70000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000001','https://push.test/4','key','auth','pgTAP')$$,'fourth protected subscription succeeds');
select lives_ok($$select public.register_push_subscription('70000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000001','https://push.test/5','key','auth','pgTAP')$$,'fifth protected subscription succeeds');
select throws_ok($$select public.register_push_subscription('70000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000001','https://push.test/6','key','auth','pgTAP')$$,'Push subscription limit reached','per-user and shop subscription quota is atomic');
select ok(public.unregister_push_subscription('70000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000001','https://push.test/5'),'protected unregistration deletes only the caller endpoint');

set local role postgres;
insert into public.orders(
  id,shop_id,customer_name,total_amount,status,client_request_id,expires_at
) values(
  '72000000-0000-4000-8000-000000000001',
  '71000000-0000-4000-8000-000000000001',
  'Queue',0,'pending',gen_random_uuid(),now()+interval '10 minutes'
);
set local role service_role;
select lives_ok($$select public.enqueue_order_notification('72000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000001')$$,'order notification is durably enqueued');
set local role postgres;
select is((select status from public.order_notification_events where order_id='72000000-0000-4000-8000-000000000001'),'queued','new notification jobs start queued');

update public.order_notification_events set max_attempts=1 where order_id='72000000-0000-4000-8000-000000000001';
create temporary table backend_claim as
select * from public.claim_order_notification_batch(10)
where order_id='72000000-0000-4000-8000-000000000001';
select ok(public.complete_order_notification_delivery(
  '72000000-0000-4000-8000-000000000001',
  (select lease_token from backend_claim),
  false,
  'push_delivery_failed',
  array['https://push.test/retry']
),'claimed queue jobs can be completed independently');
select is((select status from public.order_notification_events where order_id='72000000-0000-4000-8000-000000000001'),'dead_letter','exhausted jobs move to the dead letter state');
select is((select count(*) from public.order_notification_attempts where order_id='72000000-0000-4000-8000-000000000001'),1::bigint,'notification attempt history is retained');

insert into public.orders(
  id,shop_id,customer_name,total_amount,status,client_request_id,expires_at
) values(
  '72000000-0000-4000-8000-000000000002',
  '71000000-0000-4000-8000-000000000001',
  'Expired lease',0,'pending',gen_random_uuid(),now()+interval '10 minutes'
);
select public.enqueue_order_notification(
  '72000000-0000-4000-8000-000000000002',
  '71000000-0000-4000-8000-000000000001'
);
update public.order_notification_events
set status='sending', attempt_count=2, max_attempts=2,
    lease_token='73000000-0000-4000-8000-000000000001',
    lease_expires_at=now()-interval '1 minute',
    retry_endpoints=array['https://push.test/exhausted']
where order_id='72000000-0000-4000-8000-000000000002';
create temporary table exhausted_batch as
select * from public.claim_order_notification_batch(10);
select is((select count(*) from exhausted_batch where order_id='72000000-0000-4000-8000-000000000002'),0::bigint,'an exhausted lease is dead-lettered instead of reclaimed');
select is((select status from public.order_notification_events where order_id='72000000-0000-4000-8000-000000000002'),'dead_letter','an expired lease at max attempts becomes dead letter');
select is((select count(*) from public.order_notification_attempts where order_id='72000000-0000-4000-8000-000000000002'),1::bigint,'lease exhaustion writes one terminal attempt');
select is((select error_code from public.order_notification_attempts where order_id='72000000-0000-4000-8000-000000000002'),'notification_worker_lease_exhausted','lease exhaustion records an actionable error code');

insert into public.orders(id,shop_id,customer_name,total_amount,status,client_request_id,expires_at)
values('72000000-0000-4000-8000-000000000004','71000000-0000-4000-8000-000000000001','Reclaimed lease',0,'pending',gen_random_uuid(),now()+interval '10 minutes');
select public.enqueue_order_notification('72000000-0000-4000-8000-000000000004','71000000-0000-4000-8000-000000000001');
update public.order_notification_events set status='sending',attempt_count=1,max_attempts=3,
  lease_token='73000000-0000-4000-8000-000000000004',lease_expires_at=now()-interval '1 minute'
where order_id='72000000-0000-4000-8000-000000000004';
create temporary table reclaimed_batch as select * from public.claim_order_notification_batch(10);
select is((select attempt_number from reclaimed_batch where order_id='72000000-0000-4000-8000-000000000004'),2,'an expired non-final lease is reclaimed as the next attempt');
select is((select error_code from public.order_notification_attempts where order_id='72000000-0000-4000-8000-000000000004'),'notification_worker_lease_expired','every expired lease is retained in attempt history');

insert into public.orders(id,shop_id,customer_name,total_amount,status,client_request_id,expires_at)
values('72000000-0000-4000-8000-000000000005','71000000-0000-4000-8000-000000000001','Partial delivery',0,'pending',gen_random_uuid(),now()+interval '10 minutes');
select public.enqueue_order_notification('72000000-0000-4000-8000-000000000005','71000000-0000-4000-8000-000000000001');
create temporary table partial_claim as select * from public.claim_order_notification_batch(10)
where order_id='72000000-0000-4000-8000-000000000005';
select ok(public.complete_order_notification_delivery(
  '72000000-0000-4000-8000-000000000005',(select lease_token from partial_claim),false,
  'push_delivery_failed',array['https://push.test/retry'],1
),'partial delivery records successes while retaining failed endpoints');
update public.order_notification_events set next_attempt_at=now()
where order_id='72000000-0000-4000-8000-000000000005';
create temporary table partial_retry as select * from public.claim_order_notification_batch(10)
where order_id='72000000-0000-4000-8000-000000000005';
select ok(public.complete_order_notification_delivery(
  '72000000-0000-4000-8000-000000000005',(select lease_token from partial_retry),true,
  'no_valid_subscriptions','{}',0
),'a final stale retry endpoint completes the cumulative delivery');
select is((select status from public.order_notification_events where order_id='72000000-0000-4000-8000-000000000005'),'delivered','a previously successful delivery is never downgraded to skipped');
select is((select successful_delivery_count from public.order_notification_events where order_id='72000000-0000-4000-8000-000000000005'),1,'cumulative successful delivery count is retained');

insert into public.orders(
  id,shop_id,customer_name,total_amount,status,client_request_id,expires_at
) values(
  '72000000-0000-4000-8000-000000000003',
  '71000000-0000-4000-8000-000000000001',
  'No subscribers',0,'pending',gen_random_uuid(),now()+interval '10 minutes'
);
select public.enqueue_order_notification(
  '72000000-0000-4000-8000-000000000003',
  '71000000-0000-4000-8000-000000000001'
);
create temporary table skipped_claim as
select * from public.claim_order_notification_batch(10)
where order_id='72000000-0000-4000-8000-000000000003';
select ok(public.complete_order_notification_delivery(
  '72000000-0000-4000-8000-000000000003',
  (select lease_token from skipped_claim),
  true,
  'no_valid_subscriptions',
  '{}'
),'a no-subscriber delivery completes without retrying');
select is((select status from public.order_notification_events where order_id='72000000-0000-4000-8000-000000000003'),'skipped','no valid subscribers is represented as skipped instead of delivered');
select is((select last_error from public.order_notification_events where order_id='72000000-0000-4000-8000-000000000003'),'no_valid_subscriptions','skipped delivery retains its terminal reason');
select is(public.claim_order_notification_delivery(
  '72000000-0000-4000-8000-000000000003',
  '71000000-0000-4000-8000-000000000001'
)->>'outcome','skipped','skipped deliveries remain terminal and reclaim-safe');

set local role authenticated;
set local request.jwt.claim.sub='70000000-0000-4000-8000-000000000004';
select throws_ok($$select public.retry_order_notification('71000000-0000-4000-8000-000000000001','72000000-0000-4000-8000-000000000003','staff retry')$$,'42501','Shop admin access required','staff cannot retry a terminal notification');

set local request.jwt.claim.sub='70000000-0000-4000-8000-000000000003';
select ok(public.retry_order_notification(
  '71000000-0000-4000-8000-000000000001',
  '72000000-0000-4000-8000-000000000003',
  'admin requested retry'
),'shop admins can requeue a skipped notification');

set local role postgres;
select is((select status from public.order_notification_events where order_id='72000000-0000-4000-8000-000000000003'),'queued','authorized retry makes the notification due again');
select ok((select max_attempts > attempt_count from public.order_notification_events where order_id='72000000-0000-4000-8000-000000000003'),'authorized retry grants a bounded new attempt budget');
select is((
  select jsonb_build_object(
    'actor_user_id', actor_user_id,
    'previous_status', previous_status,
    'reason', reason
  )
  from public.order_notification_requeue_actions
  where order_id='72000000-0000-4000-8000-000000000003'
),jsonb_build_object(
  'actor_user_id','70000000-0000-4000-8000-000000000003'::uuid,
  'previous_status','skipped',
  'reason','admin requested retry'
),'notification retries keep a staff-visible audit record');

select * from finish();
rollback;
