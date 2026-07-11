-- Remove hero_title and hero_text fields from booth_settings
alter table public.booth_settings
  drop column if exists hero_title,
  drop column if exists hero_text;
