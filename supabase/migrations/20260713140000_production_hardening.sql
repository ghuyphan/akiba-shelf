-- Production hardening for invitations, tenant-safe projections, and shop creation.

-- Serialize all create_shop requests for one user before checking limits/cooldowns.
create or replace function public.create_shop(p_name text,p_slug text default null)
returns public.shops language plpgsql security definer set search_path='' as $$
declare s public.shops;base_slug text;candidate text;suffix int:=2;tail text;
begin
 if auth.uid() is null or not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null) then raise exception 'A confirmed account is required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('create-shop-user:'||auth.uid()::text,0));
 if (select count(*) from public.shops where created_by=auth.uid())>=5 then raise exception 'Shop creation limit reached'; end if;
 if exists(select 1 from public.shops where created_by=auth.uid() and created_at>now()-interval '1 minute') then raise exception 'Please wait before creating another shop'; end if;
 if length(btrim(coalesce(p_name,''))) not between 1 and 100 then raise exception 'Shop name must contain between 1 and 100 characters'; end if;
 base_slug:=trim(both '-' from regexp_replace(lower(btrim(coalesce(nullif(p_slug,''),p_name))),'[^a-z0-9]+','-','g'));if base_slug='' then base_slug:='shop';end if;base_slug:=left(base_slug,63);if length(base_slug)<2 then base_slug:=base_slug||'-shop';end if;
 perform pg_advisory_xact_lock(hashtextextended('shop-slug:'||base_slug,0));candidate:=base_slug;
 while exists(select 1 from public.shops where slug=candidate) loop tail:='-'||suffix;candidate:=left(base_slug,63-length(tail))||tail;suffix:=suffix+1;end loop;
 insert into public.shops(name,slug,created_by) values(btrim(p_name),candidate,auth.uid()) returning * into s;
 insert into public.shop_members(shop_id,user_id,role) values(s.id,auth.uid(),'owner');
 insert into public.booth_settings(id,shop_id,booth_name) values(s.id::text,s.id,btrim(p_name));
 insert into public.payment_settings(id,shop_id) values(s.id::text,s.id);
 return s;
end $$;

-- Service-only mutation for confirmed accounts. Option A: inactive non-owners
-- retain their previous role when intentionally reactivated.
create or replace function public.process_existing_shop_member(
  p_shop_id uuid,p_user_id uuid,p_requested_role text,p_actor_id uuid
) returns text language plpgsql security definer set search_path='' as $$
declare current_member public.shop_members;
begin
  if p_requested_role not in ('admin','staff') then raise exception 'Invalid invitation role'; end if;
  if not exists(select 1 from public.shops where id=p_shop_id and active) then raise exception 'Active shop required' using errcode='42501'; end if;
  if not exists(select 1 from public.shop_members where shop_id=p_shop_id and user_id=p_actor_id and role='owner' and active) then raise exception 'Active shop owner access required' using errcode='42501'; end if;
  select * into current_member from public.shop_members where shop_id=p_shop_id and user_id=p_user_id for update;
  if found then
    if current_member.role='owner' then return 'existing_owner'; end if;
    if current_member.active then return 'existing_member'; end if;
    update public.shop_members set active=true where shop_id=p_shop_id and user_id=p_user_id;
    return 'reactivated_previous_role';
  end if;
  insert into public.shop_members(shop_id,user_id,role,active) values(p_shop_id,p_user_id,p_requested_role,true);
  return 'membership_granted';
