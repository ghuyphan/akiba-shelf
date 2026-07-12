update public.booth_settings
set layout_order = array['featured', 'booth', 'controls', 'products', 'cart']::text[]
where layout_order = array['featured', 'booth', 'controls', 'cart', 'products']::text[];

alter table public.booth_settings
  alter column layout_order
  set default array['featured', 'booth', 'controls', 'products', 'cart']::text[];
