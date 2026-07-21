begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at) values
('40000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','categories-staff@test.local','',now(),now(),now()),
('40000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','categories-outsider@test.local','',now(),now(),now());
insert into public.shops(id,name,slug,created_by) values
('41000000-0000-4000-8000-000000000001','Categories Shop','categories-shop','40000000-0000-4000-8000-000000000001'),
('41000000-0000-4000-8000-000000000002','Inactive Shop','categories-inactive','40000000-0000-4000-8000-000000000002');
update public.shops set active=false where id='41000000-0000-4000-8000-000000000002';
insert into public.shop_members(shop_id,user_id,role) values
('41000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','staff');
insert into public.products(id,shop_id,name,item_code,quantity_available,category,active) values
('cat-a','41000000-0000-4000-8000-000000000001','A','CAT-A',1,'Print',true),
('cat-b','41000000-0000-4000-8000-000000000001','B','CAT-B',1,'Acrylic',true),
('cat-c','41000000-0000-4000-8000-000000000001','C','CAT-C',1,'Acrylic',true),
('cat-padded','41000000-0000-4000-8000-000000000001','D','CAT-D',1,'  Print  ',true),
('cat-hidden','41000000-0000-4000-8000-000000000001','Hidden','CAT-H',1,'Secret',false),
('cat-blank','41000000-0000-4000-8000-000000000001','Blank','CAT-X',1,'   ',true),
('cat-inactive-shop','41000000-0000-4000-8000-000000000002','Z','CAT-Z',1,'Zine',true);
insert into public.orders(shop_id,total_amount,status) values
('41000000-0000-4000-8000-000000000001',10000,'pending'),
('41000000-0000-4000-8000-000000000001',20000,'pending'),
('41000000-0000-4000-8000-000000000001',30000,'confirmed'),
('41000000-0000-4000-8000-000000000001',40000,'cancelled');
update public.orders
set created_at = now() - interval '2 days'
where shop_id = '41000000-0000-4000-8000-000000000001'
  and status = 'confirmed';

set local role anon;
select results_eq(
  $$select category from public.get_public_product_categories('41000000-0000-4000-8000-000000000001')$$,
  array['Acrylic','Print'],
  'anonymous sees distinct trimmed active-product categories in order'
);
select is_empty(
  $$select category from public.get_public_product_categories('41000000-0000-4000-8000-000000000002')$$,
  'anonymous sees no categories from an inactive shop'
);
select is_empty(
  $$select category from public.get_public_product_categories('41000000-0000-4000-8000-000000000009')$$,
  'anonymous sees no categories from an unknown shop'
);
select ok(has_function_privilege('anon','public.get_public_product_categories(uuid)','execute'),'anonymous can execute public product categories');
select ok(not has_function_privilege('anon','public.get_order_status_counts(uuid,timestamptz,timestamptz)','execute'),'anonymous cannot execute order status counts');
select ok(not has_function_privilege('anon','public.create_order(text,text,jsonb,uuid,text)','execute'),'anonymous cannot invoke the internal order transaction');
select ok(not has_function_privilege('anon','public.create_order_rate_limited(text,text,jsonb,uuid,text,text)','execute'),'anonymous cannot bypass the checkout Edge Function');

set local role authenticated;
set local request.jwt.claim.sub='40000000-0000-4000-8000-000000000002';
select results_eq(
  $$select category from public.get_public_product_categories('41000000-0000-4000-8000-000000000001')$$,
  array['Acrylic','Print'],
  'authenticated non-member sees the same public categories as anonymous'
);
select is_empty(
  $$select category from public.get_public_product_categories('41000000-0000-4000-8000-000000000002')$$,
  'authenticated non-member sees no categories from an inactive shop'
);
select ok(has_function_privilege('authenticated','public.get_public_product_categories(uuid)','execute'),'authenticated can execute public product categories');
select ok(has_function_privilege('authenticated','public.get_order_status_counts(uuid,timestamptz,timestamptz)','execute'),'authenticated can execute order status counts');
select ok(not has_function_privilege('authenticated','public.create_order(text,text,jsonb,uuid,text)','execute'),'authenticated users cannot invoke the internal order transaction');
select ok(not has_function_privilege('authenticated','public.create_order_rate_limited(text,text,jsonb,uuid,text,text)','execute'),'authenticated users cannot bypass the checkout Edge Function');
select is(
  public.get_order_status_counts('41000000-0000-4000-8000-000000000001'),
  '{"pending":0,"confirmed":0,"cancelled":0,"expired":0,"all":0}'::jsonb,
  'non-member receives zeroed order status counts'
);

set local request.jwt.claim.sub='40000000-0000-4000-8000-000000000001';
select is(
  public.get_order_status_counts('41000000-0000-4000-8000-000000000001'),
  '{"pending":2,"confirmed":1,"cancelled":1,"expired":0,"all":4}'::jsonb,
  'shop member receives every status count in one call'
);
select is(
  public.get_order_status_counts(
    '41000000-0000-4000-8000-000000000001',
    now() - interval '1 hour',
    now() + interval '1 hour'
  ),
  '{"pending":2,"confirmed":0,"cancelled":1,"expired":0,"all":3}'::jsonb,
  'shop member can scope every status count to a date window'
);

set local role postgres;
select ok(has_function_privilege('service_role','public.create_order(text,text,jsonb,uuid,text)','execute'),'service role can invoke the internal order transaction');
select ok(has_function_privilege('service_role','public.create_order_rate_limited(text,text,jsonb,uuid,text,text)','execute'),'service role can invoke the checkout wrapper');
update public.shops set active=false where id='41000000-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claim.sub='40000000-0000-4000-8000-000000000001';
select is(
  public.get_order_status_counts('41000000-0000-4000-8000-000000000001'),
  '{"pending":0,"confirmed":0,"cancelled":0,"expired":0,"all":0}'::jsonb,
  'member of an inactive shop receives zeroed order status counts'
);
select is_empty(
  $$select category from public.get_public_product_categories('41000000-0000-4000-8000-000000000001')$$,
  'deactivated shop stops exposing categories'
);

select * from finish();
rollback;
