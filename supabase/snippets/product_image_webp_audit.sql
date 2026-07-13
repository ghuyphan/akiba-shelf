-- Product image WebP audit (read-only; safe to run before and after backfill).
--
-- PostgreSQL can inspect Storage metadata and update URL/path references, but it
-- cannot decode JPEG/PNG bytes and re-encode them as WebP. Run
-- scripts/backfill-product-images-webp.ts for the actual binary conversion.

-- 1. Product-managed image paths still requiring conversion.
select
  p.shop_id,
  p.id as product_id,
  p.name as product_name,
  paths.ordinality as path_position,
  case when paths.ordinality % 2 = 1 then 'thumbnail' else 'detail' end as variant,
  paths.path
from public.products as p
cross join lateral unnest(coalesce(p.image_paths, '{}'::text[]))
  with ordinality as paths(path, ordinality)
where paths.path !~* '\.webp$'
order by p.shop_id, p.sort_order, p.id, paths.ordinality;

-- 2. Non-WebP objects still present in both app image buckets. Some may be
-- intentional external/legacy assets or rollback copies, so this does not delete.
select
  o.bucket_id,
  o.name as object_path,
  o.metadata ->> 'mimetype' as mime_type,
  o.created_at,
  o.updated_at
from storage.objects as o
where o.bucket_id in ('product-images', 'payment-qr')
  and (
    o.name !~* '\.webp$'
    or coalesce(o.metadata ->> 'mimetype', '') <> 'image/webp'
  )
order by o.bucket_id, o.name;

-- 3. Old product-image objects no longer referenced after a successful backfill.
-- Review these rollback copies before deleting anything from Storage.
select
  o.name as unreferenced_legacy_object,
  o.metadata ->> 'mimetype' as mime_type,
  o.created_at
from storage.objects as o
where o.bucket_id = 'product-images'
  and o.name !~* '\.webp$'
  and not exists (
    select 1
    from public.products as p
    where o.name = any(coalesce(p.image_paths, '{}'::text[]))
  )
order by o.name;

-- 4. A zero result here confirms that every app-managed product path is WebP.
select count(*) as referenced_non_webp_product_paths
from public.products as p
cross join lateral unnest(coalesce(p.image_paths, '{}'::text[])) as paths(path)
where paths.path !~* '\.webp$';
