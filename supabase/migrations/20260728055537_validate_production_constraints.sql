-- Complete the deferred validation phase after the hardening migrations have
-- protected all new writes. Invalid historical rows make this migration fail
-- with the specific constraint name instead of remaining silently tolerated.
alter table public.booth_settings
  validate constraint booth_settings_safe_public_urls;
alter table public.products
  validate constraint products_safe_public_images;
alter table public.payment_settings
  validate constraint payment_settings_safe_public_urls;
alter table public.offline_event_order_items
  validate constraint offline_event_order_items_discount_limit_check;
alter table public.offline_event_orders
  validate constraint offline_event_orders_payment_state_matrix_check;
alter table public.push_subscriptions
  validate constraint push_subscriptions_endpoint_format_check;
alter table public.push_subscriptions
  validate constraint push_subscriptions_p256dh_length_check;
alter table public.push_subscriptions
  validate constraint push_subscriptions_auth_length_check;
alter table public.push_subscriptions
  validate constraint push_subscriptions_user_agent_length_check;

-- The initial Offline Event migration already creates this partial unique
-- index. Repeat the invariant defensively for drifted environments, with a
-- clear diagnostic before index creation if historical duplicates exist.
do $$
begin
  if exists (
    select 1
    from public.offline_event_sessions
    where status = 'active'
    group by shop_id
    having count(*) > 1
  ) then
    raise exception
      'Cannot enforce one active offline event per shop: duplicate active sessions exist';
  end if;
end;
$$;

create unique index if not exists offline_event_sessions_one_active_shop_idx
  on public.offline_event_sessions(shop_id)
  where status = 'active';
