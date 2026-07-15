-- gacha_banners intentionally exposes an explicit public column allow-list.
-- Keep the new visual theme readable without broadening access to future columns.
grant select (theme) on public.gacha_banners to anon, authenticated;