end $$;
revoke all on function public.process_existing_shop_member(uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.process_existing_shop_member(uuid,uuid,text,uuid) to service_role;

-- Retry-safe and idempotent invitation acceptance. Existing inactive non-owner
-- memberships are reactivated with their previous role (Option A).
create or replace function public.accept_shop_invitation(p_invitation_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare inv public.shop_invitations; mail text; existing_member public.shop_members;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  mail:=lower(coalesce(auth.jwt()->>'email',''));
  if mail='' then raise exception 'Authenticated email required' using errcode='42501'; end if;
  select i.* into inv from public.shop_invitations i join public.shops s on s.id=i.shop_id
  where i.id=p_invitation_id and lower(i.email)=mail and i.status in ('pending','accepted') and s.active and i.role in ('admin','staff')
  for update of i;
  if not found or (inv.status='pending' and inv.expires_at<=now()) then raise exception 'This invitation is invalid, expired, revoked, or belongs to another account'; end if;
  select * into existing_member from public.shop_members where shop_id=inv.shop_id and user_id=auth.uid() for update;
  if inv.status='accepted' then
    if not found or not existing_member.active then raise exception 'This invitation is no longer usable'; end if;
    return inv.shop_id;
  end if;
  if found then
    if existing_member.role<>'owner' and not existing_member.active then update public.shop_members set active=true where shop_id=inv.shop_id and user_id=auth.uid(); end if;
  else
    insert into public.shop_members(shop_id,user_id,role,active) values(inv.shop_id,auth.uid(),inv.role,true);
  end if;
  update public.shop_invitations set status='accepted' where id=inv.id and status='pending';
  if not found then raise exception 'Invitation has already been used'; end if;
  return inv.shop_id;
end $$;
revoke all on function public.accept_shop_invitation(uuid) from public,anon,authenticated;
grant execute on function public.accept_shop_invitation(uuid) to authenticated;

-- Member-safe workspace identity avoids loading editing/storage data for staff.
create or replace function public.get_shop_workspace_summary(p_shop_id uuid)
returns table(shop_id uuid,shop_name text,shop_slug text,booth_name text,logo_url text,theme_background text)
language sql stable security definer set search_path='' as $$
 select s.id,s.name,s.slug,b.booth_name,b.logo_url,b.theme_background
 from public.shops s left join public.booth_settings b on b.shop_id=s.id
 where s.id=p_shop_id and s.active and private.is_shop_member(s.id)
$$;
revoke all on function public.get_shop_workspace_summary(uuid) from public,anon,authenticated;
grant execute on function public.get_shop_workspace_summary(uuid) to authenticated;

-- Admin-only projections retain editing support without granting private columns
-- to every authenticated account through PostgREST.
create or replace function public.get_admin_products(p_shop_id uuid)
returns setof public.products language sql stable security definer set search_path='' as $$
 select p.* from public.products p where p.shop_id=p_shop_id and private.has_shop_role(p_shop_id,array['owner','admin']) order by p.sort_order
$$;
create or replace function public.get_admin_booth_settings(p_shop_id uuid)
returns setof public.booth_settings language sql stable security definer set search_path='' as $$
 select b.* from public.booth_settings b where b.shop_id=p_shop_id and private.has_shop_role(p_shop_id,array['owner','admin'])
$$;
revoke all on function public.get_admin_products(uuid),public.get_admin_booth_settings(uuid) from public,anon,authenticated;
grant execute on function public.get_admin_products(uuid),public.get_admin_booth_settings(uuid) to authenticated;

-- Remove accumulated table-level SELECT and explicitly grant public-safe fields.
revoke select on public.products,public.booth_settings,public.payment_settings from anon,authenticated;
grant select(id,shop_id,name,collection,description,price_vnd,item_code,quantity_available,category,badge,badge_color,stock_status,stock_note,images,image_variants,featured,sort_order,active)
on public.products to anon,authenticated;
grant select(id,shop_id,booth_name,subtitle,booth_code,location,open_hours,logo_url,instagram_url,facebook_url,tiktok_url,social_qr_logo_url,theme_primary,theme_secondary,theme_accent,theme_background,layout_order,corner_radius,catalog_locale,featured_autoplay)
on public.booth_settings to anon,authenticated;
-- These are the complete customer-facing payment fields. Future columns receive no access automatically.
grant select(id,shop_id,momo_qr_url,bank_qr_url,momo_label,bank_label,bank_code,bank_acq_id,bank_account_no,bank_account_name,bank_add_info_template,payment_instructions)
on public.payment_settings to anon,authenticated;

-- Internal invitation lookup is never browser executable.
revoke all on function public.resolve_invitation_user(text) from public,anon,authenticated;
grant execute on function public.resolve_invitation_user(text) to service_role;
