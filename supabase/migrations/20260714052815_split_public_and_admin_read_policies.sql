-- Keep public reads independent from privileged helper calls. The anon role
-- intentionally cannot execute private.has_shop_role(), and PostgreSQL is free
-- to evaluate either side of an OR expression in an RLS policy.
drop policy if exists "Public and admins read shop booth"
  on public.booth_settings;
create policy "Public reads active shop booth"
  on public.booth_settings for select to anon, authenticated
  using (
    exists (
      select 1
      from public.shops s
      where s.id = shop_id and s.active
    )
  );
create policy "Shop admins read inactive booth"
  on public.booth_settings for select to authenticated
  using (private.has_shop_role(shop_id, array['owner', 'admin']));

drop policy if exists "Public and admins read shop payment"
  on public.payment_settings;
create policy "Public reads active shop payment"
  on public.payment_settings for select to anon, authenticated
  using (
    exists (
      select 1
      from public.shops s
      where s.id = shop_id and s.active
    )
  );
create policy "Shop admins read inactive payment"
  on public.payment_settings for select to authenticated
  using (private.has_shop_role(shop_id, array['owner', 'admin']));
