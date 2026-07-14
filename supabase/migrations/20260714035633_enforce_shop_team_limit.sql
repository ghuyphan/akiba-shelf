-- Keep each shop to ten occupied team places. Active members and unexpired
-- pending invitations each occupy one place. All capacity-changing paths use
-- the same per-shop transaction lock so concurrent requests cannot overbook.

create or replace function public.reserve_shop_invitation(
  p_shop_id uuid,
  p_email text,
  p_role text,
  p_actor_id uuid,
  p_expires_at timestamptz
)
returns table(invitation_id uuid, created_new boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_email text := lower(btrim(coalesce(p_email, '')));
  existing_id uuid;
  occupied_places integer;
begin
  if p_role not in ('admin', 'staff') then
    raise exception 'Invalid invitation role';
  end if;
  if normalized_email = '' or p_expires_at <= now() then
    raise exception 'Invalid invitation details';
  end if;
  if not exists (
    select 1 from public.shops where id = p_shop_id and active
  ) or not exists (
    select 1
    from public.shop_members
    where shop_id = p_shop_id
      and user_id = p_actor_id
      and role = 'owner'
      and active
  ) then
    raise exception 'Active shop owner access required' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('shop-team-capacity:' || p_shop_id::text, 0)
  );

  update public.shop_invitations
  set status = 'revoked'
  where shop_id = p_shop_id
    and lower(email) = normalized_email
    and status = 'pending'
    and expires_at <= now();

  select id into existing_id
  from public.shop_invitations
  where shop_id = p_shop_id
    and lower(email) = normalized_email
    and status = 'pending'
    and expires_at > now()
  limit 1;

  if existing_id is not null then
    return query select existing_id, false;
    return;
  end if;

  select
    (select count(*) from public.shop_members where shop_id = p_shop_id and active)
    +
    (select count(*) from public.shop_invitations
      where shop_id = p_shop_id and status = 'pending' and expires_at > now())
  into occupied_places;

  if occupied_places >= 10 then
    raise exception 'Shop team limit reached';
  end if;

  insert into public.shop_invitations(
    shop_id, email, role, invited_by, expires_at
  ) values (
    p_shop_id, normalized_email, p_role, p_actor_id, p_expires_at
  ) returning id into existing_id;

  return query select existing_id, true;
end
$$;

revoke all on function public.reserve_shop_invitation(uuid,text,text,uuid,timestamptz)
from public, anon, authenticated;
grant execute on function public.reserve_shop_invitation(uuid,text,text,uuid,timestamptz)
to service_role;

create or replace function public.process_existing_shop_member(
  p_shop_id uuid,
  p_user_id uuid,
  p_requested_role text,
  p_actor_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_member public.shop_members;
  target_email text;
  occupied_places integer;
  outcome text;
begin
  if p_requested_role not in ('admin', 'staff') then
    raise exception 'Invalid invitation role';
  end if;
  if not exists (select 1 from public.shops where id = p_shop_id and active) then
    raise exception 'Active shop required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.shop_members
    where shop_id = p_shop_id
      and user_id = p_actor_id
      and role = 'owner'
      and active
  ) then
    raise exception 'Active shop owner access required' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('shop-team-capacity:' || p_shop_id::text, 0)
  );
  select lower(email) into target_email from auth.users where id = p_user_id;
  if target_email is null then raise exception 'Account not found'; end if;

  select * into current_member
  from public.shop_members
  where shop_id = p_shop_id and user_id = p_user_id
  for update;

  if found and current_member.active then
    outcome := case when current_member.role = 'owner' then 'existing_owner' else 'existing_member' end;
  else
    select
      (select count(*) from public.shop_members where shop_id = p_shop_id and active)
      +
      (select count(*) from public.shop_invitations
        where shop_id = p_shop_id
          and status = 'pending'
          and expires_at > now()
          and lower(email) <> target_email)
    into occupied_places;

    if occupied_places >= 10 then raise exception 'Shop team limit reached'; end if;

    if current_member.user_id is not null then
      update public.shop_members
      set active = true
      where shop_id = p_shop_id and user_id = p_user_id;
      outcome := 'reactivated_previous_role';
    else
      insert into public.shop_members(shop_id,user_id,role,active)
      values(p_shop_id,p_user_id,p_requested_role,true);
      outcome := 'membership_granted';
    end if;
  end if;

  update public.shop_invitations
  set status = 'accepted'
  where shop_id = p_shop_id
    and lower(email) = target_email
    and status = 'pending';
  return outcome;
