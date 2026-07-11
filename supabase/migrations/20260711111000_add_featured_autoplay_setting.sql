alter table public.booth_settings
  add column if not exists featured_autoplay boolean not null default true;
