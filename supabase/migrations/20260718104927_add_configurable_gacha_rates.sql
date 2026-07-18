-- Publish shop-controlled rarity rates while keeping the existing gacha
-- configuration RPC available internally for the atomic apply.
alter table public.gacha_settings
  add column rare_base_rate numeric(5, 2) not null default 5.10,
  add column legendary_base_rate numeric(5, 2) not null default 0.60,
  add column lightcone_legendary_base_rate numeric(5, 2) not null default 0.80,
  add constraint gacha_settings_rare_base_rate_check
    check (rare_base_rate > 0 and rare_base_rate < 100),
  add constraint gacha_settings_legendary_base_rate_check
    check (legendary_base_rate > 0 and legendary_base_rate < 100),
  add constraint gacha_settings_lightcone_legendary_base_rate_check
    check (lightcone_legendary_base_rate > 0 and lightcone_legendary_base_rate < 100),
  add constraint gacha_settings_character_base_rates_total_check
    check (rare_base_rate + legendary_base_rate < 100),
  add constraint gacha_settings_lightcone_base_rates_total_check
    check (rare_base_rate + lightcone_legendary_base_rate < 100);

grant select (
  rare_base_rate,
  legendary_base_rate,
  lightcone_legendary_base_rate
) on public.gacha_settings to anon, authenticated;

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
  v_offender text;
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

  -- The existing publisher performs the complete atomic draft validation and
  -- replaces the public settings, banners, and entries in this transaction.
  perform public.publish_gacha_configuration(p_shop_id, p_game_type, p_config);

  -- Paid/manual prize pools must offer every rarity. Without this guard the
  -- simulators must fall back to another rarity; a 5-star-only pool therefore
  -- turns every pull into a 5-star prize.
  if coalesce((v_settings->>'enabled')::boolean, false) then
    select banner.name into v_offender
    from public.gacha_banners banner
    where banner.shop_id = p_shop_id
      and banner.active
      and exists (
        select 1
        from generate_series(3, 5) rarity(value)
        where not exists (
          select 1
          from public.gacha_pool_entries entry
          where entry.shop_id = banner.shop_id
            and entry.banner_id = banner.id
            and entry.active
            and entry.rarity = rarity.value
        )
      )
    limit 1;

    if v_offender is not null then
      raise exception 'Active banner "%" needs at least one active 3-star, 4-star, and 5-star item',
        v_offender;
    end if;
  end if;

  update public.gacha_settings settings
  set rare_base_rate = v_rare_rate,
      legendary_base_rate = v_legendary_rate,
      lightcone_legendary_base_rate = v_lightcone_rate
  where settings.shop_id = p_shop_id;
end;
$$;

-- Only the guarded publisher remains part of the authenticated API. The v1
-- function stays callable by its owner so v2 can reuse its atomic apply.
revoke all on function public.publish_gacha_configuration(uuid, text, jsonb)
from public, anon, authenticated;
revoke all on function public.publish_gacha_configuration_v2(uuid, text, jsonb)
from public, anon, authenticated;
grant execute on function public.publish_gacha_configuration_v2(uuid, text, jsonb)
to authenticated;