end
$$;

revoke all on function public.process_existing_shop_member(uuid,uuid,text,uuid)
from public, anon, authenticated;
grant execute on function public.process_existing_shop_member(uuid,uuid,text,uuid)
to service_role;

create or replace function public.save_shop_member(
  p_shop_id uuid,
  p_user_id uuid,
  p_role text,
  p_active boolean
)
returns public.shop_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.shop_members;
  current_member public.shop_members;
  target_email text;
  occupied_places integer;
begin
  if not private.has_shop_role(p_shop_id,array['owner']) then
    raise exception 'Shop owner access required' using errcode='42501';
  end if;
  if p_role not in ('owner','admin','staff') then raise exception 'Invalid staff role'; end if;

  perform pg_advisory_xact_lock(hashtextextended('shop-owner:' || p_shop_id::text, 0));
  perform pg_advisory_xact_lock(hashtextextended('shop-team-capacity:' || p_shop_id::text, 0));
  select * into current_member from public.shop_members
  where shop_id = p_shop_id and user_id = p_user_id for update;

  if current_member.role = 'owner' and current_member.active
    and (p_role <> 'owner' or not p_active)
    and (select count(*) from public.shop_members where shop_id=p_shop_id and role='owner' and active) <= 1
  then
    raise exception 'A shop must keep at least one active owner';
  end if;

  if p_active and not coalesce(current_member.active, false) then
    select lower(email) into target_email from auth.users where id = p_user_id;
    select
      (select count(*) from public.shop_members where shop_id = p_shop_id and active)
      +
      (select count(*) from public.shop_invitations
        where shop_id = p_shop_id
          and status = 'pending'
          and expires_at > now()
          and (target_email is null or lower(email) <> target_email))
    into occupied_places;
    if occupied_places >= 10 then raise exception 'Shop team limit reached'; end if;
  end if;

  insert into public.shop_members(shop_id,user_id,role,active)
  values(p_shop_id,p_user_id,p_role,p_active)
  on conflict(shop_id,user_id) do update
  set role=excluded.role,active=excluded.active
  returning * into result;

  if p_active and target_email is not null then
    update public.shop_invitations set status = 'accepted'
    where shop_id = p_shop_id and lower(email) = target_email and status = 'pending';
  end if;
  return result;
end
$$;

create or replace function public.accept_shop_invitation(p_invitation_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.shop_invitations;
  mail text;
  existing_member public.shop_members;
  occupied_places integer;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  mail := lower(coalesce(auth.jwt()->>'email',''));
  if mail = '' then raise exception 'Authenticated email required' using errcode='42501'; end if;

  select i.* into inv
  from public.shop_invitations i
  join public.shops s on s.id = i.shop_id
  where i.id = p_invitation_id
    and lower(i.email) = mail
    and i.status in ('pending','accepted')
    and s.active
    and i.role in ('admin','staff')
  for update of i;
  if not found or (inv.status = 'pending' and inv.expires_at <= now()) then
    raise exception 'This invitation is invalid, expired, revoked, or belongs to another account';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('shop-team-capacity:' || inv.shop_id::text, 0)
  );
  select * into existing_member
  from public.shop_members
  where shop_id = inv.shop_id and user_id = auth.uid()
  for update;

  if inv.status = 'accepted' then
    if not found or not existing_member.active then raise exception 'This invitation is no longer usable'; end if;
    return inv.shop_id;
  end if;

  if not found or not existing_member.active then
    select
      (select count(*) from public.shop_members where shop_id = inv.shop_id and active)
      +
      (select count(*) from public.shop_invitations
        where shop_id = inv.shop_id
          and status = 'pending'
          and expires_at > now()
          and id <> inv.id)
    into occupied_places;
    if occupied_places >= 10 then raise exception 'Shop team limit reached'; end if;
  end if;

  if existing_member.user_id is not null then
    if existing_member.role <> 'owner' and not existing_member.active then
      update public.shop_members set active = true
      where shop_id = inv.shop_id and user_id = auth.uid();
    end if;
  else
    insert into public.shop_members(shop_id,user_id,role,active)
    values(inv.shop_id,auth.uid(),inv.role,true);
  end if;

  update public.shop_invitations set status = 'accepted'
  where id = inv.id and status = 'pending';
  if not found then raise exception 'Invitation has already been used'; end if;
  return inv.shop_id;
end
$$;

revoke all on function public.accept_shop_invitation(uuid)
from public, anon, authenticated;
grant execute on function public.accept_shop_invitation(uuid) to authenticated;
