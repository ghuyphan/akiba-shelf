begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

insert into auth.users(
  id,instance_id,aud,role,email,encrypted_password,
  email_confirmed_at,created_at,updated_at
) values (
  '50000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000000',
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
)
select
  'gacha-product-' || product_number,
  '51000000-0000-4000-8000-000000000001',
  'Gacha Product ' || product_number,
  'GACHA-' || product_number,
  5,
  'Test',
  true
from generate_series(1, 7) product_number;

set local role authenticated;
set local request.jwt.claim.sub='50000000-0000-4000-8000-000000000001';

select ok(
  has_function_privilege(
    'authenticated',
    'public.publish_gacha_configuration_v6(uuid,text,jsonb)',
    'execute'
  ),
  'authenticated admins can execute the current publish RPC'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.publish_gacha_configuration_v5(uuid,text,jsonb)',
    'execute'
  ),
  'authenticated clients cannot execute the internal v5 publish RPC'
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
  $$select public.publish_gacha_configuration_v6(
    '51000000-0000-4000-8000-000000000001',
    'genshin',
    '{
      "settings":{"enabled":true,"title":"Test Wish","description":"","rare_base_rate":6.5,"legendary_base_rate":1.25,"lightcone_legendary_base_rate":0.8,"rare_soft_pity":8,"legendary_soft_pity":40,"lightcone_legendary_soft_pity":65,"featured_item_rate":60,"featured_guaranteed_after_loss":true,"rare_pity":10,"legendary_pity":50,"lightcone_legendary_pity":80},
      "banners":[{"id":"52000000-0000-4000-8000-000000000001","name":"Character Banner","description":"","kind":"character","theme":"anemo","display_limit":4,"active":true,"starts_at":"2026-07-18T10:00:00Z","ends_at":"2026-07-19T10:00:00Z"}],
      "entries":[
        {"banner_id":"52000000-0000-4000-8000-000000000001","product_id":"gacha-product-1","kind":"character","element":"anemo","weapon_type":"sword","rarity":5,"weight":100,"featured":true,"active":true},
        {"banner_id":"52000000-0000-4000-8000-000000000001","product_id":"gacha-product-2","kind":"character","element":"anemo","weapon_type":"sword","rarity":4,"weight":100,"featured":true,"active":true},
        {"banner_id":"52000000-0000-4000-8000-000000000001","product_id":"gacha-product-3","kind":"character","element":"anemo","weapon_type":"sword","rarity":4,"weight":100,"featured":true,"active":true},
        {"banner_id":"52000000-0000-4000-8000-000000000001","product_id":"gacha-product-4","kind":"character","element":"anemo","weapon_type":"sword","rarity":4,"weight":100,"featured":true,"active":true}
      ]
    }'::jsonb
  )$$,
  'owner publishes an official character composition'
);
select is(
  (select game_type from public.gacha_settings where shop_id='51000000-0000-4000-8000-000000000001'),
  'genshin',
  'published game type is stored'
);
select is(
  (select legendary_base_rate::text from public.gacha_settings where shop_id='51000000-0000-4000-8000-000000000001'),
  '1.25',
  'published configurable rate is stored'
);
select is(
  (select (featured_item_rate::text || '/' || legendary_soft_pity::text) from public.gacha_settings where shop_id='51000000-0000-4000-8000-000000000001'),
  '60.00/40',
  'published featured odds and soft pity are stored'
);
select is(
  (select starts_at::text from public.gacha_banners where id='52000000-0000-4000-8000-000000000001'),
  '2026-07-18 10:00:00+00',
  'published banner schedule is stored'
);

select lives_ok(
  $$select public.publish_gacha_configuration_v6(
    '51000000-0000-4000-8000-000000000001',
    'genshin',
    '{
      "settings":{"enabled":true,"title":"Test Wish","description":"","rare_base_rate":6.5,"legendary_base_rate":1.25,"lightcone_legendary_base_rate":0.8,"rare_soft_pity":8,"legendary_soft_pity":30,"lightcone_legendary_soft_pity":40,"featured_item_rate":60,"featured_guaranteed_after_loss":true,"rare_pity":10,"legendary_pity":40,"lightcone_legendary_pity":50},
      "banners":[{"id":"52000000-0000-4000-8000-000000000001","name":"Character Banner","description":"","kind":"character","theme":"anemo","display_limit":4,"active":true}],
      "entries":[
        {"banner_id":"52000000-0000-4000-8000-000000000001","product_id":"gacha-product-1","kind":"character","element":"anemo","weapon_type":"sword","rarity":5,"weight":100,"featured":true,"active":true},
        {"banner_id":"52000000-0000-4000-8000-000000000001","product_id":"gacha-product-2","kind":"character","element":"anemo","weapon_type":"sword","rarity":4,"weight":100,"featured":true,"active":true},
        {"banner_id":"52000000-0000-4000-8000-000000000001","product_id":"gacha-product-3","kind":"character","element":"anemo","weapon_type":"sword","rarity":4,"weight":100,"featured":true,"active":true},
        {"banner_id":"52000000-0000-4000-8000-000000000001","product_id":"gacha-product-4","kind":"character","element":"anemo","weapon_type":"sword","rarity":4,"weight":100,"featured":true,"active":true}
      ]
    }'::jsonb
  )$$,
  'owner can republish with hard pity lower than previously saved soft pity'
);
select is(
  (select lightcone_legendary_pity::text || '/' || lightcone_legendary_soft_pity::text from public.gacha_settings where shop_id='51000000-0000-4000-8000-000000000001'),
  '50/40',
  'updated hard and soft pities are stored'
);

