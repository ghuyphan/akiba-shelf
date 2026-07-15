-- Expand kind check constraint on gacha_banners to allow lightcones
alter table public.gacha_banners
  drop constraint gacha_banners_kind_check;

alter table public.gacha_banners
  add constraint gacha_banners_kind_check check (kind in ('character', 'weapon', 'lightcone'));
