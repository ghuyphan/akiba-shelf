-- Bypass featured 5-star validation for active HSR banners that have zero featured items in total (standard banners).

create or replace function public.publish_gacha_configuration(
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
  v_settings jsonb;
  v_banners jsonb;
  v_entries jsonb;
  v_enabled boolean;
  v_title text;
  v_description text;
  v_rare_pity integer;
  v_legendary_pity integer;
  v_lightcone_pity integer;
  v_display_limit_max integer;
  v_banner record;
  v_entry record;
  v_banner_ids uuid[] := '{}';
  v_product_ids text[] := '{}';
  v_genshin_elements text[] := array['anemo', 'geo', 'electro', 'dendro', 'hydro', 'pyro', 'cryo'];
  v_hsr_elements text[] := array['physical', 'fire', 'ice', 'lightning', 'wind', 'quantum', 'imaginary'];
  v_genshin_weapons text[] := array['sword', 'claymore', 'polearm', 'bow', 'catalyst'];
  v_hsr_weapons text[] := array['destruction', 'hunt', 'erudition', 'harmony', 'nihility', 'preservation', 'abundance'];
  v_elements text[];
  v_weapons text[];
  v_kinds text[];
  v_offender text;
begin
  if not private.has_shop_role(p_shop_id, array['owner', 'admin']) then
    raise exception 'Not allowed to publish gacha configuration for this shop';
  end if;
  if p_game_type not in ('genshin', 'hsr') then
    raise exception 'Unsupported gacha game type: %', p_game_type;
  end if;
  if p_config is null or jsonb_typeof(p_config) is distinct from 'object' then
    raise exception 'A gacha configuration object is required';
  end if;

  v_settings := coalesce(p_config->'settings', '{}'::jsonb);
  v_banners := coalesce(p_config->'banners', '[]'::jsonb);
  v_entries := coalesce(p_config->'entries', '[]'::jsonb);
  if jsonb_typeof(v_settings) is distinct from 'object'
    or jsonb_typeof(v_banners) is distinct from 'array'
    or jsonb_typeof(v_entries) is distinct from 'array' then
    raise exception 'Gacha configuration must contain a settings object, a banners array, and an entries array';
  end if;

  if p_game_type = 'hsr' then
    v_elements := v_hsr_elements;
    v_weapons := v_hsr_weapons;
    v_kinds := array['character', 'weapon', 'lightcone'];
    v_display_limit_max := 4;
  else
    v_elements := v_genshin_elements;
    v_weapons := v_genshin_weapons;
    v_kinds := array['character', 'weapon'];
    v_display_limit_max := 5;
  end if;

  -- Serialize concurrent publishes for the same shop; the whole apply below
  -- runs in this function's transaction and rolls back on any violation.
  perform pg_advisory_xact_lock(hashtextextended(p_shop_id::text, 7301));

  -- Settings ----------------------------------------------------------------
  v_enabled := coalesce((v_settings->>'enabled')::boolean, false);
  v_title := btrim(coalesce(v_settings->>'title', ''));
  v_description := coalesce(v_settings->>'description', '');
  v_rare_pity := coalesce((v_settings->>'rare_pity')::integer, 10);
  v_legendary_pity := coalesce((v_settings->>'legendary_pity')::integer, 50);
  v_lightcone_pity := coalesce((v_settings->>'lightcone_legendary_pity')::integer, 80);

  if length(v_title) not between 1 and 80 then
    raise exception 'Give the minigame a title between 1 and 80 characters';
  end if;
  if length(v_description) > 240 then
    raise exception 'The minigame description must be 240 characters or fewer';
  end if;
  if v_rare_pity not between 2 and 30 then
    raise exception 'The 4-star pity must be between 2 and 30';
  end if;
  if v_legendary_pity not between 10 and 100 then
    raise exception 'The 5-star pity must be between 10 and 100';
  end if;
  if v_legendary_pity <= v_rare_pity then
    raise exception 'The 5-star pity must be higher than the 4-star pity';
  end if;
  if v_lightcone_pity not between 10 and 100 then
    raise exception 'The Light Cone 5-star pity must be between 10 and 100';
  end if;
  if v_lightcone_pity <= v_rare_pity then
    raise exception 'The Light Cone 5-star pity must be higher than the 4-star pity';
  end if;

  -- Banners -----------------------------------------------------------------
  for v_banner in
    select banner.*
    from jsonb_to_recordset(v_banners) as banner(
      id uuid,
      name text,
      description text,
      kind text,
      theme text,
      display_limit integer,
      active boolean
    )
  loop
    if v_banner.id is null then
      raise exception 'Every banner needs an id';
    end if;
    if v_banner.id = any(v_banner_ids) then
      raise exception 'Duplicate banner id in the configuration';
    end if;
    v_banner_ids := v_banner_ids || v_banner.id;
    if length(btrim(coalesce(v_banner.name, ''))) not between 1 and 80 then
      raise exception 'Give every banner a title between 1 and 80 characters';
    end if;
    if length(coalesce(v_banner.description, '')) > 240 then
      raise exception 'Banner descriptions must be 240 characters or fewer';
    end if;
    if coalesce(v_banner.kind, '') <> all(v_kinds) then
      raise exception 'Banner "%" has a type that does not exist in %', v_banner.name, p_game_type;
    end if;
    if coalesce(v_banner.theme, '') <> all(v_elements) then
      raise exception 'Banner "%" has a theme that does not exist in %', v_banner.name, p_game_type;
    end if;
    if v_banner.display_limit is null
      or v_banner.display_limit < 1
      or v_banner.display_limit > v_display_limit_max then
      raise exception 'Banner "%" must show between 1 and % featured items', v_banner.name, v_display_limit_max;
    end if;
  end loop;

  -- Banner ids must not belong to another shop; otherwise the upsert below
  -- would overwrite that shop's banner row via the id conflict target.
  if exists (
    select 1 from public.gacha_banners banner
    where banner.id = any(v_banner_ids) and banner.shop_id <> p_shop_id
  ) then
    raise exception 'A banner id in the configuration belongs to a different shop';
  end if;

  -- Entries -----------------------------------------------------------------
  for v_entry in
    select entry.*
    from jsonb_to_recordset(v_entries) as entry(
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
  loop
    if v_entry.banner_id is null or not (v_entry.banner_id = any(v_banner_ids)) then
      raise exception 'Pool item "%" points at a banner that is not in the configuration', v_entry.product_id;
    end if;
    if v_entry.product_id is null or not exists (
      select 1 from public.products product
      where product.shop_id = p_shop_id and product.id = v_entry.product_id
    ) then
      raise exception 'Pool item "%" is not a product in this shop', v_entry.product_id;
    end if;
    if v_entry.product_id = any(v_product_ids) then
      raise exception 'Product "%" is assigned to more than one banner', v_entry.product_id;
    end if;
    v_product_ids := v_product_ids || v_entry.product_id;
    if coalesce(v_entry.kind, '') <> all(v_kinds) then
      raise exception 'Pool item "%" has a type that does not exist in %', v_entry.product_id, p_game_type;
    end if;
    if coalesce(v_entry.element, '') <> all(v_elements) then
      raise exception 'Pool item "%" has an element that does not exist in %', v_entry.product_id, p_game_type;
    end if;
    if coalesce(v_entry.weapon_type, '') <> all(v_weapons) then
      raise exception 'Pool item "%" has a class that does not exist in %', v_entry.product_id, p_game_type;
    end if;
    if v_entry.rarity is null or v_entry.rarity not between 3 and 5 then
      raise exception 'Pool item "%" must have a rarity of 3, 4, or 5', v_entry.product_id;
    end if;
    if v_entry.weight is null or v_entry.weight not between 1 and 1000 then
      raise exception 'Pool item "%" must have a weight between 1 and 1000', v_entry.product_id;
    end if;
  end loop;

  -- Apply -------------------------------------------------------------------
  insert into public.gacha_settings (
    shop_id, enabled, game_type, title, description,
    rare_pity, legendary_pity, lightcone_legendary_pity
  ) values (
    p_shop_id, v_enabled, p_game_type, v_title, v_description,
    v_rare_pity, v_legendary_pity, v_lightcone_pity
  )
  on conflict (shop_id) do update set
    enabled = excluded.enabled,
    game_type = excluded.game_type,
    title = excluded.title,
    description = excluded.description,
    rare_pity = excluded.rare_pity,
    legendary_pity = excluded.legendary_pity,
    lightcone_legendary_pity = excluded.lightcone_legendary_pity;

  delete from public.gacha_banners banner
  where banner.shop_id = p_shop_id
    and not (banner.id = any(v_banner_ids));

  for v_banner in
    select row_number() over () as ordinality, banner.*
    from jsonb_to_recordset(v_banners) as banner(
      id uuid,
      name text,
      description text,
      kind text,
      theme text,
      display_limit integer,
      active boolean
    )
  loop
    insert into public.gacha_banners (
      id, shop_id, name, description, kind, theme, display_limit, sort_order, active
    ) values (
      v_banner.id,
      p_shop_id,
      btrim(v_banner.name),
      coalesce(v_banner.description, ''),
      v_banner.kind,
      v_banner.theme,
      v_banner.display_limit,
      v_banner.ordinality - 1,
      coalesce(v_banner.active, true)
    )
    on conflict (id) do update set
      name = excluded.name,
      description = excluded.description,
      kind = excluded.kind,
      theme = excluded.theme,
      display_limit = excluded.display_limit,
      sort_order = excluded.sort_order,
      active = excluded.active;
  end loop;

  delete from public.gacha_pool_entries entry
  where entry.shop_id = p_shop_id;

  insert into public.gacha_pool_entries (
    shop_id, banner_id, product_id, kind, element, weapon_type,
    rarity, weight, featured, active
  )
  select
    p_shop_id,
    entry.banner_id,
    entry.product_id,
    entry.kind,
    entry.element,
    entry.weapon_type,
    entry.rarity,
    entry.weight,
    coalesce(entry.featured, false),
    coalesce(entry.active, true)
  from jsonb_to_recordset(v_entries) as entry(
    banner_id uuid,
    product_id text,
    kind text,
    element text,
    weapon_type text,
    rarity integer,
    weight integer,
    featured boolean,
    active boolean
  );

  -- Cross-row rules, checked against the applied state -----------------------

  -- Featured caps per banner (only active, kind-matching entries count).
  if p_game_type = 'hsr' then
    select banner.name into v_offender
    from public.gacha_banners banner
    join public.gacha_pool_entries entry
      on entry.shop_id = banner.shop_id and entry.banner_id = banner.id
    where banner.shop_id = p_shop_id
      and entry.active and entry.featured and entry.rarity = 5
      and (banner.kind = 'character') = (entry.kind = 'character')
    group by banner.id, banner.name
    having count(*) > 1
    limit 1;
    if v_offender is not null then
      raise exception 'Banner "%" has more than one featured 5-star item', v_offender;
    end if;

    select banner.name into v_offender
    from public.gacha_banners banner
    join public.gacha_pool_entries entry
      on entry.shop_id = banner.shop_id and entry.banner_id = banner.id
    where banner.shop_id = p_shop_id
      and entry.active and entry.featured and entry.rarity = 4
      and (banner.kind = 'character') = (entry.kind = 'character')
    group by banner.id, banner.name, banner.display_limit
    having count(*) > least(3, greatest(banner.display_limit - 1, 0))
    limit 1;
    if v_offender is not null then
      raise exception 'Banner "%" has too many featured 4-star items', v_offender;
    end if;
  else
    -- Genshin: every active featured entry counts against the banner's
    -- display limit, mirroring capGachaFeaturedEntries (no kind filter).
    select banner.name into v_offender
    from public.gacha_banners banner
    join public.gacha_pool_entries entry
      on entry.shop_id = banner.shop_id and entry.banner_id = banner.id
    where banner.shop_id = p_shop_id
      and entry.active and entry.featured
    group by banner.id, banner.name, banner.display_limit
    having count(*) > banner.display_limit
    limit 1;
    if v_offender is not null then
      raise exception 'Banner "%" has more featured items than it can show', v_offender;
    end if;
  end if;

  -- Going-live requirements, only when the minigame is opened.
  if v_enabled then
    select banner.name into v_offender
    from public.gacha_banners banner
    where banner.shop_id = p_shop_id and banner.active
      and not exists (
        select 1 from public.gacha_pool_entries entry
        where entry.shop_id = p_shop_id
          and entry.banner_id = banner.id
          and entry.active
      )
    limit 1;
    if v_offender is not null then
      raise exception 'Every active banner needs at least one active merch item ("%")', v_offender;
    end if;

    if p_game_type = 'hsr' then
      select banner.name into v_offender
      from public.gacha_banners banner
      where banner.shop_id = p_shop_id and banner.active
        -- Has at least one active featured item of any rarity (i.e. not a standard banner)
        and exists (
          select 1 from public.gacha_pool_entries entry
          where entry.shop_id = p_shop_id
            and entry.banner_id = banner.id
            and entry.active and entry.featured
        )
        -- But does not have exactly one featured 5-star item matching the banner kind
        and (
          select count(*) from public.gacha_pool_entries entry
          where entry.shop_id = p_shop_id
            and entry.banner_id = banner.id
            and entry.active and entry.featured and entry.rarity = 5
            and (banner.kind = 'character') = (entry.kind = 'character')
        ) <> 1
      limit 1;
      if v_offender is not null then
        raise exception 'Every active HSR banner needs one featured 5-star item ("%")', v_offender;
      end if;
    end if;
  end if;
end;
$$;
revoke all on function public.publish_gacha_configuration(uuid, text, jsonb)
from public, anon, authenticated;
grant execute on function public.publish_gacha_configuration(uuid, text, jsonb)
to authenticated;
-- Also update the assert function to match the standard banner bypass check
create or replace function private.assert_published_gacha_configuration(
  p_shop_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings public.gacha_settings;
  v_offender text;
begin
  select * into v_settings
  from public.gacha_settings settings
  where settings.shop_id = p_shop_id;

  if not found or not v_settings.enabled then
    return;
  end if;

  if not exists (
    select 1
    from public.gacha_banners banner
    where banner.shop_id = p_shop_id and banner.active
  ) then
    raise exception
      'An enabled gacha configuration needs at least one active banner';
  end if;

  select banner.name into v_offender
  from public.gacha_banners banner
  where banner.shop_id = p_shop_id
    and banner.active
    and not exists (
      select 1
      from public.gacha_pool_entries entry
      where entry.shop_id = p_shop_id
        and entry.banner_id = banner.id
        and entry.active
    )
  limit 1;
  if v_offender is not null then
    raise exception
      'Every active banner needs at least one active merch item ("%")',
      v_offender;
  end if;

  if v_settings.game_type = 'hsr' then
    select banner.name into v_offender
    from public.gacha_banners banner
    where banner.shop_id = p_shop_id
      and banner.active
      -- Has at least one active featured item of any rarity (i.e. not a standard banner)
      and exists (
        select 1 from public.gacha_pool_entries entry
        where entry.shop_id = p_shop_id
          and entry.banner_id = banner.id
          and entry.active and entry.featured
      )
      -- But does not have exactly one featured 5-star item matching the banner kind
      and (
        select count(*)
        from public.gacha_pool_entries entry
        where entry.shop_id = p_shop_id
          and entry.banner_id = banner.id
          and entry.active
          and entry.featured
          and entry.rarity = 5
          and (banner.kind = 'character') = (entry.kind = 'character')
      ) <> 1
    limit 1;
    if v_offender is not null then
      raise exception
        'Every active HSR banner needs one featured 5-star item ("%")',
        v_offender;
    end if;
  end if;
end;
$$;
revoke all on function private.assert_published_gacha_configuration(uuid)
from public, anon, authenticated;
