begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users(
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at
) values (
  '81000000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'featured-owner@test.local',
  '', now(), now(), now()
);
insert into public.shops(id, name, slug, created_by) values (
  '82000000-0000-4000-8000-000000000001',
  'Featured Shop',
  'featured-shop',
  '81000000-0000-4000-8000-000000000001'
);
insert into public.shop_members(shop_id, user_id, role) values (
  '82000000-0000-4000-8000-000000000001',
  '81000000-0000-4000-8000-000000000001',
  'owner'
);

select lives_ok($$
  insert into public.products(
    id, shop_id, name, item_code, price_vnd, quantity_available,
    category, featured, sort_order
  )
  select
    'featured-limit-' || value,
    '82000000-0000-4000-8000-000000000001',
    'Featured ' || value,
    'FEATURED-' || value,
    1000,
    1,
    'Test',
    true,
    value
  from generate_series(1, 8) value
$$, 'the first eight featured products are accepted');

select throws_ok($$
  insert into public.products(
    id, shop_id, name, item_code, price_vnd, quantity_available,
    category, featured, sort_order
  ) values (
    'featured-limit-9',
    '82000000-0000-4000-8000-000000000001',
    'Featured 9',
    'FEATURED-9',
    1000,
    1,
    'Test',
    true,
    9
  )
$$, '23514', 'A shop can feature at most 8 products',
   'the ninth featured product is rejected');

update public.products set featured = false where id = 'featured-limit-1';
select lives_ok($$
  insert into public.products(
    id, shop_id, name, item_code, price_vnd, quantity_available,
    category, featured, sort_order
  ) values (
    'featured-limit-9',
    '82000000-0000-4000-8000-000000000001',
    'Featured 9',
    'FEATURED-9',
    1000,
    1,
    'Test',
    true,
    9
  )
$$, 'a released featured slot can be reused');

select is(
  (select count(*) from public.products
   where shop_id = '82000000-0000-4000-8000-000000000001' and featured),
  8::bigint,
  'the database retains exactly eight featured products'
);

select * from finish();
rollback;
