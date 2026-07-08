-- Add logo_url column to booth_settings
alter table public.booth_settings
  add column if not exists logo_url text;
