alter table public.products
  add column if not exists badge_color text not null default '#5f8d55';

alter table public.products
  drop constraint if exists products_badge_color_hex_check;

alter table public.products
  add constraint products_badge_color_hex_check
  check (badge_color ~ '^#[0-9A-Fa-f]{6}$');
