-- Disable previously published configurations that cannot realize their
-- advertised loss outcome. Admins can repair and republish them through v6.
create function private.gacha_config_has_invalid_loss_pool(
  config jsonb,
  game_type text
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  featured_rate numeric := coalesce(
    (config #>> '{settings,featured_item_rate}')::numeric,
    50
  );
  banner jsonb;
  featured_four integer;
  featured_five integer;
  loss_four integer;
  loss_five integer;
begin
  if not coalesce((config #>> '{settings,enabled}')::boolean, false) then
    return false;
  end if;
  for banner in
    select value
    from jsonb_array_elements(coalesce(config -> 'banners', '[]'::jsonb))
    where coalesce((value ->> 'active')::boolean, true)
  loop
    select
      count(*) filter (where coalesce((entry ->> 'featured')::boolean, false)
        and (entry ->> 'rarity')::integer = 4),
      count(*) filter (where coalesce((entry ->> 'featured')::boolean, false)
        and (entry ->> 'rarity')::integer = 5),
      count(*) filter (where not coalesce((entry ->> 'featured')::boolean, false)
        and (entry ->> 'rarity')::integer = 4),
      count(*) filter (where not coalesce((entry ->> 'featured')::boolean, false)
        and (entry ->> 'rarity')::integer = 5)
    into featured_four, featured_five, loss_four, loss_five
    from jsonb_array_elements(coalesce(config -> 'entries', '[]'::jsonb)) entry
    where entry ->> 'banner_id' = banner ->> 'id'
      and coalesce((entry ->> 'active')::boolean, true)
      and (entry ->> 'rarity')::integer in (4, 5);

    if game_type = 'hsr'
      and featured_four + featured_five = 0
      and (loss_four = 0 or loss_five = 0) then
      return true;
    end if;
    if featured_rate < 100
      and ((featured_four > 0 and loss_four = 0)
        or (featured_five > 0 and loss_five = 0)) then
      return true;
    end if;
  end loop;
  return false;
exception when others then
  return true;
end;
$$;

update public.gacha_settings settings
set enabled = false
where exists (
  select 1
  from public.gacha_published_configs published
  where published.shop_id = settings.shop_id
    and published.game_type = settings.game_type
    and private.gacha_config_has_invalid_loss_pool(
      published.config,
      published.game_type
    )
);

update public.gacha_published_configs published
set config = jsonb_set(published.config, '{settings,enabled}', 'false'::jsonb)
where private.gacha_config_has_invalid_loss_pool(
  published.config,
  published.game_type
);

alter table public.gacha_published_configs
  add constraint gacha_published_configs_loss_pool_check
  check (not private.gacha_config_has_invalid_loss_pool(config, game_type));

revoke all on function private.gacha_config_has_invalid_loss_pool(jsonb, text)
from public, anon, authenticated;
