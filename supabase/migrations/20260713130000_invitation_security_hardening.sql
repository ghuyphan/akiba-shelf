-- Keep browser clients away from Auth UUID lookup and bind invite acceptance to one invitation.
drop function if exists public.grant_existing_shop_member(uuid,text,text);
drop function if exists public.accept_shop_invitation();

create or replace function public.resolve_invitation_user(p_email text)
returns table(user_id uuid,email_confirmed boolean)
language sql security definer set search_path='' as $$
  select u.id, u.email_confirmed_at is not null
  from auth.users u
  where lower(u.email)=lower(btrim(p_email))
  limit 1
$$;
revoke all on function public.resolve_invitation_user(text) from public,anon,authenticated;
grant execute on function public.resolve_invitation_user(text) to service_role;

with duplicates as (
  select id,row_number() over(partition by shop_id,lower(email) order by created_at desc,id desc) as position
  from public.shop_invitations where status='pending'
)
update public.shop_invitations i set status='revoked' from duplicates d where i.id=d.id and d.position>1;
create unique index if not exists shop_invitations_one_pending_email_idx
on public.shop_invitations(shop_id,lower(email)) where status='pending';

create or replace function public.accept_shop_invitation(p_invitation_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare inv public.shop_invitations; mail text; existing_role text;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  mail:=lower(coalesce(auth.jwt()->>'email',''));
  if mail='' then raise exception 'Authenticated email required' using errcode='42501'; end if;

  select i.* into inv
  from public.shop_invitations i join public.shops s on s.id=i.shop_id
  where i.id=p_invitation_id and lower(i.email)=mail and i.status='pending'
    and i.expires_at>now() and s.active and i.role in ('admin','staff')
  for update of i;
  if not found then raise exception 'This invitation is invalid, expired, revoked, or belongs to another account'; end if;

  select role into existing_role from public.shop_members
  where shop_id=inv.shop_id and user_id=auth.uid() for update;
  if existing_role='owner' then
    update public.shop_invitations set status='accepted' where id=inv.id and status='pending';
  else
    insert into public.shop_members(shop_id,user_id,role,active)
    values(inv.shop_id,auth.uid(),inv.role,true)
    on conflict(shop_id,user_id) do update set role=excluded.role,active=true;
    update public.shop_invitations set status='accepted' where id=inv.id and status='pending';
  end if;
  if not found then raise exception 'Invitation has already been used'; end if;
  return inv.shop_id;
end $$;
revoke all on function public.accept_shop_invitation(uuid) from public,anon,authenticated;
grant execute on function public.accept_shop_invitation(uuid) to authenticated;

-- An authenticated stranger receives only the same active-shop projection as an anonymous visitor.
revoke select on public.shops from authenticated;
grant select(id,name,slug,active,updated_at) on public.shops to authenticated;

create or replace function private.is_shop_member(p_shop_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.shop_members m join public.shops s on s.id=m.shop_id
  where m.shop_id=p_shop_id and m.user_id=(select auth.uid()) and m.active and s.active)
$$;
create or replace function private.has_shop_role(p_shop_id uuid,p_roles text[])
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.shop_members m join public.shops s on s.id=m.shop_id
  where m.shop_id=p_shop_id and m.user_id=(select auth.uid()) and m.active and s.active and m.role=any(p_roles))
$$;

grant select(id,shop_id,name,collection,description,price_vnd,item_code,quantity_available,category,badge,badge_color,stock_status,stock_note,images,image_variants,featured,sort_order,active)
on public.products to anon;

-- Payment fields below are intentionally public because checkout needs them. No credentials or secrets live here.
revoke select on public.payment_settings from anon;
grant select(id,shop_id,momo_qr_url,bank_qr_url,momo_label,bank_label,bank_code,bank_acq_id,bank_account_no,bank_account_name,bank_add_info_template,payment_instructions)
on public.payment_settings to anon;

create or replace function private.is_safe_public_url(value text)
returns boolean language sql immutable set search_path='' as $$
  select value is null or btrim(value)='' or value ~ '^https://[^[:space:]]+$' or value ~ '^/[^/][^[:space:]]*$'
$$;
create or replace function private.are_safe_public_urls(p_values text[])
returns boolean language sql immutable set search_path='' as $$
  select coalesce(bool_and(private.is_safe_public_url(value)),true) from unnest(p_values) value
$$;
alter table public.booth_settings drop constraint if exists booth_settings_safe_public_urls;
alter table public.booth_settings add constraint booth_settings_safe_public_urls check (
  private.is_safe_public_url(logo_url) and private.is_safe_public_url(instagram_url)
  and private.is_safe_public_url(facebook_url) and private.is_safe_public_url(tiktok_url)
  and private.is_safe_public_url(social_qr_logo_url)
) not valid;
alter table public.products drop constraint if exists products_safe_public_images;
alter table public.products add constraint products_safe_public_images check (private.are_safe_public_urls(images)) not valid;
alter table public.payment_settings drop constraint if exists payment_settings_safe_public_urls;
alter table public.payment_settings add constraint payment_settings_safe_public_urls check (
  private.is_safe_public_url(momo_qr_url) and private.is_safe_public_url(bank_qr_url)
) not valid;
