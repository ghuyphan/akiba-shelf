-- Expiry is an internal maintenance operation. Authorization is enforced by
-- EXECUTE privileges, not by current_user inside a SECURITY DEFINER function.
create or replace function public.expire_pending_orders(batch_size integer default 100)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  oid uuid;
  affected uuid[] := '{}';
  o public.orders;
begin
  for oid in
    select id
    from public.orders
    where status = 'pending' and expires_at <= now()
    order by expires_at, id
    for update skip locked
    limit greatest(1, least(batch_size, 500))
  loop
    o := private.release_reservation(oid, 'expired');
    affected := array_append(affected, oid);
  end loop;
  return jsonb_build_object('expired_count', cardinality(affected), 'order_ids', to_jsonb(affected));
end
$$;

revoke all on function public.expire_pending_orders(integer) from public, anon, authenticated;
grant execute on function public.expire_pending_orders(integer) to service_role;

-- Serialize owner membership changes so two transactions cannot each observe
-- another owner and concurrently remove the final two active owners.
create or replace function public.save_staff_member(p_user_id uuid, p_role text, p_active boolean)
returns public.staff_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.staff_members;
begin
  if not private.has_staff_role(array['owner']::text[]) then
    raise exception 'Owner membership required' using errcode = '42501';
  end if;
  if p_role not in ('owner', 'admin', 'staff') then raise exception 'Invalid staff role'; end if;
  if not exists (select 1 from auth.users where id = p_user_id) then raise exception 'Auth user not found'; end if;

  perform pg_advisory_xact_lock(hashtextextended('public.staff_members.active_owner', 0));
  if exists (select 1 from public.staff_members where user_id = p_user_id and role = 'owner' and active)
    and (p_role <> 'owner' or not p_active)
    and (select count(*) from public.staff_members where role = 'owner' and active) <= 1
  then
    raise exception 'The last active owner cannot be disabled or demoted';
  end if;

  insert into public.staff_members(user_id, role, active) values (p_user_id, p_role, p_active)
  on conflict (user_id) do update set role = excluded.role, active = excluded.active
  returning * into result;
  return result;
end
$$;

create or replace function public.delete_staff_member(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_staff_role(array['owner']::text[]) then
    raise exception 'Owner membership required' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('public.staff_members.active_owner', 0));
  if exists (select 1 from public.staff_members where user_id = p_user_id and role = 'owner' and active)
    and (select count(*) from public.staff_members where role = 'owner' and active) <= 1
  then
    raise exception 'The last active owner cannot be removed';
  end if;
  delete from public.staff_members where user_id = p_user_id;
end
$$;

revoke all on function public.save_staff_member(uuid, text, boolean), public.delete_staff_member(uuid) from public, anon, authenticated;
grant execute on function public.save_staff_member(uuid, text, boolean), public.delete_staff_member(uuid) to authenticated;
