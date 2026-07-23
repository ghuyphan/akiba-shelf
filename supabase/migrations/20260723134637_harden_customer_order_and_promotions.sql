create or replace function public.cancel_customer_order(
  p_order_id uuid,
  p_recovery_token text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.orders;
  safe_order jsonb;
begin
  if p_recovery_token is null
    or length(p_recovery_token) not between 32 and 160 then
    return jsonb_build_object('outcome', 'not_found', 'order', null);
  end if;

  select * into o
  from public.orders
  where id = p_order_id
  for update;

  if not found or o.recovery_token_hash is distinct from encode(
    extensions.digest(p_recovery_token, 'sha256'),
    'hex'
  ) then
    return jsonb_build_object('outcome', 'not_found', 'order', null);
  end if;

  safe_order := jsonb_build_object(
    'id', o.id,
    'order_code', o.order_code,
    'customer_name', o.customer_name,
    'total_amount', o.total_amount,
    'status', o.status,
    'created_at', o.created_at,
    'updated_at', o.updated_at,
    'expires_at', o.expires_at,
    'confirmed_at', o.confirmed_at,
    'cancelled_at', o.cancelled_at,
    'expired_at', o.expired_at
  );

  if o.status = 'cancelled' then
    return jsonb_build_object(
      'outcome', 'already_cancelled',
      'order', safe_order
    );
  end if;
  if o.status = 'confirmed' then
    return jsonb_build_object(
      'outcome', 'already_confirmed',
      'order', safe_order
    );
  end if;
  if o.status = 'expired' then
    return jsonb_build_object(
      'outcome', 'already_expired',
      'order', safe_order
    );
  end if;

  o := private.release_reservation(o.id, 'cancelled', null);
  safe_order := jsonb_build_object(
    'id', o.id,
    'order_code', o.order_code,
    'customer_name', o.customer_name,
    'total_amount', o.total_amount,
    'status', o.status,
    'created_at', o.created_at,
    'updated_at', o.updated_at,
    'expires_at', o.expires_at,
    'confirmed_at', o.confirmed_at,
    'cancelled_at', o.cancelled_at,
    'expired_at', o.expired_at
  );
  return jsonb_build_object(
    'outcome', 'cancelled',
    'order', safe_order
  );
end;
$$;

revoke all on function public.cancel_customer_order(uuid, text)
from public, anon, authenticated;
grant execute on function public.cancel_customer_order(uuid, text)
to anon, authenticated;

drop policy if exists "Public reads active shop promotions"
on public.promotions;
drop policy if exists "Authenticated users read visible shop promotions"
on public.promotions;

create policy "Public reads active shop promotions"
on public.promotions for select to anon
using (
  enabled
  and exists (
    select 1
    from public.shops shop
    where shop.id = promotions.shop_id
      and shop.active
  )
);

create policy "Authenticated users read visible shop promotions"
on public.promotions for select to authenticated
using (
  (
    enabled
    and exists (
      select 1
      from public.shops shop
      where shop.id = promotions.shop_id
        and shop.active
    )
  )
  or private.has_shop_role(shop_id, array['owner', 'admin'])
);

drop policy if exists "Public reads active promotion products"
on public.promotion_products;
drop policy if exists "Authenticated users read visible promotion products"
on public.promotion_products;

create policy "Public reads active promotion products"
on public.promotion_products for select to anon
using (
  exists (
    select 1
    from public.promotions promotion
    join public.shops shop on shop.id = promotion.shop_id
    where promotion.shop_id = promotion_products.shop_id
      and promotion.enabled
      and shop.active
  )
);

create policy "Authenticated users read visible promotion products"
on public.promotion_products for select to authenticated
using (
  exists (
    select 1
    from public.promotions promotion
    join public.shops shop on shop.id = promotion.shop_id
    where promotion.shop_id = promotion_products.shop_id
      and promotion.enabled
      and shop.active
  )
  or private.has_shop_role(shop_id, array['owner', 'admin'])
);

create index if not exists order_notification_requeue_actions_order_id_idx
on public.order_notification_requeue_actions(order_id);

create index if not exists order_notification_requeue_actions_actor_user_id_idx
on public.order_notification_requeue_actions(actor_user_id);

create index if not exists offline_event_finalization_receipts_order_id_idx
on public.offline_event_finalization_receipts(order_id);

-- Keep future Data API exposure and privileged RPC execution explicit.
alter default privileges for role postgres in schema public
revoke select, insert, update, delete on tables
from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
revoke usage, select on sequences
from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
revoke execute on functions from public, anon, authenticated, service_role;

notify pgrst, 'reload schema';
