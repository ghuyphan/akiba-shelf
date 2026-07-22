-- Reissuing an invitation updates the pending contract instead of silently
-- retaining an older, potentially more privileged role.
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
  if p_role not in ('admin', 'staff') then raise exception 'Invalid invitation role'; end if;
  if normalized_email = '' or length(normalized_email) > 320 or p_expires_at <= now() then
    raise exception 'Invalid invitation details';
  end if;
  if not exists (select 1 from public.shops where id = p_shop_id and active)
    or not exists (
      select 1 from public.shop_members
      where shop_id = p_shop_id and user_id = p_actor_id
        and role = 'owner' and active
    ) then
    raise exception 'Active shop owner access required' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('shop-team-capacity:' || p_shop_id::text, 0)
  );

  update public.shop_invitations
  set status = 'revoked'
  where shop_id = p_shop_id and lower(email) = normalized_email
    and status = 'pending' and expires_at <= now();

  select id into existing_id
  from public.shop_invitations
  where shop_id = p_shop_id and lower(email) = normalized_email
    and status = 'pending' and expires_at > now()
  limit 1
  for update;

  if existing_id is not null then
    update public.shop_invitations
    set role = p_role,
        invited_by = p_actor_id,
        expires_at = p_expires_at
    where id = existing_id;
    return query select existing_id, false;
    return;
  end if;

  select
    (select count(*) from public.shop_members where shop_id = p_shop_id and active)
    +
    (select count(*) from public.shop_invitations
      where shop_id = p_shop_id and status = 'pending' and expires_at > now())
  into occupied_places;
  if occupied_places >= 10 then raise exception 'Shop team limit reached'; end if;

  insert into public.shop_invitations(shop_id, email, role, invited_by, expires_at)
  values (p_shop_id, normalized_email, p_role, p_actor_id, p_expires_at)
  returning id into existing_id;
  return query select existing_id, true;
end;
$$;

revoke all on function public.reserve_shop_invitation(uuid, text, text, uuid, timestamptz)
from public, anon, authenticated;
grant execute on function public.reserve_shop_invitation(uuid, text, text, uuid, timestamptz)
to service_role;
