-- The published featured rate is only realizable when each featured rarity has
-- a same-banner loss candidate. Validate the submitted payload before any of
-- the existing publish functions mutate the relational projection.
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
  v_banners jsonb := coalesce(p_config->'banners', '[]'::jsonb);
  v_entries jsonb := coalesce(p_config->'entries', '[]'::jsonb);
  v_enabled boolean := coalesce((p_config #>> '{settings,enabled}')::boolean, false);
  v_featured_rate numeric := coalesce(
    (p_config #>> '{settings,featured_item_rate}')::numeric,
    50.00
  );
  v_banner record;
  v_featured_four_count integer;
  v_featured_five_count integer;
  v_loss_four_count integer;
  v_loss_five_count integer;
begin
  if not private.has_shop_role(p_shop_id, array['owner', 'admin']) then
    raise exception 'Not allowed to publish gacha configuration for this shop';
  end if;

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
    p_config
  );
end;
$$;

revoke all on function public.publish_gacha_configuration_v6(uuid, text, jsonb)
from public, anon, authenticated;
grant execute on function public.publish_gacha_configuration_v6(uuid, text, jsonb)
to authenticated;

notify pgrst, 'reload schema';
