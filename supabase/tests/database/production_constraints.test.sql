begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

select ok(
  (select convalidated from pg_constraint
   where conrelid = 'public.booth_settings'::regclass
     and conname = 'booth_settings_safe_public_urls'),
  'booth public URL constraint is validated'
);
select ok(
  (select convalidated from pg_constraint
   where conrelid = 'public.products'::regclass
     and conname = 'products_safe_public_images'),
  'product public image constraint is validated'
);
select ok(
  (select convalidated from pg_constraint
   where conrelid = 'public.payment_settings'::regclass
     and conname = 'payment_settings_safe_public_urls'),
  'payment public URL constraint is validated'
);
select ok(
  (select convalidated from pg_constraint
   where conrelid = 'public.offline_event_order_items'::regclass
     and conname = 'offline_event_order_items_discount_limit_check'),
  'offline order discount constraint is validated'
);
select ok(
  (select convalidated from pg_constraint
   where conrelid = 'public.offline_event_orders'::regclass
     and conname = 'offline_event_orders_payment_state_matrix_check'),
  'offline payment-state constraint is validated'
);
select ok(
  (select convalidated from pg_constraint
   where conrelid = 'public.push_subscriptions'::regclass
     and conname = 'push_subscriptions_endpoint_format_check'),
  'push endpoint constraint is validated'
);
select ok(
  (select convalidated from pg_constraint
   where conrelid = 'public.push_subscriptions'::regclass
     and conname = 'push_subscriptions_p256dh_length_check'),
  'push public-key constraint is validated'
);
select ok(
  (select convalidated from pg_constraint
   where conrelid = 'public.push_subscriptions'::regclass
     and conname = 'push_subscriptions_auth_length_check'),
  'push auth-key constraint is validated'
);
select ok(
  (select convalidated from pg_constraint
   where conrelid = 'public.push_subscriptions'::regclass
     and conname = 'push_subscriptions_user_agent_length_check'),
  'push user-agent constraint is validated'
);
select is(
  (
    select count(*)::integer
    from pg_constraint constraint_row
    join pg_class table_row on table_row.oid = constraint_row.conrelid
    join pg_namespace schema_row on schema_row.oid = table_row.relnamespace
    where schema_row.nspname = 'public'
      and not constraint_row.convalidated
  ),
  0,
  'public schema has no unvalidated constraints'
);
select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'offline_event_sessions'
      and indexname = 'offline_event_sessions_one_active_shop_idx'
      and indexdef like 'CREATE UNIQUE INDEX%WHERE (status = %active%'
  ),
  'offline events retain the one-active-session partial unique index'
);

select * from finish();
rollback;
