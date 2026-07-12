-- Multi-shop tenant model. Existing rows are assigned to the deterministic
-- Akiba Shelf shop before tenant columns become required.
create extension if not exists pgcrypto with schema extensions;

create table public.shops (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 100),
  slug text not null,
  created_by uuid not null references auth.users(id),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shops_slug_format check (slug = lower(slug) and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and length(slug) between 2 and 63),
  constraint shops_slug_key unique (slug)
);

create table public.shop_members (
  shop_id uuid not null references public.shops(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','staff')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (shop_id,user_id)
);

create table public.shop_invitations (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  email text not null check (email = lower(btrim(email)) and length(email) between 3 and 320),
  role text not null check (role in ('owner','admin','staff')),
  invited_by uuid not null references auth.users(id),
  status text not null default 'pending' check (status in ('pending','accepted','revoked','expired')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index shop_invitations_pending_email_idx on public.shop_invitations(shop_id,lower(email)) where status='pending';
create index shop_members_user_idx on public.shop_members(user_id,shop_id) where active;

drop trigger if exists shops_set_updated_at on public.shops;
create trigger shops_set_updated_at before update on public.shops for each row execute function public.set_updated_at();
drop trigger if exists shop_members_set_updated_at on public.shop_members;
create trigger shop_members_set_updated_at before update on public.shop_members for each row execute function public.set_updated_at();
drop trigger if exists shop_invitations_set_updated_at on public.shop_invitations;
create trigger shop_invitations_set_updated_at before update on public.shop_invitations for each row execute function public.set_updated_at();

-- The ID is stable across every installation, which keeps the root route and
-- existing integrations deterministic.
insert into public.shops(id,name,slug,created_by)
select '00000000-0000-4000-8000-000000000001', 'Akiba Shelf', 'akiba-shelf', sm.user_id
from public.staff_members sm where sm.role='owner' and sm.active order by sm.created_at limit 1
on conflict (id) do nothing;

-- A populated installation must have an owner before this migration. This is
-- also how the legacy app was bootstrapped.
do $$ begin
  if not exists(select 1 from public.shops where id='00000000-0000-4000-8000-000000000001')
    and (exists(select 1 from public.products) or exists(select 1 from public.orders)
      or exists(select 1 from public.booth_settings) or exists(select 1 from public.payment_settings)) then
    raise exception 'Cannot create the default shop: add an active owner to staff_members first';
  end if;
end $$;

insert into public.shop_members(shop_id,user_id,role,active,created_at,updated_at)
select '00000000-0000-4000-8000-000000000001',user_id,role,active,created_at,updated_at from public.staff_members
on conflict (shop_id,user_id) do update set role=excluded.role,active=excluded.active,updated_at=excluded.updated_at;

alter table public.products add column shop_id uuid references public.shops(id);
alter table public.orders add column shop_id uuid references public.shops(id);
alter table public.order_items add column shop_id uuid references public.shops(id);
alter table public.booth_settings add column shop_id uuid references public.shops(id);
alter table public.payment_settings add column shop_id uuid references public.shops(id);
alter table public.push_subscriptions add column shop_id uuid references public.shops(id);
alter table public.order_notification_events add column shop_id uuid references public.shops(id);

update public.products set shop_id='00000000-0000-4000-8000-000000000001' where shop_id is null;
update public.orders set shop_id='00000000-0000-4000-8000-000000000001' where shop_id is null;
update public.order_items oi set shop_id=o.shop_id from public.orders o where oi.order_id=o.id and oi.shop_id is null;
update public.booth_settings set shop_id='00000000-0000-4000-8000-000000000001' where shop_id is null;
update public.payment_settings set shop_id='00000000-0000-4000-8000-000000000001' where shop_id is null;
update public.push_subscriptions set shop_id='00000000-0000-4000-8000-000000000001' where shop_id is null;
update public.order_notification_events e set shop_id=o.shop_id from public.orders o where e.order_id=o.id and e.shop_id is null;

alter table public.products alter column shop_id set not null;
alter table public.orders alter column shop_id set not null;
alter table public.order_items alter column shop_id set not null;
alter table public.booth_settings alter column shop_id set not null;
alter table public.payment_settings alter column shop_id set not null;
alter table public.push_subscriptions alter column shop_id set not null;
alter table public.order_notification_events alter column shop_id set not null;

drop index if exists public.products_item_code_idx;
create unique index products_shop_item_code_idx on public.products(shop_id,item_code);
create index products_shop_active_sort_idx on public.products(shop_id,active,sort_order);
create index orders_shop_status_created_idx on public.orders(shop_id,status,created_at desc);
create index order_items_shop_order_idx on public.order_items(shop_id,order_id);
create unique index booth_settings_one_per_shop_idx on public.booth_settings(shop_id);
create unique index payment_settings_one_per_shop_idx on public.payment_settings(shop_id);
create index push_subscriptions_shop_user_idx on public.push_subscriptions(shop_id,user_id);
alter table public.push_subscriptions drop constraint if exists push_subscriptions_endpoint_key;
alter table public.push_subscriptions add constraint push_subscriptions_shop_endpoint_key unique(shop_id,endpoint);
create index order_notification_events_shop_created_idx on public.order_notification_events(shop_id,created_at desc);

create or replace function private.is_shop_member(p_shop_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.shop_members m where m.shop_id=p_shop_id and m.user_id=(select auth.uid()) and m.active) $$;
create or replace function private.has_shop_role(p_shop_id uuid,p_roles text[])
returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.shop_members m where m.shop_id=p_shop_id and m.user_id=(select auth.uid()) and m.active and m.role=any(p_roles)) $$;
revoke all on function private.is_shop_member(uuid),private.has_shop_role(uuid,text[]) from public,anon,authenticated;
-- These helpers are referenced by RLS expressions. The private schema is not
-- exposed through the Data API, but database roles still need USAGE/EXECUTE
-- to evaluate policies. The helpers return only booleans and derive identity
-- from auth.uid(); callers cannot supply a user identity.
grant usage on schema private to anon,authenticated;
grant execute on function private.is_shop_member(uuid) to anon,authenticated;
grant execute on function private.has_shop_role(uuid,text[]) to authenticated;

alter table public.shops enable row level security;
alter table public.shop_members enable row level security;
alter table public.shop_invitations enable row level security;
grant select on public.shops to anon,authenticated;
grant select on public.shop_members,public.shop_invitations to authenticated;

create policy "Public reads active shops" on public.shops for select to anon,authenticated using(active or private.is_shop_member(id));
create policy "Owners update shops" on public.shops for update to authenticated using(private.has_shop_role(id,array['owner'])) with check(private.has_shop_role(id,array['owner']));
create policy "Members read shop memberships" on public.shop_members for select to authenticated using(user_id=(select auth.uid()) or private.has_shop_role(shop_id,array['owner']));
create policy "Owners read invitations" on public.shop_invitations for select to authenticated using(private.has_shop_role(shop_id,array['owner']));

-- Replace every global data policy with a tenant predicate.
do $$ declare p record; begin
  for p in select schemaname,tablename,policyname from pg_policies where schemaname='public' and tablename in ('products','booth_settings','payment_settings','orders','order_items','push_subscriptions')
  loop execute format('drop policy if exists %I on %I.%I',p.policyname,p.schemaname,p.tablename); end loop;
end $$;
create policy "Public reads active shop products" on public.products for select to anon,authenticated using(active or private.is_shop_member(shop_id));
create policy "Shop admins manage products" on public.products for all to authenticated using(private.has_shop_role(shop_id,array['owner','admin'])) with check(private.has_shop_role(shop_id,array['owner','admin']));
create policy "Public reads active shop booth" on public.booth_settings for select to anon,authenticated using(exists(select 1 from public.shops s where s.id=shop_id and s.active));
create policy "Shop admins manage booth" on public.booth_settings for all to authenticated using(private.has_shop_role(shop_id,array['owner','admin'])) with check(private.has_shop_role(shop_id,array['owner','admin']));
create policy "Public reads active shop payment" on public.payment_settings for select to anon,authenticated using(exists(select 1 from public.shops s where s.id=shop_id and s.active));
create policy "Shop admins manage payment" on public.payment_settings for all to authenticated using(private.has_shop_role(shop_id,array['owner','admin'])) with check(private.has_shop_role(shop_id,array['owner','admin']));
create policy "Shop staff read orders" on public.orders for select to authenticated using(private.is_shop_member(shop_id));
create policy "Shop staff read order items" on public.order_items for select to authenticated using(private.is_shop_member(shop_id));
create policy "Staff manage shop push subscription" on public.push_subscriptions for all to authenticated using(user_id=(select auth.uid()) and private.is_shop_member(shop_id)) with check(user_id=(select auth.uid()) and private.is_shop_member(shop_id));

-- Storage paths are namespaced as <shop uuid>/..., allowing the policy to
-- authorize the owning shop without trusting client metadata.
do $$ declare p record; begin
  for p in select policyname from pg_policies where schemaname='storage' and tablename='objects' and policyname like 'Admins can % merch images'
  loop execute format('drop policy if exists %I on storage.objects',p.policyname); end loop;
end $$;
create policy "Shop admins upload merch images" on storage.objects for insert to authenticated with check(bucket_id in ('product-images','payment-qr') and private.has_shop_role((storage.foldername(name))[1]::uuid,array['owner','admin']));
create policy "Shop admins update merch images" on storage.objects for update to authenticated using(bucket_id in ('product-images','payment-qr') and private.has_shop_role((storage.foldername(name))[1]::uuid,array['owner','admin'])) with check(bucket_id in ('product-images','payment-qr') and private.has_shop_role((storage.foldername(name))[1]::uuid,array['owner','admin']));
create policy "Shop admins delete merch images" on storage.objects for delete to authenticated using(bucket_id in ('product-images','payment-qr') and private.has_shop_role((storage.foldername(name))[1]::uuid,array['owner','admin']));

create or replace function public.get_my_shop_memberships()
returns table(shop_id uuid,shop_name text,shop_slug text,role text,active boolean)
language sql stable security definer set search_path='' as $$
  select s.id,s.name,s.slug,m.role,m.active from public.shop_members m join public.shops s on s.id=m.shop_id
  where m.user_id=(select auth.uid()) and m.active and s.active order by s.name
$$;

create or replace function public.get_shop_members(p_shop_id uuid)
returns table(shop_id uuid,user_id uuid,email text,role text,active boolean,created_at timestamptz,updated_at timestamptz)
language sql stable security definer set search_path='' as $$
  select m.shop_id,m.user_id,lower(u.email),m.role,m.active,m.created_at,m.updated_at
  from public.shop_members m join auth.users u on u.id=m.user_id
  where m.shop_id=p_shop_id and private.has_shop_role(p_shop_id,array['owner']) order by m.created_at
$$;

create or replace function public.find_auth_user_by_email(p_email text)
returns uuid language sql stable security definer set search_path='' as $$
  select id from auth.users where lower(email)=lower(btrim(p_email)) limit 1
$$;

create or replace function public.create_shop(p_name text,p_slug text)
returns public.shops language plpgsql security definer set search_path='' as $$
declare s public.shops; normalized_slug text;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  normalized_slug:=trim(both '-' from regexp_replace(lower(btrim(p_slug)),'[^a-z0-9]+','-','g'));
  if normalized_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' or length(normalized_slug) not between 2 and 63 then raise exception 'Invalid shop slug'; end if;
  insert into public.shops(name,slug,created_by) values(btrim(p_name),normalized_slug,auth.uid()) returning * into s;
  insert into public.shop_members(shop_id,user_id,role) values(s.id,auth.uid(),'owner');
  insert into public.booth_settings(id,shop_id,booth_name) values(s.id::text,s.id,btrim(p_name));
  insert into public.payment_settings(id,shop_id) values(s.id::text,s.id);
  return s;
end $$;

create or replace function public.save_shop_member(p_shop_id uuid,p_user_id uuid,p_role text,p_active boolean)
returns public.shop_members language plpgsql security definer set search_path='' as $$
declare result public.shop_members; lock_key bigint;
begin
  if not private.has_shop_role(p_shop_id,array['owner']) then raise exception 'Shop owner access required' using errcode='42501'; end if;
  if p_role not in ('owner','admin','staff') then raise exception 'Invalid staff role'; end if;
  lock_key:=hashtextextended('shop-owner:'||p_shop_id::text,0); perform pg_advisory_xact_lock(lock_key);
  if exists(select 1 from public.shop_members where shop_id=p_shop_id and user_id=p_user_id and role='owner' and active)
    and (p_role<>'owner' or not p_active) and (select count(*) from public.shop_members where shop_id=p_shop_id and role='owner' and active)<=1
    then raise exception 'A shop must keep at least one active owner'; end if;
  insert into public.shop_members(shop_id,user_id,role,active) values(p_shop_id,p_user_id,p_role,p_active)
  on conflict(shop_id,user_id) do update set role=excluded.role,active=excluded.active returning * into result;
  return result;
end $$;
create or replace function public.delete_shop_member(p_shop_id uuid,p_user_id uuid)
returns void language plpgsql security definer set search_path='' as $$ begin
  if not private.has_shop_role(p_shop_id,array['owner']) then raise exception 'Shop owner access required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('shop-owner:'||p_shop_id::text,0));
  if exists(select 1 from public.shop_members where shop_id=p_shop_id and user_id=p_user_id and role='owner' and active)
    and (select count(*) from public.shop_members where shop_id=p_shop_id and role='owner' and active)<=1 then raise exception 'A shop must keep at least one active owner'; end if;
  delete from public.shop_members where shop_id=p_shop_id and user_id=p_user_id;
end $$;

-- Shop-safe ordering. The slug is resolved server-side, products are locked,
-- and every product must belong to that active shop.
drop function if exists public.create_order(text,jsonb,uuid,text);
create function public.create_order(p_shop_slug text,p_customer_name text,p_items jsonb,p_client_request_id uuid,p_recovery_token text)
returns table(id uuid,order_code text,customer_name text,total_amount integer,status public.order_status,created_at timestamptz,updated_at timestamptz,expires_at timestamptz,confirmed_at timestamptz,cancelled_at timestamptz,expired_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare v_shop uuid;v_order public.orders;v_existing public.orders;v_total integer;v_hash text;v_product_id text;
begin
  select s.id into v_shop from public.shops s where s.slug=lower(btrim(p_shop_slug)) and s.active;
  if v_shop is null then raise exception 'Shop not found or inactive'; end if;
  if p_client_request_id is null then raise exception 'A client request id is required'; end if;
  if p_recovery_token is null or length(p_recovery_token)<32 then raise exception 'A recovery token is required'; end if;
  v_hash:=encode(extensions.digest(p_recovery_token,'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended(p_client_request_id::text,0));
  select * into v_existing from public.orders o where o.client_request_id=p_client_request_id;
  if found then
    if v_existing.shop_id<>v_shop or v_existing.recovery_token_hash is distinct from v_hash then raise exception 'This request id belongs to another checkout'; end if;
    return query select v_existing.id,v_existing.order_code,v_existing.customer_name,v_existing.total_amount,v_existing.status,v_existing.created_at,v_existing.updated_at,v_existing.expires_at,v_existing.confirmed_at,v_existing.cancelled_at,v_existing.expired_at; return;
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 50 then raise exception 'Cart must contain between 1 and 50 items'; end if;
  if exists(select 1 from jsonb_to_recordset(p_items)x(product_id text,quantity integer) where product_id is null or quantity is null or quantity<=0) then raise exception 'Cart contains an invalid item'; end if;
  perform p.id from public.products p where p.shop_id=v_shop and p.id in(select x.product_id from jsonb_to_recordset(p_items)x(product_id text,quantity integer)) order by p.id for update;
  if exists(select 1 from (select x.product_id,sum(x.quantity)::integer quantity from jsonb_to_recordset(p_items)x(product_id text,quantity integer) group by x.product_id)x left join public.products p on p.shop_id=v_shop and p.id=x.product_id where p.id is null or not p.active or p.quantity_available<x.quantity) then raise exception 'One or more items are sold out or no longer have enough stock'; end if;
  select sum(p.price_vnd*x.quantity)::integer into v_total from (select i.product_id,sum(i.quantity)::integer quantity from jsonb_to_recordset(p_items)i(product_id text,quantity integer) group by i.product_id)x join public.products p on p.shop_id=v_shop and p.id=x.product_id;
  insert into public.orders(shop_id,customer_name,total_amount,status,client_request_id,recovery_token_hash,expires_at) values(v_shop,nullif(btrim(left(p_customer_name,30)),''),v_total,'pending',p_client_request_id,v_hash,now()+private.reservation_duration()) returning * into v_order;
  insert into public.order_items(shop_id,order_id,product_id,quantity,unit_price) select v_shop,v_order.id,p.id,x.quantity,p.price_vnd from (select i.product_id,sum(i.quantity)::integer quantity from jsonb_to_recordset(p_items)i(product_id text,quantity integer) group by i.product_id)x join public.products p on p.shop_id=v_shop and p.id=x.product_id;
  for v_product_id in update public.products p set quantity_available=p.quantity_available-x.quantity from (select i.product_id,sum(i.quantity)::integer quantity from jsonb_to_recordset(p_items)i(product_id text,quantity integer) group by i.product_id)x where p.shop_id=v_shop and p.id=x.product_id returning p.id loop perform private.sync_product_stock(v_product_id); end loop;
  return query select v_order.id,v_order.order_code,v_order.customer_name,v_order.total_amount,v_order.status,v_order.created_at,v_order.updated_at,v_order.expires_at,v_order.confirmed_at,v_order.cancelled_at,v_order.expired_at;
end $$;

create or replace function public.confirm_order_payment(target_order_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$ declare o public.orders; begin
  select * into o from public.orders where id=target_order_id for update;
  if not found then return jsonb_build_object('outcome','not_found','order',null); end if;
  if not private.is_shop_member(o.shop_id) then raise exception 'Active shop membership required' using errcode='42501'; end if;
  if o.status='confirmed' then return jsonb_build_object('outcome','already_confirmed','order',to_jsonb(o)-'recovery_token_hash'); end if;
  if o.status='cancelled' then return jsonb_build_object('outcome','already_cancelled','order',to_jsonb(o)-'recovery_token_hash'); end if;
  if o.status='expired' then return jsonb_build_object('outcome','already_expired','order',to_jsonb(o)-'recovery_token_hash'); end if;
  if o.expires_at<=now() then o:=private.release_reservation(o.id,'expired');return jsonb_build_object('outcome','expired','order',to_jsonb(o)-'recovery_token_hash');end if;
  update public.orders set status='confirmed',confirmed_at=now(),confirmed_by=auth.uid() where id=o.id returning * into o;return jsonb_build_object('outcome','confirmed','order',to_jsonb(o)-'recovery_token_hash');end $$;
create or replace function public.cancel_order(target_order_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$ declare o public.orders; begin
  select * into o from public.orders where id=target_order_id for update;if not found then return jsonb_build_object('outcome','not_found','order',null);end if;
  if not private.is_shop_member(o.shop_id) then raise exception 'Active shop membership required' using errcode='42501';end if;
  if o.status='cancelled' then return jsonb_build_object('outcome','already_cancelled','order',to_jsonb(o)-'recovery_token_hash');end if;if o.status='confirmed' then return jsonb_build_object('outcome','already_confirmed','order',to_jsonb(o)-'recovery_token_hash');end if;if o.status='expired' then return jsonb_build_object('outcome','already_expired','order',to_jsonb(o)-'recovery_token_hash');end if;
  o:=private.release_reservation(o.id,'cancelled',auth.uid());return jsonb_build_object('outcome','cancelled','order',to_jsonb(o)-'recovery_token_hash');end $$;

create or replace function public.expire_pending_orders(batch_size integer default 100) returns jsonb language plpgsql security definer set search_path='' as $$
declare oid uuid;affected uuid[]:='{}';o public.orders;
begin
  if current_user not in ('postgres','service_role') then raise exception 'Service role required' using errcode='42501';end if;
  for oid in select id from public.orders where status='pending' and expires_at<=now() order by expires_at,id for update skip locked limit greatest(1,least(batch_size,500))
  loop o:=private.release_reservation(oid,'expired');affected:=array_append(affected,oid);end loop;
  return jsonb_build_object('expired_count',cardinality(affected),'order_ids',to_jsonb(affected));
end $$;
revoke all on function public.expire_pending_orders(integer) from public,anon,authenticated;
grant execute on function public.expire_pending_orders(integer) to service_role;

revoke all on function public.get_my_shop_memberships(),public.get_shop_members(uuid),public.find_auth_user_by_email(text),public.create_shop(text,text),public.save_shop_member(uuid,uuid,text,boolean),public.delete_shop_member(uuid,uuid),public.create_order(text,text,jsonb,uuid,text) from public,anon,authenticated;
grant execute on function public.get_my_shop_memberships(),public.get_shop_members(uuid),public.create_shop(text,text),public.save_shop_member(uuid,uuid,text,boolean),public.delete_shop_member(uuid,uuid) to authenticated;
grant execute on function public.find_auth_user_by_email(text) to service_role;
grant execute on function public.create_order(text,text,jsonb,uuid,text) to anon,authenticated;

-- Legacy global membership APIs and table are no longer reachable.
revoke all on public.staff_members from public,anon,authenticated;
revoke all on function public.get_staff_access(),public.save_staff_member(uuid,text,boolean),public.delete_staff_member(uuid) from public,anon,authenticated;
drop function public.get_staff_access();
drop function public.save_staff_member(uuid,text,boolean);
drop function public.delete_staff_member(uuid);
-- Policies retain dependencies on the legacy role helpers. Remove them
-- explicitly before retiring those helpers; avoid CASCADE so unrelated
-- authorization objects can never be removed accidentally.
do $$
declare legacy_policy record;
begin
  for legacy_policy in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'staff_members'
  loop
    execute format('drop policy if exists %I on public.staff_members', legacy_policy.policyname);
  end loop;
end $$;
drop function if exists private.is_active_staff();
drop function if exists private.has_staff_role(text[]);
drop table public.staff_members;

grant select,insert,update,delete on public.shop_invitations to service_role;
grant select,insert,update,delete on public.shop_members to service_role;
