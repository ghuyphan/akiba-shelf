-- Normalize legacy/client-race overflow deterministically before enforcing the
-- storefront's eight-item featured contract at the data boundary.
with ranked_featured as (
  select
    product.id,
    row_number() over (
      partition by product.shop_id
      order by product.sort_order, product.id
    ) featured_position
  from public.products product
  where product.featured
)
update public.products product
set featured = false
from ranked_featured ranked
where product.id = ranked.id
  and ranked.featured_position > 8;

create index if not exists products_shop_featured_idx
  on public.products(shop_id)
  where featured;

create or replace function private.enforce_featured_product_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not new.featured then
    return new;
  end if;
  if tg_op = 'UPDATE'
    and old.featured
    and old.shop_id = new.shop_id then
    return new;
  end if;

  -- Serialize featured-slot changes per shop so concurrent admin writes cannot
  -- both observe the same final slot.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.shop_id::text, 20260806)
  );
  if (
    select count(*)
    from public.products product
    where product.shop_id = new.shop_id
      and product.featured
      and product.id <> new.id
  ) >= 8 then
    raise exception 'A shop can feature at most 8 products'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_featured_product_limit on public.products;
create trigger enforce_featured_product_limit
before insert or update of featured, shop_id on public.products
for each row execute function private.enforce_featured_product_limit();

revoke all on function private.enforce_featured_product_limit() from public;
