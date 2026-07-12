-- Trusted single-booth staff authorization. Membership is intentionally not
-- created by an auth trigger: the first owner must be bootstrapped explicitly.
create table if not exists public.staff_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'staff')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.products add column if not exists image_paths text[] not null default '{}';
alter table public.booth_settings add column if not exists logo_path text, add column if not exists social_qr_logo_path text;

drop trigger if exists staff_members_set_updated_at on public.staff_members;
create trigger staff_members_set_updated_at before update on public.staff_members
for each row execute function public.set_updated_at();

-- Sequence-backed codes remove random collision risk while remaining short and
-- human-readable. Existing codes are preserved.
create sequence if not exists public.order_code_seq;
create or replace function public.generate_order_code()
returns text language sql volatile set search_path = ''
as $$ select 'AK-' || upper(lpad(to_hex(nextval('public.order_code_seq')), 8, '0')) $$;
revoke all on sequence public.order_code_seq from public, anon, authenticated;
revoke all on function public.generate_order_code() from public, anon, authenticated;

alter table public.staff_members enable row level security;
revoke all on public.staff_members from public, anon, authenticated;
grant select on public.staff_members to authenticated;

create or replace function private.is_active_staff()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.staff_members
    where user_id = (select auth.uid()) and active
  )
$$;

create or replace function private.has_staff_role(allowed_roles text[])
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.staff_members
    where user_id = (select auth.uid()) and active and role = any(allowed_roles)
  )
$$;

create or replace function public.get_staff_access()
returns table (role text, active boolean)
language sql stable security definer set search_path = ''
as $$
  select sm.role, sm.active
  from public.staff_members sm
  where sm.user_id = (select auth.uid())
$$;

revoke all on function private.is_active_staff(), private.has_staff_role(text[]) from public, anon, authenticated;
revoke all on function public.get_staff_access() from public, anon, authenticated;
grant execute on function public.get_staff_access() to authenticated;
grant usage on schema private to authenticated;
grant execute on function private.is_active_staff() to authenticated;
grant execute on function private.has_staff_role(text[]) to authenticated;


drop policy if exists "Owners manage staff" on public.staff_members;
drop policy if exists "Owners read staff" on public.staff_members;
create policy "Owners read staff" on public.staff_members
  for select to authenticated
  using ((select private.has_staff_role(array['owner']::text[])));

create or replace function public.save_staff_member(p_user_id uuid, p_role text, p_active boolean)
returns public.staff_members language plpgsql security definer set search_path = '' as $$
declare result public.staff_members;
begin
  if not private.has_staff_role(array['owner']::text[]) then raise exception 'Owner membership required' using errcode='42501'; end if;
  if p_role not in ('owner','admin','staff') then raise exception 'Invalid staff role'; end if;
  if not exists (select 1 from auth.users where id = p_user_id) then raise exception 'Auth user not found'; end if;
  if p_user_id = auth.uid() and (p_role <> 'owner' or not p_active)
    and not exists (select 1 from public.staff_members where role='owner' and active and user_id <> p_user_id)
    then raise exception 'The last active owner cannot remove their own owner access'; end if;
  insert into public.staff_members(user_id,role,active) values(p_user_id,p_role,p_active)
  on conflict(user_id) do update set role=excluded.role,active=excluded.active
  returning * into result;
  return result;
end $$;

create or replace function public.delete_staff_member(p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.has_staff_role(array['owner']::text[]) then raise exception 'Owner membership required' using errcode='42501'; end if;
  if p_user_id = auth.uid() and not exists (select 1 from public.staff_members where role='owner' and active and user_id <> p_user_id)
    then raise exception 'The last active owner cannot remove themselves'; end if;
  delete from public.staff_members where user_id=p_user_id;
end $$;

revoke all on function public.save_staff_member(uuid,text,boolean), public.delete_staff_member(uuid) from public,anon,authenticated;
grant execute on function public.save_staff_member(uuid,text,boolean), public.delete_staff_member(uuid) to authenticated;

-- Replace policies that previously equated authentication with authorization.
drop policy if exists "Admins can manage products" on public.products;
drop policy if exists "Public can read active products" on public.products;
drop policy if exists "Staff read operational products" on public.products;
drop policy if exists "Admins manage products" on public.products;
create policy "Public can read active products" on public.products
  for select to anon, authenticated using (active = true);
create policy "Staff read operational products" on public.products
  for select to authenticated using ((select private.is_active_staff()));
create policy "Admins manage products" on public.products
  for all to authenticated
  using ((select private.has_staff_role(array['owner','admin']::text[])))
  with check ((select private.has_staff_role(array['owner','admin']::text[])));

drop policy if exists "Admins can manage booth settings" on public.booth_settings;
drop policy if exists "Admins manage booth settings" on public.booth_settings;
create policy "Admins manage booth settings" on public.booth_settings
  for all to authenticated
  using ((select private.has_staff_role(array['owner','admin']::text[])))
  with check ((select private.has_staff_role(array['owner','admin']::text[])));

drop policy if exists "Admins can manage payment settings" on public.payment_settings;
drop policy if exists "Admins manage payment settings" on public.payment_settings;
create policy "Admins manage payment settings" on public.payment_settings
  for all to authenticated
  using ((select private.has_staff_role(array['owner','admin']::text[])))
  with check ((select private.has_staff_role(array['owner','admin']::text[])));

drop policy if exists "Admins can manage orders" on public.orders;
drop policy if exists "Staff read orders" on public.orders;
create policy "Staff read orders" on public.orders
  for select to authenticated using ((select private.is_active_staff()));

drop policy if exists "Admins can manage order items" on public.order_items;
drop policy if exists "Staff read order items" on public.order_items;
create policy "Staff read order items" on public.order_items
  for select to authenticated using ((select private.is_active_staff()));

drop policy if exists "Staff manage their push subscriptions" on public.push_subscriptions;
create policy "Staff manage their push subscriptions" on public.push_subscriptions
  for all to authenticated
  using (user_id = (select auth.uid()) and (select private.is_active_staff()))
  with check (user_id = (select auth.uid()) and (select private.is_active_staff()));

drop policy if exists "Admins can upload merch images" on storage.objects;
drop policy if exists "Admins can update merch images" on storage.objects;
drop policy if exists "Admins can delete merch images" on storage.objects;
create policy "Admins can upload merch images" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('product-images','payment-qr') and (select private.has_staff_role(array['owner','admin']::text[])));
create policy "Admins can update merch images" on storage.objects
  for update to authenticated
  using (bucket_id in ('product-images','payment-qr') and (select private.has_staff_role(array['owner','admin']::text[])))
  with check (bucket_id in ('product-images','payment-qr') and (select private.has_staff_role(array['owner','admin']::text[])));
