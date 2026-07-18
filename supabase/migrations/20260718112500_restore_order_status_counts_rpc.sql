-- Reassert the date-filtered order counters after reconciling a migration
-- version whose remote schema did not contain the expected RPC signature.
drop function if exists public.get_order_status_counts(uuid);
drop function if exists public.get_order_status_counts(
  uuid,
  timestamptz,
  timestamptz
);

create function public.get_order_status_counts(
  p_shop_id uuid,
  p_created_after timestamptz default null,
  p_created_before timestamptz default null
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'pending', coalesce(sum(case when o.status = 'pending' then 1 else 0 end), 0),
    'confirmed', coalesce(sum(case when o.status = 'confirmed' then 1 else 0 end), 0),
    'cancelled', coalesce(sum(case when o.status = 'cancelled' then 1 else 0 end), 0),
    'expired', coalesce(sum(case when o.status = 'expired' then 1 else 0 end), 0),
    'all', count(*)
  )
  from public.orders o
  where o.shop_id = p_shop_id
    and private.is_shop_member(p_shop_id)
    and (p_created_after is null or o.created_at >= p_created_after)
    and (p_created_before is null or o.created_at < p_created_before)
$$;

revoke all on function public.get_order_status_counts(
  uuid,
  timestamptz,
  timestamptz
) from public, anon, authenticated;
grant execute on function public.get_order_status_counts(
  uuid,
  timestamptz,
  timestamptz
) to authenticated;

notify pgrst, 'reload schema';
