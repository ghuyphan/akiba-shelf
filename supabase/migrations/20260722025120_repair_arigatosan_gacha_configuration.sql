-- Record the Arigatosan repair applied before this migration was created.
-- The transformation is idempotent and preserves each configuration's
-- enabled state, schedule, weights, and unrelated item metadata.
create function private.repair_arigatosan_gacha_configuration(
  config jsonb,
  game_type text
)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  repaired jsonb := coalesce(config, '{}'::jsonb);
begin
  if jsonb_typeof(repaired) is distinct from 'object' then
    return config;
  end if;

  if game_type = 'genshin' then
    repaired := jsonb_set(
      repaired,
      '{banners}',
      coalesce((
        select jsonb_agg(
          banner.value || jsonb_build_object(
            'display_limit',
            case when banner.value ->> 'kind' = 'weapon' then 7 else 4 end
          )
          order by banner.ordinality
        )
        from jsonb_array_elements(coalesce(repaired -> 'banners', '[]'::jsonb))
          with ordinality as banner(value, ordinality)
      ), '[]'::jsonb)
    );
  end if;

  repaired := jsonb_set(
    repaired,
    '{entries}',
    coalesce((
      select jsonb_agg(
        case
          when game_type = 'genshin'
            and entry.value ->> 'product_id' = 'ba38bc82-1422-414e-b109-c4fd0e8aa9fc'
            then entry.value || jsonb_build_object('rarity', 4, 'featured', false)
          when game_type = 'genshin'
            and entry.value ->> 'product_id' = '060af151-5279-4a3f-8de6-154698454b64'
            then entry.value || jsonb_build_object(
              'banner_id', '531be07e-5ec2-4e96-b456-9d295f08d549',
              'kind', 'weapon',
              'rarity', 4,
              'featured', true
            )
          when game_type = 'genshin'
            and entry.value ->> 'product_id' = '305bd08d-1b83-4766-9080-963a3097c2b1'
            then entry.value || jsonb_build_object(
              'banner_id', '531be07e-5ec2-4e96-b456-9d295f08d549',
              'kind', 'weapon',
              'rarity', 4,
              'featured', false
            )
          when game_type = 'genshin'
            and entry.value ->> 'product_id' = 'bccc86b3-676c-47f0-99a6-ef5aa04cfc10'
            then entry.value || jsonb_build_object(
              'banner_id', '994bf2a6-b51c-43f0-bbcd-631cda4054a1',
              'kind', 'character',
              'rarity', 4,
              'featured', true
            )
          when game_type = 'genshin'
            and entry.value ->> 'product_id' = 'c08cfec2-8961-42a9-8d66-a68702a296b1'
            then entry.value || jsonb_build_object(
              'banner_id', '994bf2a6-b51c-43f0-bbcd-631cda4054a1',
              'kind', 'character',
              'rarity', 4,
              'featured', true
            )
          when game_type = 'genshin'
            and entry.value ->> 'product_id' = '22f62c35-ce0b-44bd-8768-f4e2b6740cce'
            then entry.value || jsonb_build_object(
              'banner_id', '994bf2a6-b51c-43f0-bbcd-631cda4054a1',
              'kind', 'character',
              'rarity', 4,
              'featured', true
            )
          when game_type = 'genshin'
            and entry.value ->> 'product_id' = 'a9411280-98cb-4c06-af93-dccd7f52b54f'
            then entry.value || jsonb_build_object(
              'banner_id', '994bf2a6-b51c-43f0-bbcd-631cda4054a1',
              'kind', 'character',
              'rarity', 4,
              'featured', false
            )
          when game_type = 'genshin'
            and entry.value ->> 'product_id' in (
              '6c3fd2df-7cc1-41a4-8446-d43e536e1c5e',
              'aa92a000-e3df-4a0f-9ad1-89c7eaad205e',
              '36e7191a-ff80-4a85-887f-3a84a715c457'
            )
            then entry.value || jsonb_build_object('featured', true)
          when game_type = 'hsr'
            and entry.value ->> 'product_id' = '5b299255-e7d1-4d47-9b9a-b705b7d86c6c'
            then entry.value || jsonb_build_object('rarity', 4, 'featured', false)
          else entry.value
        end
        order by entry.ordinality
      )
      from jsonb_array_elements(coalesce(repaired -> 'entries', '[]'::jsonb))
        with ordinality as entry(value, ordinality)
    ), '[]'::jsonb)
  );

  return repaired;
end;
$$;

revoke all on function private.repair_arigatosan_gacha_configuration(jsonb, text)
from public, anon, authenticated;

with target_shop as (
  select shop.id
  from public.shops shop
  where shop.id = '00000000-0000-4000-8000-000000000001'
    or shop.slug = 'arigatosan'
  order by (shop.id = '00000000-0000-4000-8000-000000000001') desc
  limit 1
)
update public.gacha_published_configs config_row
set config = private.repair_arigatosan_gacha_configuration(
  config_row.config,
  config_row.game_type
)
from target_shop
where config_row.shop_id = target_shop.id
  and config_row.game_type in ('genshin', 'hsr')
  and config_row.config is distinct from
    private.repair_arigatosan_gacha_configuration(
      config_row.config,
      config_row.game_type
    );

