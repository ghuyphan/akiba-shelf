begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users(
  id,instance_id,aud,role,email,encrypted_password,
  email_confirmed_at,created_at,updated_at
) values (
  '50000000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated','authenticated','gacha-owner@test.local','',
  now(),now(),now()
);
insert into public.shops(id,name,slug,created_by) values (
  '51000000-0000-4000-8000-000000000001',
  'Gacha Test Shop',
  'gacha-test-shop',
  '50000000-0000-4000-8000-000000000001'
);
insert into public.shop_members(shop_id,user_id,role) values (
  '51000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000001',
  'owner'
);
insert into public.products(
  id,shop_id,name,item_code,quantity_available,category,active
) values (
  'gacha-product',
  '51000000-0000-4000-8000-000000000001',
  'Gacha Product',
  'GACHA-1',
  5,
  'Test',
  true
);

set local role authenticated;
set local request.jwt.claim.sub='50000000-0000-4000-8000-000000000001';

select ok(
  has_function_privilege(
    'authenticated',
    'public.publish_gacha_configuration(uuid,text,jsonb)',
    'execute'
  ),
  'authenticated admins can execute the publish RPC'
);
select ok(
  not has_table_privilege('authenticated','public.gacha_settings','insert'),
  'authenticated clients cannot write live settings directly'
);
select ok(
  not has_table_privilege('authenticated','public.gacha_banners','insert'),
  'authenticated clients cannot write live banners directly'
);
select ok(
  not has_table_privilege('authenticated','public.gacha_pool_entries','insert'),
  'authenticated clients cannot write live pool rows directly'
);

select lives_ok(
  $$select public.publish_gacha_configuration(
    '51000000-0000-4000-8000-000000000001',
    'genshin',
    '{
      "settings":{"enabled":true,"title":"Test Wish","description":"","rare_pity":10,"legendary_pity":50,"lightcone_legendary_pity":80},
      "banners":[{"id":"52000000-0000-4000-8000-000000000001","name":"Test Banner","description":"","kind":"character","theme":"anemo","display_limit":1,"active":true}],
      "entries":[{"banner_id":"52000000-0000-4000-8000-000000000001","product_id":"gacha-product","kind":"character","element":"anemo","weapon_type":"sword","rarity":5,"weight":100,"featured":true,"active":true}]
    }'::jsonb
  )$$,
  'owner publishes a valid configuration through the RPC'
);
select is(
  (select game_type from public.gacha_settings where shop_id='51000000-0000-4000-8000-000000000001'),
  'genshin',
  'published game type is stored'
);

set local role postgres;
delete from public.gacha_pool_entries
where shop_id='51000000-0000-4000-8000-000000000001';
delete from public.gacha_banners
where shop_id='51000000-0000-4000-8000-000000000001';
select throws_ok(
  $$select private.assert_published_gacha_configuration('51000000-0000-4000-8000-000000000001')$$,
  'P0001',
  'An enabled gacha configuration needs at least one active banner',
  'enabled projections cannot be empty'
);

select * from finish();
rollback;
