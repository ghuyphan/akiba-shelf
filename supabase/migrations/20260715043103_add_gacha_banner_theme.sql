alter table public.gacha_banners
  add column theme text not null default 'anemo';

alter table public.gacha_banners
  add constraint gacha_banners_theme_check
  check (theme in ('anemo', 'geo', 'electro', 'dendro', 'hydro', 'pyro', 'cryo'));