with target_shop as (
  select shop.id
  from public.shops shop
  where shop.id = '00000000-0000-4000-8000-000000000001'
    or shop.slug = 'arigatosan'
  order by (shop.id = '00000000-0000-4000-8000-000000000001') desc
  limit 1
)
update public.gacha_game_configs config_row
set config = private.repair_arigatosan_gacha_configuration(
  config_row.config,
  config_row.game_type
)
from target_shop
where config_row.shop_id = target_shop.id
  and config_row.game_type in ('genshin', 'hsr')
  and config_row.config is distinct from
    private.repair_arigatosan_gacha_configuration(
      config_row.config,
      config_row.game_type
    );

-- The relational projection stores only the currently selected game.
with target_shop as (
  select shop.id
  from public.shops shop
  join public.gacha_settings settings on settings.shop_id = shop.id
  where (shop.id = '00000000-0000-4000-8000-000000000001'
      or shop.slug = 'arigatosan')
    and settings.game_type = 'genshin'
  limit 1
)
update public.gacha_banners banner
set display_limit = case when banner.kind = 'weapon' then 7 else 4 end
from target_shop
where banner.shop_id = target_shop.id;

with target_shop as (
  select shop.id
  from public.shops shop
  join public.gacha_settings settings on settings.shop_id = shop.id
  where (shop.id = '00000000-0000-4000-8000-000000000001'
      or shop.slug = 'arigatosan')
    and settings.game_type = 'genshin'
  limit 1
)
update public.gacha_pool_entries entry
set banner_id = case entry.product_id
      when '060af151-5279-4a3f-8de6-154698454b64' then '531be07e-5ec2-4e96-b456-9d295f08d549'::uuid
      when '305bd08d-1b83-4766-9080-963a3097c2b1' then '531be07e-5ec2-4e96-b456-9d295f08d549'::uuid
      when 'bccc86b3-676c-47f0-99a6-ef5aa04cfc10' then '994bf2a6-b51c-43f0-bbcd-631cda4054a1'::uuid
      when 'c08cfec2-8961-42a9-8d66-a68702a296b1' then '994bf2a6-b51c-43f0-bbcd-631cda4054a1'::uuid
      when '22f62c35-ce0b-44bd-8768-f4e2b6740cce' then '994bf2a6-b51c-43f0-bbcd-631cda4054a1'::uuid
      when 'a9411280-98cb-4c06-af93-dccd7f52b54f' then '994bf2a6-b51c-43f0-bbcd-631cda4054a1'::uuid
      else entry.banner_id
    end,
    kind = case
      when entry.product_id in (
        '060af151-5279-4a3f-8de6-154698454b64',
        '305bd08d-1b83-4766-9080-963a3097c2b1'
      ) then 'weapon'
      else entry.kind
    end,
    rarity = case
      when entry.product_id in (
        'ba38bc82-1422-414e-b109-c4fd0e8aa9fc',
        '060af151-5279-4a3f-8de6-154698454b64',
        '305bd08d-1b83-4766-9080-963a3097c2b1',
        'bccc86b3-676c-47f0-99a6-ef5aa04cfc10',
        'c08cfec2-8961-42a9-8d66-a68702a296b1',
        '22f62c35-ce0b-44bd-8768-f4e2b6740cce',
        'a9411280-98cb-4c06-af93-dccd7f52b54f'
      ) then 4
      else entry.rarity
    end,
    featured = case
      when entry.product_id in (
        '060af151-5279-4a3f-8de6-154698454b64',
        'bccc86b3-676c-47f0-99a6-ef5aa04cfc10',
        'c08cfec2-8961-42a9-8d66-a68702a296b1',
        '22f62c35-ce0b-44bd-8768-f4e2b6740cce',
        '6c3fd2df-7cc1-41a4-8446-d43e536e1c5e',
        'aa92a000-e3df-4a0f-9ad1-89c7eaad205e',
        '36e7191a-ff80-4a85-887f-3a84a715c457'
      ) then true
      when entry.product_id in (
        'ba38bc82-1422-414e-b109-c4fd0e8aa9fc',
        '305bd08d-1b83-4766-9080-963a3097c2b1',
        'a9411280-98cb-4c06-af93-dccd7f52b54f'
      ) then false
      else entry.featured
    end
from target_shop
where entry.shop_id = target_shop.id
  and entry.product_id in (
    'ba38bc82-1422-414e-b109-c4fd0e8aa9fc',
    '060af151-5279-4a3f-8de6-154698454b64',
    '305bd08d-1b83-4766-9080-963a3097c2b1',
    'bccc86b3-676c-47f0-99a6-ef5aa04cfc10',
    'c08cfec2-8961-42a9-8d66-a68702a296b1',
    '22f62c35-ce0b-44bd-8768-f4e2b6740cce',
    'a9411280-98cb-4c06-af93-dccd7f52b54f',
    '6c3fd2df-7cc1-41a4-8446-d43e536e1c5e',
    'aa92a000-e3df-4a0f-9ad1-89c7eaad205e',
    '36e7191a-ff80-4a85-887f-3a84a715c457'
  );

with target_shop as (
  select shop.id
  from public.shops shop
  join public.gacha_settings settings on settings.shop_id = shop.id
  where (shop.id = '00000000-0000-4000-8000-000000000001'
      or shop.slug = 'arigatosan')
    and settings.game_type = 'hsr'
  limit 1
)
update public.gacha_pool_entries entry
set rarity = 4,
    featured = false
from target_shop
where entry.shop_id = target_shop.id
  and entry.banner_id = '994bf2a6-b51c-43f0-bbcd-631cda4054a1'
  and entry.product_id = '5b299255-e7d1-4d47-9b9a-b705b7d86c6c'
  and (entry.rarity is distinct from 4 or entry.featured);

drop function private.repair_arigatosan_gacha_configuration(jsonb, text);
