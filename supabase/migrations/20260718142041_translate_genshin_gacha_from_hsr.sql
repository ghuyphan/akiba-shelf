-- Translate and publish the Genshin gacha configuration based on the active HSR configuration.
do $translate_genshin$
declare
  v_shop_id uuid;
  v_owner_id uuid;
  v_new_entries jsonb;
  v_new_banners jsonb;
  v_new_settings jsonb;
  v_config jsonb;
begin
  select shop.id
  into v_shop_id
  from public.shops shop
  where shop.slug = 'arigatosan' or shop.id = '00000000-0000-4000-8000-000000000001';

  if v_shop_id is null then
    return;
  end if;

  -- Skip translation if HSR has no entries (e.g. fresh database in CI)
  if not exists (
    select 1
    from public.gacha_game_configs
    where shop_id = v_shop_id
      and game_type = 'hsr'
      and jsonb_typeof(config->'entries') = 'array'
      and jsonb_array_length(config->'entries') > 0
  ) then
    return;
  end if;

  select member.user_id
  into strict v_owner_id
  from public.shop_members member
  where member.shop_id = v_shop_id
    and member.role = 'owner'
    and member.active
  order by member.created_at
  limit 1;

  -- 1. Translate entries from HSR
  select jsonb_agg(
    jsonb_build_object(
      'shop_id', v_shop_id::text,
      'banner_id', case old_banner.sort_order
        when 0 then '82938a89-1ede-4ca2-b8df-d069c3404673'::text
        when 1 then '531be07e-5ec2-4e96-b456-9d295f08d549'::text
        when 2 then '994bf2a6-b51c-43f0-bbcd-631cda4054a1'::text
      end,
      'product_id', entry.product_id,
      'kind', case when entry.kind = 'lightcone' then 'weapon' else entry.kind end,
      'element', case entry.element
        when 'wind' then 'anemo'
        when 'fire' then 'pyro'
        when 'ice' then 'cryo'
        when 'lightning' then 'electro'
        when 'quantum' then 'hydro'
        when 'imaginary' then 'dendro'
        when 'physical' then 'geo'
        else 'anemo'
      end,
      'weapon_type', case entry.weapon_type
        when 'destruction' then 'claymore'
        when 'hunt' then 'bow'
        when 'erudition' then 'catalyst'
        when 'harmony' then 'catalyst'
        when 'nihility' then 'sword'
        when 'preservation' then 'sword'
        when 'abundance' then 'polearm'
        else 'sword'
      end,
      'rarity', entry.rarity,
      'weight', entry.weight,
      'featured', entry.featured,
      'active', entry.active
    )
  )
  into v_new_entries
  from jsonb_to_recordset(
    (select config->'entries' from public.gacha_game_configs where shop_id = v_shop_id and game_type = 'hsr')
  ) as entry(
    banner_id uuid,
    product_id text,
    kind text,
    element text,
    weapon_type text,
    rarity integer,
    weight integer,
    featured boolean,
    active boolean
  )
  join jsonb_to_recordset(
    (select config->'banners' from public.gacha_game_configs where shop_id = v_shop_id and game_type = 'hsr')
  ) as old_banner(
    id uuid,
    sort_order integer
  ) on entry.banner_id = old_banner.id;

  -- 2. Build new banners
  v_new_banners := jsonb_build_array(
    jsonb_build_object(
      'id', '82938a89-1ede-4ca2-b8df-d069c3404673',
      'kind', 'character',
      'name', 'Character Event Wish: Frieren''s Journey',
      'theme', 'anemo',
      'active', true,
      'starts_at', '2026-07-18T00:00:00+07:00',
      'ends_at', '2026-07-20T12:00:00+07:00',
      'shop_id', v_shop_id::text,
      'sort_order', 0,
      'description', 'A Frieren-only wish: vintage stickers, cozy coasters, bookmarks and notes from the party''s journey.',
      'display_limit', 5
    ),
    jsonb_build_object(
      'id', '531be07e-5ec2-4e96-b456-9d295f08d549',
      'kind', 'weapon',
      'name', 'Epitome Invocation: Sunset Reverie',
      'theme', 'pyro',
      'active', true,
      'starts_at', '2026-07-18T00:00:00+07:00',
      'ends_at', '2026-07-20T12:00:00+07:00',
      'shop_id', v_shop_id::text,
      'sort_order', 1,
      'description', 'Warm sunset weapons from the Sunset & Berries series — coasters, bookmarks and dreamy stickers.',
      'display_limit', 5
    ),
    jsonb_build_object(
      'id', '994bf2a6-b51c-43f0-bbcd-631cda4054a1',
      'kind', 'character',
      'name', 'Wanderlust Invocation: Atelier & Friends',
      'theme', 'geo',
      'active', true,
      'starts_at', '2026-07-18T00:00:00+07:00',
      'ends_at', '2026-07-20T12:00:00+07:00',
      'shop_id', v_shop_id::text,
      'sort_order', 2,
      'description', 'The standard wish: Witch Hat Atelier stationery, WangXian badges and the Dungeon Meshi set.',
      'display_limit', 5
    )
  );

  -- 3. Build new settings
  v_new_settings := jsonb_build_object(
    'title', 'Wish upon the shelf',
    'enabled', true,
    'shop_id', v_shop_id::text,
    'game_type', 'genshin',
    'rare_pity', 9,
    'description', 'Meet a surprise character or discover a featured weapon from this shop.',
    'legendary_pity', 10,
    'rare_base_rate', 5.1,
    'rare_soft_pity', 8,
    'featured_item_rate', 50,
    'legendary_soft_pity', 9,
    'featured_guaranteed_after_loss', true
  );

  v_config := jsonb_build_object(
    'settings', v_new_settings,
    'banners', v_new_banners,
    'entries', v_new_entries
  );

  update public.gacha_game_configs
  set config = v_config
  where shop_id = v_shop_id
    and game_type = 'genshin';

  -- Authorize for the publish RPC
  perform set_config('request.jwt.claim.sub', v_owner_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_owner_id::text, 'role', 'authenticated')::text,
    true
  );

  perform public.publish_gacha_configuration_v5(v_shop_id, 'genshin', v_config);
end
$translate_genshin$;
