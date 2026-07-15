-- Add game_type to gacha_settings
alter table public.gacha_settings
  add column game_type text not null default 'genshin'
  constraint gacha_settings_game_type_check check (game_type in ('genshin', 'hsr'));

grant select (game_type) on public.gacha_settings to anon, authenticated;

-- Expand theme check constraint on gacha_banners to allow HSR elements
alter table public.gacha_banners
  drop constraint gacha_banners_theme_check;

alter table public.gacha_banners
  add constraint gacha_banners_theme_check check (theme in (
    'anemo', 'geo', 'electro', 'dendro', 'hydro', 'pyro', 'cryo',
    'physical', 'fire', 'ice', 'lightning', 'wind', 'quantum', 'imaginary'
  ));

-- Expand kind check constraint on gacha_pool_entries to allow lightcones
alter table public.gacha_pool_entries
  drop constraint gacha_pool_entries_kind_check;

alter table public.gacha_pool_entries
  add constraint gacha_pool_entries_kind_check check (kind in ('character', 'weapon', 'lightcone'));

-- Expand element check constraint on gacha_pool_entries to allow HSR elements
alter table public.gacha_pool_entries
  drop constraint gacha_pool_entries_element_check;

alter table public.gacha_pool_entries
  add constraint gacha_pool_entries_element_check check (element in (
    'anemo', 'geo', 'electro', 'dendro', 'hydro', 'pyro', 'cryo',
    'physical', 'fire', 'ice', 'lightning', 'wind', 'quantum', 'imaginary'
  ));

-- Expand weapon_type check constraint on gacha_pool_entries to allow HSR paths
alter table public.gacha_pool_entries
  drop constraint gacha_pool_entries_weapon_type_check;

alter table public.gacha_pool_entries
  add constraint gacha_pool_entries_weapon_type_check check (weapon_type in (
    'sword', 'claymore', 'polearm', 'bow', 'catalyst',
    'destruction', 'hunt', 'erudition', 'harmony', 'nihility', 'preservation', 'abundance'
  ));
