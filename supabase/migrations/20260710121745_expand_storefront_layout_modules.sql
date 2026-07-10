alter table public.booth_settings
  drop constraint if exists booth_settings_layout_order_check;

update public.booth_settings
set layout_order = array['featured', 'booth', 'controls', 'cart', 'products']::text[]
where layout_order is null
   or cardinality(layout_order) <> 5
   or not layout_order @> array['featured', 'controls', 'products', 'booth', 'cart']::text[];

alter table public.booth_settings
  alter column layout_order set default array['featured', 'booth', 'controls', 'cart', 'products']::text[],
  add constraint booth_settings_layout_order_check check (
    cardinality(layout_order) = 5
    and layout_order @> array['featured', 'controls', 'products', 'booth', 'cart']::text[]
    and layout_order <@ array['featured', 'controls', 'products', 'booth', 'cart']::text[]
  );
