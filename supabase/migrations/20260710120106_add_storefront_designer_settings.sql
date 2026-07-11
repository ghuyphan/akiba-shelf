alter table public.booth_settings
  add column if not exists layout_order text[] not null default array['featured', 'controls', 'products']::text[],
  add column if not exists corner_radius smallint not null default 16,
  add column if not exists catalog_locale text not null default 'en';

alter table public.booth_settings
  drop constraint if exists booth_settings_corner_radius_check,
  add constraint booth_settings_corner_radius_check
    check (corner_radius between 0 and 32),
  drop constraint if exists booth_settings_catalog_locale_check,
  add constraint booth_settings_catalog_locale_check
    check (catalog_locale in ('en', 'vi')),
  drop constraint if exists booth_settings_layout_order_check,
  add constraint booth_settings_layout_order_check
    check (
      (
        cardinality(layout_order) = 3
        and layout_order @> array['featured', 'controls', 'products']::text[]
        and layout_order <@ array['featured', 'controls', 'products']::text[]
      )
      or
      (
        cardinality(layout_order) = 5
        and layout_order @> array['featured', 'controls', 'products', 'booth', 'cart']::text[]
        and layout_order <@ array['featured', 'controls', 'products', 'booth', 'cart']::text[]
      )
    );
