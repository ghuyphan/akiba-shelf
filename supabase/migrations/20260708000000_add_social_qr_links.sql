alter table public.booth_settings
  add column if not exists instagram_url text not null default '',
  add column if not exists facebook_url text not null default '',
  add column if not exists tiktok_url text not null default '',
  add column if not exists social_qr_logo_url text not null default '';
