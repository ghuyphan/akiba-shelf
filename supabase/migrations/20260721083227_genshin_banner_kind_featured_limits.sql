-- Genshin uses fixed featured compositions by banner kind. Keep the legacy
-- generic limit in application code, while allowing weapon banners to store
-- seven displayed rate-ups in the relational projection.

alter table public.gacha_banners
  drop constraint gacha_banners_display_limit_check;

alter table public.gacha_banners
  add constraint gacha_banners_display_limit_check
  check (display_limit between 1 and 7);

alter function public.publish_gacha_configuration(uuid, text, jsonb)
  rename to publish_gacha_configuration_legacy_five_slot_core;

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
  v_banners jsonb := coalesce(p_config->'banners', '[]'::jsonb);
  v_entries jsonb := coalesce(p_config->'entries', '[]'::jsonb);
  v_legacy_banners jsonb;
  v_legacy_entries jsonb;
  v_legacy_config jsonb;
  v_enabled boolean := coalesce((p_config #>> '{settings,enabled}')::boolean, false);
  v_banner record;
  v_five_count integer;
  v_four_count integer;
  v_featured_count integer;
  v_expected_limit integer;
  v_five_limit integer;
  v_four_limit integer;
  v_offender text;
begin
  if p_game_type not in ('genshin', 'hsr') then
    raise exception 'Unsupported gacha game type: %', p_game_type;
  end if;

  if not private.has_shop_role(p_shop_id, array['owner', 'admin']) then
    raise exception 'Not allowed to publish gacha configuration for this shop';
  end if;

  if p_config is null or jsonb_typeof(p_config) is distinct from 'object'
    or jsonb_typeof(v_banners) is distinct from 'array'
    or jsonb_typeof(v_entries) is distinct from 'array' then
    raise exception 'A valid gacha configuration object is required';
  end if;

  for v_banner in
    select banner.*
    from jsonb_to_recordset(v_banners) as banner(
      id uuid,
      name text,
      kind text,
      display_limit integer,
      active boolean
    )
  loop
    if p_game_type = 'genshin' then
      if v_banner.kind = 'character' then
        v_expected_limit := 4;
        v_five_limit := 1;
        v_four_limit := 3;
      elsif v_banner.kind = 'weapon' then
        v_expected_limit := 7;
        v_five_limit := 2;
        v_four_limit := 5;
      else
        raise exception 'Banner "%" must be a character or weapon banner', v_banner.name;
      end if;
    else
      v_expected_limit := 4;
      v_five_limit := 1;
      v_four_limit := 3;
    end if;

    if v_banner.display_limit is distinct from v_expected_limit then
      raise exception 'Banner "%" must use % featured slots',
        v_banner.name, v_expected_limit;
    end if;

    select
      count(*) filter (where entry.rarity = 5),
      count(*) filter (where entry.rarity = 4),
      count(*)
    into v_five_count, v_four_count, v_featured_count
    from jsonb_to_recordset(v_entries) as entry(
      banner_id uuid,
      kind text,
      rarity integer,
      featured boolean,
      active boolean
    )
    where entry.banner_id = v_banner.id
      and coalesce(entry.active, true)
      and coalesce(entry.featured, false)
      and (v_banner.kind = 'character') = (entry.kind = 'character')
      and entry.rarity in (4, 5);

    if exists (
      select 1
      from jsonb_to_recordset(v_entries) as entry(
        banner_id uuid,
        product_id text,
        kind text,
        rarity integer,
        featured boolean,
        active boolean
      )
      where entry.banner_id = v_banner.id
        and coalesce(entry.active, true)
        and coalesce(entry.featured, false)
        and (
          entry.rarity not in (4, 5)
          or (v_banner.kind = 'character') <> (entry.kind = 'character')
        )
    ) then
      raise exception 'Featured items in banner "%" must match its type and use 4-star or 5-star rarity',
        v_banner.name;
    end if;

    if v_five_count > v_five_limit then
      raise exception 'Banner "%" supports at most % featured 5-star items',
        v_banner.name, v_five_limit;
    end if;
    if v_four_count > v_four_limit then
      raise exception 'Banner "%" supports at most % featured 4-star items',
        v_banner.name, v_four_limit;
    end if;

    if v_enabled and coalesce(v_banner.active, true) then
      if p_game_type = 'genshin'
        and (v_five_count <> v_five_limit or v_four_count <> v_four_limit) then
        raise exception 'Active Genshin banner "%" needs exactly % featured 5-star and % featured 4-star items',
          v_banner.name, v_five_limit, v_four_limit;
      end if;

      -- HSR standard banners may have zero rate-ups. Once any featured item is
      -- configured, the banner requires its single matching 5-star primary.
      if p_game_type = 'hsr'
        and v_featured_count > 0
        and v_five_count <> v_five_limit then
        raise exception 'Active HSR banner "%" needs exactly one featured 5-star item',
          v_banner.name;
      end if;
    end if;
  end loop;

  -- The existing core owns the full atomic apply and security checks. Feed it
  -- a five-slot-compatible view, then restore the validated seven-slot weapon
  -- state before the deferred projection guard runs.
  if p_game_type = 'genshin' then
    select coalesce(
      jsonb_agg(
        case
          when banner.value->>'kind' = 'weapon'
            then jsonb_set(banner.value, '{display_limit}', '5'::jsonb)
          else banner.value
        end
        order by banner.ordinality
      ),
      '[]'::jsonb
    )
    into v_legacy_banners
    from jsonb_array_elements(v_banners) with ordinality
      as banner(value, ordinality);

    select coalesce(
      jsonb_agg(
        case
          when ranked.banner_kind = 'weapon'
            and ranked.is_featured_four
            and ranked.featured_four_rank > 3
            then jsonb_set(ranked.value, '{featured}', 'false'::jsonb)
          else ranked.value
        end
        order by ranked.ordinality
      ),
      '[]'::jsonb
    )
    into v_legacy_entries
    from (
      select
        entry.value,
        entry.ordinality,
        banner.value->>'kind' as banner_kind,
        (
          coalesce((entry.value->>'active')::boolean, true)
          and coalesce((entry.value->>'featured')::boolean, false)
          and (entry.value->>'rarity')::integer = 4
        ) as is_featured_four,
        sum(
          case
            when coalesce((entry.value->>'active')::boolean, true)
              and coalesce((entry.value->>'featured')::boolean, false)
              and (entry.value->>'rarity')::integer = 4
              then 1
            else 0
          end
        ) over (
          partition by entry.value->>'banner_id'
          order by entry.ordinality
        ) as featured_four_rank
      from jsonb_array_elements(v_entries) with ordinality
        as entry(value, ordinality)
      left join jsonb_array_elements(v_banners) as banner(value)
        on banner.value->>'id' = entry.value->>'banner_id'
    ) ranked;

    v_legacy_config := jsonb_set(
      jsonb_set(p_config, '{banners}', v_legacy_banners),
      '{entries}',
      v_legacy_entries
    );
  else
    v_legacy_config := p_config;
  end if;

  perform public.publish_gacha_configuration_legacy_five_slot_core(
    p_shop_id,
    p_game_type,
    v_legacy_config
  );

  if p_game_type = 'genshin' then
    update public.gacha_banners target
    set display_limit = source.display_limit
    from jsonb_to_recordset(v_banners) as source(
      id uuid,
      display_limit integer
    )
    where target.shop_id = p_shop_id
      and target.id = source.id;

    update public.gacha_pool_entries target
    set featured = coalesce(source.featured, false)
    from jsonb_to_recordset(v_entries) as source(
      banner_id uuid,
      product_id text,
      featured boolean
    )
    where target.shop_id = p_shop_id
      and target.banner_id = source.banner_id
      and target.product_id = source.product_id;
  end if;
end;
$$;

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
  v_banner record;
  v_five_count integer;
  v_four_count integer;
  v_featured_count integer;
  v_expected_limit integer;
  v_five_limit integer;
  v_four_limit integer;
begin
  select * into v_settings
  from public.gacha_settings settings
  where settings.shop_id = p_shop_id;

  if not found or not v_settings.enabled then
    return;
  end if;

  if not exists (
    select 1 from public.gacha_banners banner
    where banner.shop_id = p_shop_id and banner.active
  ) then
    raise exception 'An enabled gacha configuration needs at least one active banner';
  end if;

  for v_banner in
    select banner.*
    from public.gacha_banners banner
    where banner.shop_id = p_shop_id and banner.active
  loop
    if not exists (
      select 1 from public.gacha_pool_entries entry
      where entry.shop_id = p_shop_id
        and entry.banner_id = v_banner.id
        and entry.active
    ) then
      raise exception 'Every active banner needs at least one active merch item ("%")',
        v_banner.name;
    end if;

    if v_settings.game_type = 'genshin' and v_banner.kind = 'character' then
      v_expected_limit := 4;
      v_five_limit := 1;
      v_four_limit := 3;
    elsif v_settings.game_type = 'genshin' then
      v_expected_limit := 7;
      v_five_limit := 2;
      v_four_limit := 5;
    else
      v_expected_limit := 4;
      v_five_limit := 1;
      v_four_limit := 3;
    end if;

    if v_banner.display_limit <> v_expected_limit then
      raise exception 'Banner "%" must use % featured slots',
        v_banner.name, v_expected_limit;
    end if;

    if exists (
      select 1 from public.gacha_pool_entries entry
      where entry.shop_id = p_shop_id
        and entry.banner_id = v_banner.id
        and entry.active
        and entry.featured
        and (
          entry.rarity not in (4, 5)
          or (v_banner.kind = 'character') <> (entry.kind = 'character')
        )
    ) then
      raise exception 'Featured items in banner "%" must match its type and use 4-star or 5-star rarity',
        v_banner.name;
    end if;

    select
      count(*) filter (where entry.rarity = 5),
      count(*) filter (where entry.rarity = 4),
      count(*)
    into v_five_count, v_four_count, v_featured_count
    from public.gacha_pool_entries entry
    where entry.shop_id = p_shop_id
      and entry.banner_id = v_banner.id
      and entry.active
      and entry.featured
      and (v_banner.kind = 'character') = (entry.kind = 'character')
      and entry.rarity in (4, 5);

    if v_settings.game_type = 'genshin'
      and (v_five_count <> v_five_limit or v_four_count <> v_four_limit) then
      raise exception 'Active Genshin banner "%" needs exactly % featured 5-star and % featured 4-star items',
        v_banner.name, v_five_limit, v_four_limit;
    end if;

    if v_settings.game_type = 'hsr'
      and (
        v_five_count > v_five_limit
        or v_four_count > v_four_limit
        or (v_featured_count > 0 and v_five_count <> 1)
      ) then
      raise exception 'Active HSR banner "%" supports one featured 5-star and up to three featured 4-star items',
        v_banner.name;
    end if;
  end loop;
end;
$$;

create or replace function public.publish_gacha_configuration_v6(
  p_shop_id uuid,
  p_game_type text,
  p_config jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_shop_role(p_shop_id, array['owner', 'admin']) then
    raise exception 'Not allowed to publish gacha configuration for this shop';
  end if;

  perform public.publish_gacha_configuration_v5(
    p_shop_id,
    p_game_type,
    p_config
  );
end;
$$;

revoke all on function public.publish_gacha_configuration_legacy_five_slot_core(uuid, text, jsonb)
from public, anon, authenticated;
revoke all on function public.publish_gacha_configuration(uuid, text, jsonb)
from public, anon, authenticated;
revoke all on function private.assert_published_gacha_configuration(uuid)
from public, anon, authenticated;
revoke all on function public.publish_gacha_configuration_v5(uuid, text, jsonb)
from public, anon, authenticated;
revoke all on function public.publish_gacha_configuration_v6(uuid, text, jsonb)
from public, anon, authenticated;
grant execute on function public.publish_gacha_configuration_v6(uuid, text, jsonb)
to authenticated;

notify pgrst, 'reload schema';
