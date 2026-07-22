-- Align Arigatosan's saved admin drafts and public game configurations.
-- Run this once in the Supabase SQL Editor after all repository migrations.
--
-- The current banner pools already satisfy the frontend/server composition:
--   Genshin character: 1 featured 5-star + 3 featured 4-star
--   Genshin weapon:    2 featured 5-star + 5 featured 4-star
--   HSR event:         1 featured 5-star + 3 featured 4-star
--   HSR standard:      no featured items, with 4-star/5-star loss candidates
--
-- This script keeps the current admin-selected rates, pity, products, weights,
-- and featured flags. It normalizes banner limits, removes expired schedules
-- so every active banner is immediately visible, and publishes both games
-- through the validated v6 RPC.

begin;

do $align_arigatosan_gacha$
declare
  v_shop_id uuid;
  v_owner_id uuid;
  v_game_type text;
  v_config jsonb;
  v_banners jsonb;
  v_entries jsonb;
begin
  select shop.id
  into strict v_shop_id
  from public.shops shop
  where lower(shop.slug) = 'arigatosan'
  for update;

  select member.user_id
  into strict v_owner_id
  from public.shop_members member
  where member.shop_id = v_shop_id
    and member.role = 'owner'
    and member.active
  order by member.created_at
  limit 1;

  -- The publish RPC checks auth.uid(); SQL Editor runs as postgres.
  perform set_config('request.jwt.claim.sub', v_owner_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', v_owner_id::text,
      'role', 'authenticated'
    )::text,
    true
  );

  foreach v_game_type in array array['genshin', 'hsr']
  loop
    select draft.config
    into strict v_config
    from public.gacha_game_configs draft
    where draft.shop_id = v_shop_id
      and draft.game_type = v_game_type
    for update;

    select coalesce(
      jsonb_agg(
        (banner.value - 'shop_id' - 'updated_at')
        || jsonb_build_object(
          'display_limit',
          case
            when v_game_type = 'genshin'
              and banner.value ->> 'kind' = 'weapon' then 7
            else 4
          end,
          'starts_at', null,
          'ends_at', null
        )
        order by banner.ordinality
      ),
      '[]'::jsonb
    )
    into v_banners
    from jsonb_array_elements(coalesce(v_config -> 'banners', '[]'::jsonb))
      with ordinality as banner(value, ordinality);

    select coalesce(
      jsonb_agg(
        entry.value - 'shop_id' - 'updated_at'
        order by entry.ordinality
      ),
      '[]'::jsonb
    )
    into v_entries
    from jsonb_array_elements(coalesce(v_config -> 'entries', '[]'::jsonb))
      with ordinality as entry(value, ordinality);

    v_config := jsonb_build_object(
      'settings',
      (coalesce(v_config -> 'settings', '{}'::jsonb) - 'updated_at')
      || jsonb_build_object(
        'shop_id', v_shop_id::text,
        'game_type', v_game_type
      ),
      'banners', v_banners,
      'entries', v_entries
    );

    update public.gacha_game_configs draft
    set config = v_config
    where draft.shop_id = v_shop_id
      and draft.game_type = v_game_type;

    perform public.publish_gacha_configuration_v6(
      v_shop_id,
      v_game_type,
      v_config
    );
  end loop;
end
$align_arigatosan_gacha$;

commit;

-- Expected after the commit:
--   - draft_matches_live = true for both games
--   - Genshin limits = 4, 7, 4
--   - HSR limits = 4, 4, 4
--   - every active banner has running_now = true
select
  draft.game_type,
  draft.config = published.config as draft_matches_live,
  jsonb_array_length(draft.config -> 'banners') as banner_count,
  jsonb_array_length(draft.config -> 'entries') as entry_count,
  array_agg(
    (banner.value ->> 'display_limit')::integer
    order by (banner.value ->> 'sort_order')::integer
  ) as display_limits,
  bool_and(
    not coalesce((banner.value ->> 'active')::boolean, true)
    or (
      nullif(banner.value ->> 'starts_at', '') is null
      and nullif(banner.value ->> 'ends_at', '') is null
    )
  ) as every_banner_running_now
from public.gacha_game_configs draft
join public.gacha_published_configs published
  using (shop_id, game_type)
cross join lateral jsonb_array_elements(draft.config -> 'banners') banner(value)
join public.shops shop on shop.id = draft.shop_id
where lower(shop.slug) = 'arigatosan'
group by draft.game_type, draft.config, published.config
order by draft.game_type;
