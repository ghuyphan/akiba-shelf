-- Keep products unique to one banner while allowing a rolled rarity to fall
-- back to another active banner in the same published game.
create or replace function public.publish_gacha_configuration_v2(
  p_shop_id uuid,
  p_game_type text,
  p_config jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings jsonb := coalesce(p_config->'settings', '{}'::jsonb);
  v_rare_rate numeric;
  v_legendary_rate numeric;
  v_lightcone_rate numeric;
  v_missing_rarity integer;
begin
  if not private.has_shop_role(p_shop_id, array['owner', 'admin']) then
    raise exception 'Not allowed to publish gacha configuration for this shop';
  end if;

  v_rare_rate := coalesce((v_settings->>'rare_base_rate')::numeric, 5.10);
  v_legendary_rate := coalesce((v_settings->>'legendary_base_rate')::numeric, 0.60);
  v_lightcone_rate := coalesce(
    (v_settings->>'lightcone_legendary_base_rate')::numeric,
    0.80
  );

  if v_rare_rate <= 0 or v_rare_rate >= 100 then
    raise exception 'The 4-star base rate must be greater than 0 and below 100';
  end if;
  if v_legendary_rate <= 0 or v_legendary_rate >= 100 then
    raise exception 'The 5-star base rate must be greater than 0 and below 100';
  end if;
  if v_lightcone_rate <= 0 or v_lightcone_rate >= 100 then
    raise exception 'The Light Cone 5-star base rate must be greater than 0 and below 100';
  end if;
  if v_rare_rate + v_legendary_rate >= 100 then
    raise exception 'The 4-star and 5-star base rates must total less than 100';
  end if;
  if v_rare_rate + v_lightcone_rate >= 100 then
    raise exception 'The 4-star and Light Cone 5-star base rates must total less than 100';
  end if;

  perform public.publish_gacha_configuration(p_shop_id, p_game_type, p_config);

  if coalesce((v_settings->>'enabled')::boolean, false) then
    select rarity.value into v_missing_rarity
    from generate_series(3, 5) rarity(value)
    where not exists (
      select 1
      from public.gacha_pool_entries entry
      join public.gacha_banners banner
        on banner.shop_id = entry.shop_id
       and banner.id = entry.banner_id
      where entry.shop_id = p_shop_id
        and entry.active
        and banner.active
        and entry.rarity = rarity.value
    )
    limit 1;

    if v_missing_rarity is not null then
      raise exception 'The active game needs at least one active %-star item',
        v_missing_rarity;
    end if;
  end if;

  update public.gacha_settings settings
  set rare_base_rate = v_rare_rate,
      legendary_base_rate = v_legendary_rate,
      lightcone_legendary_base_rate = v_lightcone_rate
  where settings.shop_id = p_shop_id;
end;
$$;

-- Arigatosan event window: Saturday through Monday noon in Vietnam.
update public.gacha_banners
set starts_at = '2026-07-18 00:00:00+07'::timestamptz,
    ends_at = '2026-07-20 12:00:00+07'::timestamptz
where shop_id = '00000000-0000-4000-8000-000000000001'
  and active;

-- Keep the admin draft aligned so the next publish preserves the schedule.
update public.gacha_game_configs config_row
set config = jsonb_set(
  config_row.config,
  '{banners}',
  coalesce(
    (
      select jsonb_agg(
        banner.value || jsonb_build_object(
          'starts_at', '2026-07-18T00:00:00+07:00',
          'ends_at', '2026-07-20T12:00:00+07:00'
        )
        order by banner.ordinality
      )
      from jsonb_array_elements(
        coalesce(config_row.config->'banners', '[]'::jsonb)
      ) with ordinality as banner(value, ordinality)
    ),
    '[]'::jsonb
  )
)
where config_row.shop_id = '00000000-0000-4000-8000-000000000001'
  and config_row.game_type = 'hsr';
