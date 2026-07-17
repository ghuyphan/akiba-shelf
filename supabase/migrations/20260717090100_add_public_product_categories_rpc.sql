-- Distinct active-product categories for the storefront filter row, replacing
-- the client-side full-table pagination scan. Security-definer read-only
-- function that self-enforces the public-read predicate from the products RLS
-- policy ("Public reads products from active shops"): only active products of
-- an active shop are exposed, exactly what anonymous visitors may already see.
create or replace function public.get_public_product_categories(p_shop_id uuid)
returns table(category text) language sql stable security definer set search_path='' as $$
  select distinct btrim(p.category) as category
  from public.products p
  join public.shops s on s.id=p.shop_id
  where p.shop_id=p_shop_id and p.active and s.active and btrim(coalesce(p.category,''))<>''
  order by category
$$;
revoke all on function public.get_public_product_categories(uuid) from public,anon,authenticated;
grant execute on function public.get_public_product_categories(uuid) to anon,authenticated;
