-- Automated payment verification and webhook confirmation system ----------------

create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  provider text not null check (provider in ('payos', 'sepay', 'custom_webhook')),
  transaction_reference text not null check (length(transaction_reference) between 1 and 128),
  account_number text check (length(coalesce(account_number, '')) <= 64),
  amount integer not null check (amount > 0),
  description text check (length(coalesce(description, '')) <= 500),
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint payment_transactions_shop_provider_ref_key
    unique (shop_id, provider, transaction_reference)
);

create index if not exists payment_transactions_order_id_idx
  on public.payment_transactions(order_id);
create index if not exists payment_transactions_shop_created_idx
  on public.payment_transactions(shop_id, created_at desc);

alter table public.payment_transactions enable row level security;
revoke all on public.payment_transactions from public, anon, authenticated;
grant select on public.payment_transactions to authenticated;
grant select, insert on public.payment_transactions to service_role;

create policy "Members read payment transactions"
  on public.payment_transactions for select to authenticated
  using ((select private.is_shop_member(shop_id)));

-- Add webhook and auto-confirmation settings to payment_settings
alter table public.payment_settings
  add column if not exists auto_confirm_enabled boolean not null default false,
  add column if not exists webhook_secret text check (length(coalesce(webhook_secret, '')) <= 128),
  add column if not exists payos_client_id text check (length(coalesce(payos_client_id, '')) <= 128),
  add column if not exists payos_api_key text check (length(coalesce(payos_api_key, '')) <= 128),
  add column if not exists payos_checksum_key text check (length(coalesce(payos_checksum_key, '')) <= 128);

grant select(auto_confirm_enabled, webhook_secret, payos_client_id, payos_api_key, payos_checksum_key),
      update(auto_confirm_enabled, webhook_secret, payos_client_id, payos_api_key, payos_checksum_key),
      insert(auto_confirm_enabled, webhook_secret, payos_client_id, payos_api_key, payos_checksum_key)
  on public.payment_settings to authenticated;
grant select, insert, update on public.payment_settings to service_role;

-- Server-authoritative webhook confirmation RPC
create or replace function public.confirm_order_by_webhook(
  p_shop_id uuid,
  p_order_code text,
  p_amount integer,
  p_provider text,
  p_transaction_ref text,
  p_account_number text default null,
  p_description text default null,
  p_raw_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_row public.orders;
  settings_row public.payment_settings;
  norm_code text;
begin
  -- Validate shop exists and auto-confirmation is enabled
  select * into settings_row
  from public.payment_settings
  where shop_id = p_shop_id;

  if not found or not settings_row.auto_confirm_enabled then
    return jsonb_build_object('outcome', 'auto_confirm_disabled', 'order', null);
  end if;

  -- Normalize order code: support both AK-XXXXXXXX and AKXXXXXXXX formats
  norm_code := upper(trim(p_order_code));
  if norm_code ~ '^[0-9A-F]{8}$' then
    norm_code := 'AK-' || norm_code;
  elsif norm_code ~ '^AK[0-9A-F]{8}$' then
    norm_code := 'AK-' || substr(norm_code, 3);
  end if;

  -- Check transaction replay idempotency
  if exists (
    select 1 from public.payment_transactions
    where shop_id = p_shop_id
      and provider = p_provider
      and transaction_reference = p_transaction_ref
  ) then
    select o.* into order_row
    from public.orders o
    join public.payment_transactions pt on pt.order_id = o.id
    where pt.shop_id = p_shop_id
      and pt.provider = p_provider
      and pt.transaction_reference = p_transaction_ref;
    return jsonb_build_object(
      'outcome', 'already_processed',
      'order', case when order_row.id is not null then to_jsonb(order_row) - 'recovery_token_hash' else null end
    );
  end if;

  -- Find the order by normalized order code with row lock
  select * into order_row
  from public.orders
  where shop_id = p_shop_id
    and (order_code = norm_code or order_code = upper(trim(p_order_code)))
  for update;

  if not found then
    insert into public.payment_transactions (
      shop_id, order_id, provider, transaction_reference, account_number, amount, description, raw_payload
    ) values (
      p_shop_id, null, p_provider, p_transaction_ref, p_account_number, p_amount, p_description, p_raw_payload
    );
    return jsonb_build_object('outcome', 'not_found', 'order', null);
  end if;

  -- Order already confirmed
  if order_row.status = 'confirmed' then
    insert into public.payment_transactions (
      shop_id, order_id, provider, transaction_reference, account_number, amount, description, raw_payload
    ) values (
      p_shop_id, order_row.id, p_provider, p_transaction_ref, p_account_number, p_amount, p_description, p_raw_payload
    );
    return jsonb_build_object('outcome', 'already_confirmed', 'order', to_jsonb(order_row) - 'recovery_token_hash');
  end if;

  -- Order cancelled
  if order_row.status = 'cancelled' then
    insert into public.payment_transactions (
      shop_id, order_id, provider, transaction_reference, account_number, amount, description, raw_payload
    ) values (
      p_shop_id, order_row.id, p_provider, p_transaction_ref, p_account_number, p_amount, p_description, p_raw_payload
    );
    return jsonb_build_object('outcome', 'already_cancelled', 'order', to_jsonb(order_row) - 'recovery_token_hash');
  end if;

  -- Order expired or expired reservation
  if order_row.status = 'expired' or order_row.expires_at <= now() then
    if order_row.status = 'pending' then
      order_row := private.release_reservation(order_row.id, 'expired');
    end if;
    insert into public.payment_transactions (
      shop_id, order_id, provider, transaction_reference, account_number, amount, description, raw_payload
    ) values (
      p_shop_id, order_row.id, p_provider, p_transaction_ref, p_account_number, p_amount, p_description, p_raw_payload
    );
    return jsonb_build_object('outcome', 'expired', 'order', to_jsonb(order_row) - 'recovery_token_hash');
  end if;

  -- Verify amount: reject underpayments
  if p_amount < order_row.total_amount then
    insert into public.payment_transactions (
      shop_id, order_id, provider, transaction_reference, account_number, amount, description, raw_payload
    ) values (
      p_shop_id, order_row.id, p_provider, p_transaction_ref, p_account_number, p_amount, p_description, p_raw_payload
    );
    return jsonb_build_object(
      'outcome', 'underpaid',
      'order', to_jsonb(order_row) - 'recovery_token_hash',
      'required_amount', order_row.total_amount,
      'received_amount', p_amount
    );
  end if;

  -- Confirm the order
  update public.orders
  set status = 'confirmed',
      confirmed_at = now(),
      confirmed_by = null,
      confirmed_by_email = 'system:' || p_provider,
      fulfillment_status = 'preparing',
      fulfillment_updated_at = now(),
      fulfillment_updated_by = null,
      fulfillment_updated_by_email = 'system:' || p_provider
  where id = order_row.id
  returning * into order_row;

  -- Record transaction
  insert into public.payment_transactions (
    shop_id, order_id, provider, transaction_reference, account_number, amount, description, raw_payload
  ) values (
    p_shop_id, order_row.id, p_provider, p_transaction_ref, p_account_number, p_amount, p_description, p_raw_payload
  );

  return jsonb_build_object('outcome', 'confirmed', 'order', to_jsonb(order_row) - 'recovery_token_hash');
end;
$$;

revoke all on function public.confirm_order_by_webhook(uuid, text, integer, text, text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.confirm_order_by_webhook(uuid, text, integer, text, text, text, text, jsonb)
  to service_role;
