drop policy "Public reads active shop promotions" on public.promotions;
drop policy "Shop admins read promotions" on public.promotions;
drop policy "Shop admins manage promotions" on public.promotions;

create policy "Public reads active shop promotions"
on public.promotions for select to anon
using (enabled);

create policy "Authenticated users read visible shop promotions"
on public.promotions for select to authenticated
using (
  enabled
  or private.has_shop_role(shop_id, array['owner', 'admin'])
);

create policy "Shop admins insert promotions"
on public.promotions for insert to authenticated
with check (private.has_shop_role(shop_id, array['owner', 'admin']));

create policy "Shop admins update promotions"
on public.promotions for update to authenticated
using (private.has_shop_role(shop_id, array['owner', 'admin']))
with check (private.has_shop_role(shop_id, array['owner', 'admin']));

create policy "Shop admins delete promotions"
on public.promotions for delete to authenticated
using (private.has_shop_role(shop_id, array['owner', 'admin']));