select lives_ok(
  $$select public.publish_gacha_configuration_v6(
    '51000000-0000-4000-8000-000000000001',
    'genshin',
    '{
      "settings":{"enabled":true,"title":"Weapon Wish","description":""},
      "banners":[{"id":"52000000-0000-4000-8000-000000000002","name":"Weapon Banner","description":"","kind":"weapon","theme":"pyro","display_limit":7,"active":true}],
      "entries":[
        {"banner_id":"52000000-0000-4000-8000-000000000002","product_id":"gacha-product-1","kind":"weapon","element":"pyro","weapon_type":"sword","rarity":5,"weight":100,"featured":true,"active":true},
        {"banner_id":"52000000-0000-4000-8000-000000000002","product_id":"gacha-product-2","kind":"weapon","element":"pyro","weapon_type":"bow","rarity":5,"weight":100,"featured":true,"active":true},
        {"banner_id":"52000000-0000-4000-8000-000000000002","product_id":"gacha-product-3","kind":"weapon","element":"pyro","weapon_type":"sword","rarity":4,"weight":100,"featured":true,"active":true},
        {"banner_id":"52000000-0000-4000-8000-000000000002","product_id":"gacha-product-4","kind":"weapon","element":"pyro","weapon_type":"claymore","rarity":4,"weight":100,"featured":true,"active":true},
        {"banner_id":"52000000-0000-4000-8000-000000000002","product_id":"gacha-product-5","kind":"weapon","element":"pyro","weapon_type":"polearm","rarity":4,"weight":100,"featured":true,"active":true},
        {"banner_id":"52000000-0000-4000-8000-000000000002","product_id":"gacha-product-6","kind":"weapon","element":"pyro","weapon_type":"bow","rarity":4,"weight":100,"featured":true,"active":true},
        {"banner_id":"52000000-0000-4000-8000-000000000002","product_id":"gacha-product-7","kind":"weapon","element":"pyro","weapon_type":"catalyst","rarity":4,"weight":100,"featured":true,"active":true}
      ]
    }'::jsonb
  )$$,
  'owner publishes an official seven-slot weapon composition'
);
select is(
  (select display_limit::text from public.gacha_banners where id='52000000-0000-4000-8000-000000000002'),
  '7',
  'weapon banner stores seven display slots'
);

select throws_ok(
  $$select public.publish_gacha_configuration_v6(
    '51000000-0000-4000-8000-000000000001',
    'genshin',
    '{
      "settings":{"enabled":true,"title":"Incomplete Weapon Wish","description":""},
      "banners":[{"id":"52000000-0000-4000-8000-000000000002","name":"Incomplete Weapon Banner","description":"","kind":"weapon","theme":"pyro","display_limit":7,"active":true}],
      "entries":[
        {"banner_id":"52000000-0000-4000-8000-000000000002","product_id":"gacha-product-1","kind":"weapon","element":"pyro","weapon_type":"sword","rarity":5,"weight":100,"featured":true,"active":true},
        {"banner_id":"52000000-0000-4000-8000-000000000002","product_id":"gacha-product-2","kind":"weapon","element":"pyro","weapon_type":"bow","rarity":5,"weight":100,"featured":true,"active":true},
        {"banner_id":"52000000-0000-4000-8000-000000000002","product_id":"gacha-product-3","kind":"weapon","element":"pyro","weapon_type":"sword","rarity":4,"weight":100,"featured":true,"active":true}
      ]
    }'::jsonb
  )$$,
  'P0001',
  'Active Genshin banner "Incomplete Weapon Banner" needs exactly 2 featured 5-star and 5 featured 4-star items',
  'enabled weapon banners require the complete official composition'
);

