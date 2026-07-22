-- Store draft and published configurations in one deterministic JSON shape.
-- Drafts may remain incomplete while an admin edits them; the publish chain
-- continues to enforce each game's featured composition before going live.
create or replace function private.canonicalize_gacha_configuration(
  p_shop_id uuid,
  p_game_type text,
  p_config jsonb
)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_settings jsonb;
  v_banners jsonb;
  v_entries jsonb;
begin
  if p_game_type not in ('genshin', 'hsr') then
    raise exception 'Unsupported gacha game type: %', p_game_type;
  end if;

  if p_config is null or jsonb_typeof(p_config) is distinct from 'object' then
    raise exception 'A valid gacha configuration object is required';
  end if;

  v_settings := (coalesce(p_config -> 'settings', '{}'::jsonb) - 'updated_at')
    || jsonb_build_object(
      'shop_id', p_shop_id::text,
      'game_type', p_game_type
    );

  select coalesce(
    jsonb_agg(
      (banner.value - 'shop_id' - 'updated_at')
      || jsonb_build_object('sort_order', banner.ordinality - 1)
      order by banner.ordinality
    ),
    '[]'::jsonb
  )
  into v_banners
  from jsonb_array_elements(coalesce(p_config -> 'banners', '[]'::jsonb))
    with ordinality as banner(value, ordinality);

  select coalesce(
    jsonb_agg(
      entry.value - 'shop_id' - 'updated_at'
      order by entry.ordinality
    ),
    '[]'::jsonb
  )
  into v_entries
  from jsonb_array_elements(coalesce(p_config -> 'entries', '[]'::jsonb))
    with ordinality as entry(value, ordinality);

  return jsonb_build_object(
    'settings', v_settings,
    'banners', v_banners,
    'entries', v_entries
  );
end;
$$;

create or replace function private.canonicalize_gacha_game_config_row()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.config := private.canonicalize_gacha_configuration(
    new.shop_id,
    new.game_type,
    new.config
  );
  return new;
end;
$$;

revoke all on function private.canonicalize_gacha_configuration(uuid, text, jsonb)
from public, anon, authenticated;
revoke all on function private.canonicalize_gacha_game_config_row()
from public, anon, authenticated;

drop trigger if exists gacha_game_configs_canonicalize_config
on public.gacha_game_configs;
create trigger gacha_game_configs_canonicalize_config
before insert or update
on public.gacha_game_configs
for each row execute function private.canonicalize_gacha_game_config_row();

-- Canonicalize existing rows independently so unpublished draft work remains
-- unpublished. Arigatosan is synchronized explicitly below because its draft
-- and live gameplay data were already equal apart from transport metadata.
update public.gacha_game_configs config_row
set config = private.canonicalize_gacha_configuration(
  config_row.shop_id,
  config_row.game_type,
  config_row.config
)
where config_row.config is distinct from
  private.canonicalize_gacha_configuration(
    config_row.shop_id,
    config_row.game_type,
    config_row.config
  );

update public.gacha_published_configs config_row
set config = private.canonicalize_gacha_configuration(
  config_row.shop_id,
  config_row.game_type,
  config_row.config
)
where config_row.config is distinct from
  private.canonicalize_gacha_configuration(
    config_row.shop_id,
    config_row.game_type,
    config_row.config
  );

update public.gacha_game_configs draft
set config = published.config
from public.gacha_published_configs published
join public.shops shop on shop.id = published.shop_id
where draft.shop_id = published.shop_id
  and draft.game_type = published.game_type
  and lower(shop.slug) = 'arigatosan'
  and draft.game_type in ('genshin', 'hsr')
  and draft.config is distinct from published.config;

-- Validate the canonical payload, publish it, then make that successful
-- payload the new draft in the same transaction. The v5 chain retains the
-- exact featured limits: Genshin character 1+3, Genshin weapon 2+5, and HSR
-- event character/Light Cone 1+3. HSR standard banners keep zero rate-ups.
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
declare
  v_config jsonb;
  v_banners jsonb;
  v_entries jsonb;
  v_enabled boolean;
  v_featured_rate numeric;
  v_banner record;
  v_featured_four_count integer;
  v_featured_five_count integer;
  v_loss_four_count integer;
  v_loss_five_count integer;
begin
  if not private.has_shop_role(p_shop_id, array['owner', 'admin']) then
    raise exception 'Not allowed to publish gacha configuration for this shop';
  end if;

  v_config := private.canonicalize_gacha_configuration(
    p_shop_id,
    p_game_type,
    p_config
  );
  v_banners := coalesce(v_config -> 'banners', '[]'::jsonb);
  v_entries := coalesce(v_config -> 'entries', '[]'::jsonb);
  v_enabled := coalesce(
    (v_config #>> '{settings,enabled}')::boolean,
    false
  );
  v_featured_rate := coalesce(
    (v_config #>> '{settings,featured_item_rate}')::numeric,
    50.00
  );

  if v_enabled then
    for v_banner in
      select banner.*
      from jsonb_to_recordset(v_banners) as banner(
        id uuid,
        name text,
        active boolean
      )
      where coalesce(banner.active, true)
    loop
      select
        count(*) filter (
          where coalesce(entry.featured, false) and entry.rarity = 4
        ),
        count(*) filter (
          where coalesce(entry.featured, false) and entry.rarity = 5
        ),
        count(*) filter (
          where not coalesce(entry.featured, false) and entry.rarity = 4
        ),
        count(*) filter (
          where not coalesce(entry.featured, false) and entry.rarity = 5
        )
      into
        v_featured_four_count,
        v_featured_five_count,
        v_loss_four_count,
        v_loss_five_count
      from jsonb_to_recordset(v_entries) as entry(
        banner_id uuid,
        rarity integer,
        featured boolean,
        active boolean
      )
      where entry.banner_id = v_banner.id
        and coalesce(entry.active, true)
        and entry.rarity in (4, 5);

      if p_game_type = 'hsr'
        and v_featured_four_count + v_featured_five_count = 0
        and (v_loss_four_count = 0 or v_loss_five_count = 0) then
        raise exception 'Active HSR standard banner "%" needs active nonfeatured 4-star and 5-star items',
          v_banner.name;
      end if;

      if v_featured_rate < 100
        and v_featured_four_count > 0
        and v_loss_four_count = 0 then
        raise exception 'Active banner "%" needs an active nonfeatured 4-star item when featured-item rate is below 100',
          v_banner.name;
      end if;

      if v_featured_rate < 100
        and v_featured_five_count > 0
        and v_loss_five_count = 0 then
        raise exception 'Active banner "%" needs an active nonfeatured 5-star item when featured-item rate is below 100',
          v_banner.name;
      end if;
    end loop;
  end if;

  perform public.publish_gacha_configuration_v5(
    p_shop_id,
    p_game_type,
    v_config
  );

  insert into public.gacha_game_configs (shop_id, game_type, config)
  values (p_shop_id, p_game_type, v_config)
  on conflict (shop_id, game_type) do update
  set config = excluded.config,
      updated_at = now();
end;
$$;

revoke all on function public.publish_gacha_configuration_v6(uuid, text, jsonb)
from public, anon, authenticated;
grant execute on function public.publish_gacha_configuration_v6(uuid, text, jsonb)
to authenticated;

notify pgrst, 'reload schema';
