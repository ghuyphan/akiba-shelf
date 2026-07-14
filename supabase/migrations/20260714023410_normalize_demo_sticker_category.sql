-- The read-only demo mirrors Arigato-san's catalog. Merge the misspelled
-- category into the canonical label so all sticker products share one filter.
update public.products as product
set category = 'Sticker pack'
from public.shops as shop
where product.shop_id = shop.id
  and shop.slug = 'arigatosan'
  and product.category = 'Stiker pack';
