alter table public.booth_settings
  add column if not exists featured_style text not null default 'deck',
  add column if not exists controls_style text not null default 'panel',
  add column if not exists product_style text not null default 'classic';

alter table public.booth_settings
  drop constraint if exists booth_settings_featured_style_check,
  add constraint booth_settings_featured_style_check
    check (featured_style in ('deck', 'editorial', 'minimal', 'poster')),
  drop constraint if exists booth_settings_controls_style_check,
  add constraint booth_settings_controls_style_check
    check (controls_style in ('panel', 'floating', 'compact', 'playful')),
  drop constraint if exists booth_settings_product_style_check,
  add constraint booth_settings_product_style_check
    check (product_style in ('classic', 'minimal', 'framed', 'playful'));

grant select(featured_style, controls_style, product_style)
on public.booth_settings to anon, authenticated;
