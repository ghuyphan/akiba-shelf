-- Keep one SELECT policy per role. Anonymous reads never invoke the private
-- membership helper, while authenticated users retain public catalog access
-- and can also read inactive settings for shops they administer.
drop policy if exists "Public reads active shop booth"
  on public.booth_settings;
drop policy if exists "Shop admins read inactive booth"
  on public.booth_settings;
create policy "Public reads active shop booth"
  on public.booth_settings for select to anon
  using (
    exists (
      select 1
      from public.shops s
      where s.id = shop_id and s.active
    )
  );
create policy "Authenticated users read permitted shop booth"
  on public.booth_settings for select to authenticated
  using (
    exists (
      select 1
      from public.shops s
      where s.id = shop_id and s.active
    )
    or private.has_shop_role(shop_id, array['owner', 'admin'])
  );

drop policy if exists "Public reads active shop payment"
  on public.payment_settings;
drop policy if exists "Shop admins read inactive payment"
  on public.payment_settings;
create policy "Public reads active shop payment"
  on public.payment_settings for select to anon
  using (
    exists (
      select 1
      from public.shops s
      where s.id = shop_id and s.active
    )
  );
create policy "Authenticated users read permitted shop payment"
  on public.payment_settings for select to authenticated
  using (
    exists (
      select 1
      from public.shops s
      where s.id = shop_id and s.active
    )
    or private.has_shop_role(shop_id, array['owner', 'admin'])
  );