create policy "Admins can delete merch images" on storage.objects
  for delete to authenticated
  using (bucket_id in ('product-images','payment-qr') and (select private.has_staff_role(array['owner','admin']::text[])));

-- Privileged order functions are still security-definer for atomic locking, but
-- now perform live membership checks rather than trusting the JWT role alone.
create or replace function public.confirm_order_payment(target_order_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.orders;
begin
  if not private.is_active_staff() then raise exception 'Active staff membership required' using errcode='42501'; end if;
  select * into o from public.orders where id=target_order_id for update;
  if not found then return jsonb_build_object('outcome','not_found','order',null); end if;
  if o.status='confirmed' then return jsonb_build_object('outcome','already_confirmed','order',to_jsonb(o)-'recovery_token_hash'); end if;
  if o.status='cancelled' then return jsonb_build_object('outcome','already_cancelled','order',to_jsonb(o)-'recovery_token_hash'); end if;
  if o.status='expired' then return jsonb_build_object('outcome','already_expired','order',to_jsonb(o)-'recovery_token_hash'); end if;
  if o.expires_at <= now() then o:=private.release_reservation(o.id,'expired'); return jsonb_build_object('outcome','expired','order',to_jsonb(o)-'recovery_token_hash'); end if;
  update public.orders set status='confirmed',confirmed_at=now(),confirmed_by=auth.uid() where id=o.id returning * into o;
  return jsonb_build_object('outcome','confirmed','order',to_jsonb(o)-'recovery_token_hash');
end $$;

create or replace function public.cancel_order(target_order_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.orders;
begin
  if not private.is_active_staff() then raise exception 'Active staff membership required' using errcode='42501'; end if;
  select * into o from public.orders where id=target_order_id for update;
  if not found then return jsonb_build_object('outcome','not_found','order',null); end if;
  if o.status='cancelled' then return jsonb_build_object('outcome','already_cancelled','order',to_jsonb(o)-'recovery_token_hash'); end if;
  if o.status='confirmed' then return jsonb_build_object('outcome','already_confirmed','order',to_jsonb(o)-'recovery_token_hash'); end if;
  if o.status='expired' then return jsonb_build_object('outcome','already_expired','order',to_jsonb(o)-'recovery_token_hash'); end if;
  o:=private.release_reservation(o.id,'cancelled',auth.uid());
  return jsonb_build_object('outcome','cancelled','order',to_jsonb(o)-'recovery_token_hash');
end $$;

create or replace function public.expire_pending_orders(batch_size integer default 100) returns jsonb language plpgsql security definer set search_path='' as $$
declare oid uuid; affected uuid[]:='{}'; o public.orders;
begin
  if current_user not in ('postgres','service_role') and not private.has_staff_role(array['owner','admin']::text[])
    then raise exception 'Administrator membership required' using errcode='42501'; end if;
  for oid in select id from public.orders where status='pending' and expires_at<=now() order by expires_at,id for update skip locked limit greatest(1,least(batch_size,500))
  loop o:=private.release_reservation(oid,'expired'); affected:=array_append(affected,oid); end loop;
  return jsonb_build_object('expired_count',cardinality(affected),'order_ids',to_jsonb(affected));
end $$;

revoke all on function public.confirm_order_payment(uuid), public.cancel_order(uuid), public.expire_pending_orders(integer) from public, anon, authenticated;
grant execute on function public.confirm_order_payment(uuid), public.cancel_order(uuid) to authenticated;
grant execute on function public.expire_pending_orders(integer) to authenticated, service_role;

-- Bootstrap (run once as postgres, substituting the Auth user's UUID):
-- insert into public.staff_members (user_id, role) values ('USER_UUID', 'owner');