select lives_ok(
  $$select public.publish_gacha_configuration_v6(
    '51000000-0000-4000-8000-000000000001',
    'hsr',
    '{
      "settings":{"enabled":true,"title":"Character Event Warp","description":""},
      "banners":[{"id":"52000000-0000-4000-8000-000000000003","name":"Character Event Warp","description":"","kind":"character","theme":"physical","display_limit":4,"active":true}],
      "entries":[
        {"banner_id":"52000000-0000-4000-8000-000000000003","product_id":"gacha-product-1","kind":"character","element":"physical","weapon_type":"destruction","rarity":5,"weight":100,"featured":true,"active":true},
        {"banner_id":"52000000-0000-4000-8000-000000000003","product_id":"gacha-product-2","kind":"character","element":"physical","weapon_type":"destruction","rarity":4,"weight":100,"featured":true,"active":true},
        {"banner_id":"52000000-0000-4000-8000-000000000003","product_id":"gacha-product-3","kind":"character","element":"physical","weapon_type":"harmony","rarity":4,"weight":100,"featured":true,"active":true},
        {"banner_id":"52000000-0000-4000-8000-000000000003","product_id":"gacha-product-4","kind":"character","element":"physical","weapon_type":"erudition","rarity":4,"weight":100,"featured":true,"active":true}
      ]
    }'::jsonb
  )$$,
  'HSR character event warps publish with one 5-star and three 4-star characters'
);

select lives_ok(
  $$select public.publish_gacha_configuration_v6(
    '51000000-0000-4000-8000-000000000001',
    'hsr',
    '{
      "settings":{"enabled":true,"title":"Light Cone Event Warp","description":""},
      "banners":[{"id":"52000000-0000-4000-8000-000000000004","name":"Light Cone Event Warp","description":"","kind":"lightcone","theme":"physical","display_limit":4,"active":true}],
      "entries":[
        {"banner_id":"52000000-0000-4000-8000-000000000004","product_id":"gacha-product-1","kind":"lightcone","element":"physical","weapon_type":"destruction","rarity":5,"weight":100,"featured":true,"active":true},
        {"banner_id":"52000000-0000-4000-8000-000000000004","product_id":"gacha-product-2","kind":"lightcone","element":"physical","weapon_type":"destruction","rarity":4,"weight":100,"featured":true,"active":true},
        {"banner_id":"52000000-0000-4000-8000-000000000004","product_id":"gacha-product-3","kind":"lightcone","element":"physical","weapon_type":"harmony","rarity":4,"weight":100,"featured":true,"active":true},
        {"banner_id":"52000000-0000-4000-8000-000000000004","product_id":"gacha-product-4","kind":"lightcone","element":"physical","weapon_type":"erudition","rarity":4,"weight":100,"featured":true,"active":true}
      ]
    }'::jsonb
  )$$,
  'HSR Light Cone event warps publish with one 5-star and three 4-star Light Cones'
);

select throws_ok(
  $$select public.publish_gacha_configuration_v6(
    '51000000-0000-4000-8000-000000000001',
    'hsr',
    '{
      "settings":{"enabled":true,"title":"Incomplete Light Cone Warp","description":""},
      "banners":[{"id":"52000000-0000-4000-8000-000000000004","name":"Incomplete Light Cone Warp","description":"","kind":"lightcone","theme":"physical","display_limit":4,"active":true}],
      "entries":[
        {"banner_id":"52000000-0000-4000-8000-000000000004","product_id":"gacha-product-1","kind":"lightcone","element":"physical","weapon_type":"destruction","rarity":5,"weight":100,"featured":true,"active":true},
        {"banner_id":"52000000-0000-4000-8000-000000000004","product_id":"gacha-product-2","kind":"lightcone","element":"physical","weapon_type":"destruction","rarity":4,"weight":100,"featured":true,"active":true},
        {"banner_id":"52000000-0000-4000-8000-000000000004","product_id":"gacha-product-3","kind":"lightcone","element":"physical","weapon_type":"harmony","rarity":4,"weight":100,"featured":true,"active":true}
      ]
    }'::jsonb
  )$$,
  'P0001',
  'Active HSR event banner "Incomplete Light Cone Warp" needs exactly one featured 5-star and three featured 4-star items',
  'enabled HSR event warps require the complete official composition'
);

select throws_ok(
  $$select public.publish_gacha_configuration_v6(
    '51000000-0000-4000-8000-000000000001',
    'genshin',
    '{
      "settings":{"enabled":true,"title":"Wrong Kind Wish","description":""},
      "banners":[{"id":"52000000-0000-4000-8000-000000000002","name":"Wrong Kind Banner","description":"","kind":"weapon","theme":"pyro","display_limit":7,"active":true}],
      "entries":[
        {"banner_id":"52000000-0000-4000-8000-000000000002","product_id":"gacha-product-1","kind":"character","element":"pyro","weapon_type":"sword","rarity":5,"weight":100,"featured":true,"active":true}
      ]
    }'::jsonb
  )$$,
  'P0001',
  'Featured items in banner "Wrong Kind Banner" must match its type and use 4-star or 5-star rarity',
  'featured item kind must match the banner kind'
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
