-- Preserve independent Genshin and HSR editor drafts while keeping the
-- existing public contract: one selected game is published at a time.
alter table public.gacha_settings
  add column lightcone_legendary_pity smallint not null default 80,
  add constraint gacha_settings_lightcone_pity_check
    check (lightcone_legendary_pity between 10 and 100);

-- Drafts live separately from the publicly readable active settings. This
-- prevents authenticated storefront visitors from seeing unpublished pools.
create table public.gacha_game_configs (
  shop_id uuid not null references public.shops(id) on delete cascade,
  game_type text not null check (game_type in ('genshin', 'hsr')),
  config jsonb not null default '{}'::jsonb
    check (jsonb_typeof(config) = 'object'),
  updated_at timestamptz not null default now(),
  primary key (shop_id, game_type)
);

create trigger gacha_game_configs_set_updated_at
before update on public.gacha_game_configs
for each row execute function public.set_updated_at();

alter table public.gacha_game_configs enable row level security;

create policy "Shop admins read gacha drafts"
on public.gacha_game_configs for select to authenticated
using (private.has_shop_role(shop_id, array['owner', 'admin']));

create policy "Shop admins create gacha drafts"
on public.gacha_game_configs for insert to authenticated
with check (private.has_shop_role(shop_id, array['owner', 'admin']));

create policy "Shop admins update gacha drafts"
on public.gacha_game_configs for update to authenticated
using (private.has_shop_role(shop_id, array['owner', 'admin']))
with check (private.has_shop_role(shop_id, array['owner', 'admin']));

create policy "Shop admins delete gacha drafts"
on public.gacha_game_configs for delete to authenticated
using (private.has_shop_role(shop_id, array['owner', 'admin']));

-- Public clients only need the active HSR Light Cone rule.
grant select (lightcone_legendary_pity)
on public.gacha_settings to anon, authenticated;

revoke all on public.gacha_game_configs from public, anon, authenticated;
grant select, insert, update, delete
on public.gacha_game_configs to authenticated;
