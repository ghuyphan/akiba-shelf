alter table public.booth_settings
  add column if not exists booth_style text not null default 'classic',
  add column if not exists cart_style text not null default 'classic';

alter table public.booth_settings
  drop constraint if exists booth_settings_booth_style_check,
  add constraint booth_settings_booth_style_check
    check (booth_style in ('classic', 'compact', 'banner', 'playful')),
  drop constraint if exists booth_settings_cart_style_check,
  add constraint booth_settings_cart_style_check
    check (cart_style in ('classic', 'compact', 'playful'));

grant select(booth_style, cart_style)
on public.booth_settings to anon, authenticated;
