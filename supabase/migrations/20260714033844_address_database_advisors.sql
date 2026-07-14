-- Cover every foreign key used by deletes, joins, ownership checks, and staff
-- notification cleanup. Keep the tenant-leading indexes as well: these indexes
-- serve the reverse lookup direction that those composites cannot cover.
create index if not exists order_items_product_id_idx
  on public.order_items(product_id);
create index if not exists orders_confirmed_by_idx
  on public.orders(confirmed_by);
create index if not exists orders_cancelled_by_idx
  on public.orders(cancelled_by);
create index if not exists push_subscriptions_user_shop_idx
  on public.push_subscriptions(user_id, shop_id);
create index if not exists shops_created_by_idx
  on public.shops(created_by);

-- Superseded by the shop-scoped queue index after the multi-shop migration.
drop index if exists public.orders_status_created_at_id_idx;

-- The later invitation hardening migration replaced this with the same unique
-- predicate under a clearer name.
drop index if exists public.shop_invitations_pending_email_idx;

-- Public/member SELECT and admin mutation were previously combined with FOR
-- ALL, causing two permissive SELECT policies to run for authenticated users.
-- Keep the same access model while evaluating a single SELECT policy.
drop policy if exists "Shop admins manage products" on public.products;
create policy "Shop admins insert products"
  on public.products for insert to authenticated
  with check (private.has_shop_role(shop_id, array['owner', 'admin']));
create policy "Shop admins update products"
  on public.products for update to authenticated
  using (private.has_shop_role(shop_id, array['owner', 'admin']))
  with check (private.has_shop_role(shop_id, array['owner', 'admin']));
create policy "Shop admins delete products"
  on public.products for delete to authenticated
  using (private.has_shop_role(shop_id, array['owner', 'admin']));

drop policy if exists "Public reads active shop booth" on public.booth_settings;
drop policy if exists "Shop admins manage booth" on public.booth_settings;
create policy "Public and admins read shop booth"
  on public.booth_settings for select to anon, authenticated
  using (
    exists(select 1 from public.shops s where s.id = shop_id and s.active)
    or private.has_shop_role(shop_id, array['owner', 'admin'])
  );
create policy "Shop admins insert booth"
  on public.booth_settings for insert to authenticated
  with check (private.has_shop_role(shop_id, array['owner', 'admin']));
create policy "Shop admins update booth"
  on public.booth_settings for update to authenticated
  using (private.has_shop_role(shop_id, array['owner', 'admin']))
  with check (private.has_shop_role(shop_id, array['owner', 'admin']));
create policy "Shop admins delete booth"
  on public.booth_settings for delete to authenticated
  using (private.has_shop_role(shop_id, array['owner', 'admin']));

drop policy if exists "Public reads active shop payment" on public.payment_settings;
drop policy if exists "Shop admins manage payment" on public.payment_settings;
create policy "Public and admins read shop payment"
  on public.payment_settings for select to anon, authenticated
  using (
    exists(select 1 from public.shops s where s.id = shop_id and s.active)
    or private.has_shop_role(shop_id, array['owner', 'admin'])
  );
create policy "Shop admins insert payment"
  on public.payment_settings for insert to authenticated
  with check (private.has_shop_role(shop_id, array['owner', 'admin']));
create policy "Shop admins update payment"
  on public.payment_settings for update to authenticated
  using (private.has_shop_role(shop_id, array['owner', 'admin']))
  with check (private.has_shop_role(shop_id, array['owner', 'admin']));
create policy "Shop admins delete payment"
  on public.payment_settings for delete to authenticated
  using (private.has_shop_role(shop_id, array['owner', 'admin']));

-- This table is written only by the service-role Edge Function. The service
-- role bypasses RLS, but an explicit service-only policy records that boundary
-- and keeps the table deny-all for browser roles.
create policy "Service role manages notification events"
  on public.order_notification_events for all to service_role
  using (true)
  with check (true);
