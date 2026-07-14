alter table public.booth_settings
  add column if not exists card_style text not null default 'soft';

alter table public.booth_settings
  drop constraint if exists booth_settings_card_style_check,
  add constraint booth_settings_card_style_check
    check (card_style in ('soft', 'outlined', 'elevated', 'playful'));

grant select(card_style) on public.booth_settings to anon, authenticated;
