-- Run only AFTER 20260718120317_enable_dual_published_gacha.sql has been
-- applied through `supabase db push`.
--
-- This preserves every existing banner, schedule, product assignment, weight,
-- and featured flag. It only aligns the two games' event rates/pity, enables
-- both drafts, and publishes both through the validated v5 RPC.
--
-- Pricing decision (not enforced by the current app):
--   1 roll  = 20,000 VND
--   10 rolls = 150,000 VND (15,000 each; 25% bundle discount)
-- A secure paid version still needs server-authoritative payment, prize stock
-- reservation, redemption, and an immutable roll ledger.

begin;

do $configure$
declare
  v_shop_id uuid;
  v_owner_id uuid;
  v_game_type text;
  v_config jsonb;
  v_settings jsonb;
begin
  if to_regclass('public.gacha_published_configs') is null then
    raise exception
      'Apply migration 20260718120317_enable_dual_published_gacha.sql first';
  end if;

  select shop.id
  into strict v_shop_id
  from public.shops shop
  where shop.slug = 'arigatosan'
  for update;

  select member.user_id
  into strict v_owner_id
  from public.shop_members member
  where member.shop_id = v_shop_id
    and member.role = 'owner'
    and member.active
  order by member.created_at
  limit 1;

  -- The publish RPC authorizes through auth.uid(). Supabase SQL Editor runs as
  -- postgres, so set a transaction-local owner identity for these RPC calls.
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

    v_settings := coalesce(v_config->'settings', '{}'::jsonb)
      || jsonb_build_object(
        'shop_id', v_shop_id::text,
        'game_type', v_game_type,
        'enabled', true,
        -- Keep each game's familiar base rate.
        'rare_base_rate', case when v_game_type = 'genshin' then 5.1 else 3.0 end,
        'legendary_base_rate', 0.6,
        'lightcone_legendary_base_rate', 0.8,
        -- Shared event cadence: a 4-star by pull 9 and a 5-star by pull 10.
        'rare_soft_pity', 8,
        'rare_pity', 9,
        'legendary_soft_pity', 9,
        'legendary_pity', 10,
        'lightcone_legendary_soft_pity', 9,
        'lightcone_legendary_pity', 10,
        'featured_item_rate', 50,
        'featured_guaranteed_after_loss', true
      );

    v_config := v_config || jsonb_build_object('settings', v_settings);

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
$configure$;

commit;

-- Verification: expect exactly two rows, both enabled, with 9/10 hard pity.
select
  published.game_type,
  (published.config #>> '{settings,enabled}')::boolean as enabled,
  (published.config #>> '{settings,rare_base_rate}')::numeric as four_star_base_rate,
  (published.config #>> '{settings,legendary_base_rate}')::numeric as five_star_base_rate,
  (published.config #>> '{settings,rare_pity}')::integer as four_star_hard_pity,
  (published.config #>> '{settings,legendary_pity}')::integer as five_star_hard_pity,
  jsonb_array_length(published.config->'banners') as banners,
  jsonb_array_length(published.config->'entries') as pool_entries
from public.gacha_published_configs published
join public.shops shop on shop.id = published.shop_id
where shop.slug = 'arigatosan'
order by published.game_type;

-- Pricing guard. A 35% gross-margin target means the expected all-in cost of
-- physical prizes, packaging, and payment fees must stay below these limits.
select
  20000::integer as single_roll_price_vnd,
  13000::integer as maximum_single_roll_cost_for_35pct_margin_vnd,
  150000::integer as ten_roll_price_vnd,
  97500::integer as maximum_ten_roll_cost_for_35pct_margin_vnd,
  25::integer as ten_roll_discount_percent;
