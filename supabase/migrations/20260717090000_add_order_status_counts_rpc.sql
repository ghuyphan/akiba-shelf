-- Replace the order queue's four separate count queries with one read-only RPC.
-- Authorization mirrors the member-safe projection pattern from
-- 20260713140000_production_hardening.sql: a security-definer function that
-- self-enforces shop membership, with EXECUTE revoked from everyone else.
-- Order visibility matches the "Shop staff read orders" policy, so any active
-- shop member (owner, admin, or staff) may read the counters.
create or replace function public.get_order_status_counts(p_shop_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'pending',coalesce(sum(case when o.status='pending' then 1 else 0 end),0),
    'confirmed',coalesce(sum(case when o.status='confirmed' then 1 else 0 end),0),
    'cancelled',coalesce(sum(case when o.status='cancelled' then 1 else 0 end),0),
    'expired',coalesce(sum(case when o.status='expired' then 1 else 0 end),0),
    'all',count(*)
  )
  from public.orders o
  where o.shop_id=p_shop_id and private.is_shop_member(p_shop_id)
$$;
revoke all on function public.get_order_status_counts(uuid) from public,anon,authenticated;
grant execute on function public.get_order_status_counts(uuid) to authenticated;
