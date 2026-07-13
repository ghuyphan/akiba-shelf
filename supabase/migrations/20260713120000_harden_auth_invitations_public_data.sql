-- Account, tenant and invitation hardening. Slugs are immutable after creation.
alter table public.shop_invitations drop constraint if exists shop_invitations_role_check;
alter table public.shop_invitations add constraint shop_invitations_role_check check (role in ('admin','staff'));
create index if not exists shop_invitations_owner_recent_idx on public.shop_invitations(invited_by,created_at desc);

drop function if exists public.get_my_shop_memberships();
create function public.get_my_shop_memberships()
returns table(shop_id uuid,shop_name text,shop_slug text,role text,active boolean,shop_active boolean)
language sql stable security definer set search_path='' as $$
 select s.id,s.name,s.slug,m.role,m.active,s.active from public.shop_members m join public.shops s on s.id=m.shop_id
 where m.user_id=(select auth.uid()) order by s.active desc,m.active desc,s.name
$$;
revoke all on function public.get_my_shop_memberships() from public,anon,authenticated;
grant execute on function public.get_my_shop_memberships() to authenticated;

create or replace function public.update_shop_details(p_shop_id uuid,p_name text)
returns table(id uuid,name text,slug text,active boolean)
language plpgsql security definer set search_path='' as $$ begin
 if not private.has_shop_role(p_shop_id,array['owner']) then raise exception 'Active shop owner access required' using errcode='42501'; end if;
 if length(btrim(coalesce(p_name,''))) not between 1 and 100 then raise exception 'Shop name must contain between 1 and 100 characters'; end if;
 return query update public.shops s set name=btrim(p_name) where s.id=p_shop_id returning s.id,s.name,s.slug,s.active;
end $$;

create or replace function public.grant_existing_shop_member(p_shop_id uuid,p_email text,p_role text)
returns uuid language plpgsql security definer set search_path='' as $$ declare target uuid; begin
 if not private.has_shop_role(p_shop_id,array['owner']) then raise exception 'Active shop owner access required' using errcode='42501'; end if;
 if p_role not in ('admin','staff') then raise exception 'Invalid invitation role'; end if;
 select id into target from auth.users where lower(email)=lower(btrim(p_email)) limit 1;
 if target is null then return null; end if;
 insert into public.shop_members(shop_id,user_id,role,active) values(p_shop_id,target,p_role,true)
 on conflict(shop_id,user_id) do update set role=excluded.role,active=true;
 insert into public.shop_invitations(shop_id,email,role,invited_by,status,expires_at)
 values(p_shop_id,lower(btrim(p_email)),p_role,auth.uid(),'accepted',now());
 return target;
end $$;

create or replace function public.accept_shop_invitation()
returns uuid language plpgsql security definer set search_path='' as $$ declare inv public.shop_invitations;mail text; begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 mail:=lower(coalesce(auth.jwt()->>'email',''));
 select * into inv from public.shop_invitations where lower(email)=mail and status='pending' and expires_at>now() order by created_at for update skip locked limit 1;
 if not found then raise exception 'No usable invitation was found'; end if;
 insert into public.shop_members(shop_id,user_id,role,active) values(inv.shop_id,auth.uid(),inv.role,true)
 on conflict(shop_id,user_id) do update set role=excluded.role,active=true;
 update public.shop_invitations set status='accepted' where id=inv.id and status='pending';
 if not found then raise exception 'Invitation has already been used'; end if;
 return inv.shop_id;
end $$;

-- Auth users must be confirmed and may create at most five shops, no faster than once per minute.
create or replace function public.create_shop(p_name text,p_slug text default null)
returns public.shops language plpgsql security definer set search_path='' as $$ declare s public.shops;base_slug text;candidate text;suffix int:=2;tail text; begin
 if auth.uid() is null or not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null) then raise exception 'A confirmed account is required' using errcode='42501'; end if;
 if (select count(*) from public.shops where created_by=auth.uid())>=5 then raise exception 'Shop creation limit reached'; end if;
 if exists(select 1 from public.shops where created_by=auth.uid() and created_at>now()-interval '1 minute') then raise exception 'Please wait before creating another shop'; end if;
 if length(btrim(coalesce(p_name,''))) not between 1 and 100 then raise exception 'Shop name must contain between 1 and 100 characters'; end if;
 base_slug:=trim(both '-' from regexp_replace(lower(btrim(coalesce(nullif(p_slug,''),p_name))),'[^a-z0-9]+','-','g'));if base_slug='' then base_slug:='shop';end if;base_slug:=left(base_slug,63);if length(base_slug)<2 then base_slug:=base_slug||'-shop';end if;
 perform pg_advisory_xact_lock(hashtextextended('shop-slug:'||base_slug,0));candidate:=base_slug;
 while exists(select 1 from public.shops where slug=candidate) loop tail:='-'||suffix;candidate:=left(base_slug,63-length(tail))||tail;suffix:=suffix+1;end loop;
 insert into public.shops(name,slug,created_by) values(btrim(p_name),candidate,auth.uid()) returning * into s;
 insert into public.shop_members(shop_id,user_id,role) values(s.id,auth.uid(),'owner');insert into public.booth_settings(id,shop_id,booth_name) values(s.id::text,s.id,btrim(p_name));insert into public.payment_settings(id,shop_id) values(s.id::text,s.id);return s;
end $$;

drop policy if exists "Owners update shops" on public.shops;
drop policy if exists "Public reads active shop products" on public.products;
create policy "Public reads products from active shops" on public.products for select to anon,authenticated using((active and exists(select 1 from public.shops s where s.id=shop_id and s.active)) or private.is_shop_member(shop_id));
revoke update,insert,delete on public.shops from anon,authenticated;
revoke select on public.shops,public.products,public.booth_settings from anon;
grant select(id,name,slug,active,updated_at) on public.shops to anon;
grant select(id,shop_id,name,collection,description,price_vnd,item_code,quantity_available,category,badge,badge_color,stock_status,stock_note,images,featured,sort_order,active) on public.products to anon;
grant select(id,shop_id,booth_name,subtitle,booth_code,location,open_hours,logo_url,instagram_url,facebook_url,tiktok_url,social_qr_logo_url,theme_primary,theme_secondary,theme_accent,theme_background,layout_order,corner_radius,catalog_locale,featured_autoplay) on public.booth_settings to anon;

revoke all on function public.update_shop_details(uuid,text),public.grant_existing_shop_member(uuid,text,text),public.accept_shop_invitation() from public,anon,authenticated;
grant execute on function public.update_shop_details(uuid,text),public.grant_existing_shop_member(uuid,text,text),public.accept_shop_invitation() to authenticated;
