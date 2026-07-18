-- Publish ONLY the current banner definitions and banner item pools for both
-- Genshin and HSR. Rates, pity, enabled state, pricing, music, and every other
-- setting are copied from the already-published configuration unchanged.
--
-- Banner source: public.gacha_game_configs (the drafts saved by Gacha Manager)
-- Live target:   public.gacha_published_configs

begin;

do $publish_banners$
declare
  v_shop_id uuid;
  v_owner_id uuid;
  v_game_type text;
  v_draft jsonb;
  v_live jsonb;
  v_banner_count integer;
  v_entry_count integer;
begin
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

  -- publish_gacha_configuration_v5 performs its normal shop-role check.
  perform set_config('request.jwt.claim.sub', v_owner_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_owner_id::text, 'role', 'authenticated')::text,
    true
  );

  foreach v_game_type in array array['genshin', 'hsr']
  loop
    select draft.config
    into strict v_draft
    from public.gacha_game_configs draft
    where draft.shop_id = v_shop_id
      and draft.game_type = v_game_type;

    select published.config
    into strict v_live
    from public.gacha_published_configs published
    where published.shop_id = v_shop_id
      and published.game_type = v_game_type
    for update;

    v_banner_count := jsonb_array_length(coalesce(v_draft->'banners', '[]'::jsonb));
    v_entry_count := jsonb_array_length(coalesce(v_draft->'entries', '[]'::jsonb));

    if v_banner_count = 0 or v_entry_count = 0 then
      raise exception '% draft has no complete banner setup', v_game_type;
    end if;

    -- Replace only these two top-level fields. In particular, settings/pity
    -- remain byte-for-byte identical to the current live configuration.
    v_live := jsonb_set(v_live, '{banners}', v_draft->'banners', true);
    v_live := jsonb_set(v_live, '{entries}', v_draft->'entries', true);

    perform public.publish_gacha_configuration_v5(
      v_shop_id,
      v_game_type,
      v_live
    );
  end loop;
end
$publish_banners$;

commit;

-- Expect Genshin = 3 banners / 21 entries and HSR = 3 banners / 22 entries
-- for the current drafts.
select
  published.game_type,
  jsonb_array_length(published.config->'banners') as banner_count,
  jsonb_array_length(published.config->'entries') as pool_entry_count,
  published.updated_at
from public.gacha_published_configs published
join public.shops shop on shop.id = published.shop_id
where shop.slug = 'arigatosan'
order by published.game_type;
