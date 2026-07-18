-- Keep one independently published, public-safe configuration per game.
-- The existing relational projection remains in place for compatibility and
-- validation; this table is the source read by new storefront clients.
create table public.gacha_published_configs (
  shop_id uuid not null references public.shops(id) on delete cascade,
  game_type text not null check (game_type in ('genshin', 'hsr')),
  config jsonb not null check (jsonb_typeof(config) = 'object'),
  updated_at timestamptz not null default now(),
  primary key (shop_id, game_type),
  constraint gacha_published_configs_game_matches_check
    check (config #>> '{settings,game_type}' = game_type),
  constraint gacha_published_configs_shop_matches_check
    check (config #>> '{settings,shop_id}' = shop_id::text),
  constraint gacha_published_configs_enabled_boolean_check
    check (jsonb_typeof(config #> '{settings,enabled}') = 'boolean')
);

create trigger gacha_published_configs_set_updated_at
before update on public.gacha_published_configs
for each row execute function public.set_updated_at();

alter table public.gacha_published_configs enable row level security;

create policy "Anonymous reads enabled published gacha games"
on public.gacha_published_configs for select to anon
using (
  (config #>> '{settings,enabled}')::boolean
  and exists (
    select 1 from public.shops shop
    where shop.id = shop_id and shop.active
  )
);

create policy "Authenticated users read permitted published gacha games"
on public.gacha_published_configs for select to authenticated
using (
  (
    (config #>> '{settings,enabled}')::boolean
    and exists (
      select 1 from public.shops shop
      where shop.id = shop_id and shop.active
    )
  )
  or private.has_shop_role(shop_id, array['owner', 'admin'])
);

revoke all on public.gacha_published_configs
from public, anon, authenticated;
grant select on public.gacha_published_configs to anon, authenticated;

-- Preserve the game that was live before this migration. Reconstruct it from
-- the validated public projection instead of trusting a possibly newer draft.
insert into public.gacha_published_configs (shop_id, game_type, config)
select
  settings.shop_id,
  settings.game_type,
  jsonb_build_object(
    'settings', to_jsonb(settings) - 'updated_at',
    'banners', coalesce(
      (
        select jsonb_agg(to_jsonb(banner) - 'updated_at' order by banner.sort_order, banner.id)
        from public.gacha_banners banner
        where banner.shop_id = settings.shop_id
      ),
      '[]'::jsonb
    ),
    'entries', coalesce(
      (
        select jsonb_agg(to_jsonb(entry) - 'updated_at' order by entry.banner_id, entry.product_id)
        from public.gacha_pool_entries entry
        where entry.shop_id = settings.shop_id
      ),
      '[]'::jsonb
    )
  )
from public.gacha_settings settings;

-- v5 retains all of the relational validation in v4, then stores the same
-- normalized payload in the selected game's independent public slot.
create or replace function public.publish_gacha_configuration_v5(
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
  v_public_config jsonb;
begin
  if p_game_type not in ('genshin', 'hsr') then
    raise exception 'Unsupported gacha game type';
  end if;

  if not private.has_shop_role(p_shop_id, array['owner', 'admin']) then
    raise exception 'Not allowed to publish gacha configuration for this shop';
  end if;

  perform public.publish_gacha_configuration_v4(
    p_shop_id,
    p_game_type,
    p_config
  );

  v_settings := coalesce(p_config->'settings', '{}'::jsonb)
    || jsonb_build_object(
      'shop_id', p_shop_id::text,
      'game_type', p_game_type
    );
  v_public_config := coalesce(p_config, '{}'::jsonb)
    || jsonb_build_object('settings', v_settings);

  insert into public.gacha_published_configs (shop_id, game_type, config)
  values (p_shop_id, p_game_type, v_public_config)
  on conflict (shop_id, game_type) do update
  set config = excluded.config,
      updated_at = now();
end;
$$;

revoke all on function public.publish_gacha_configuration_v4(uuid, text, jsonb)
from public, anon, authenticated;
revoke all on function public.publish_gacha_configuration_v5(uuid, text, jsonb)
from public, anon, authenticated;
grant execute on function public.publish_gacha_configuration_v5(uuid, text, jsonb)
to authenticated;

notify pgrst, 'reload schema';
