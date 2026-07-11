-- Festival-safe temporary reservations. Pending orders own deducted inventory.
alter table public.orders
  add column if not exists expires_at timestamptz,
  add column if not exists confirmed_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists expired_at timestamptz,
  add column if not exists confirmed_by uuid references auth.users(id) on delete set null,
  add column if not exists cancelled_by uuid references auth.users(id) on delete set null;
alter table public.products add column if not exists image_variants jsonb not null default '[]'::jsonb;

-- Historical terminal orders never expire. Only currently active orders get a window.
update public.orders set expires_at = created_at + interval '10 minutes'
where status = 'pending' and expires_at is null;

create index if not exists orders_pending_expiry_idx
  on public.orders (expires_at, id) where status = 'pending';

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.reservation_duration()
returns interval language sql immutable set search_path = ''
as $$ select interval '10 minutes' $$;

create or replace function private.sync_product_stock(p_product_id text)
returns void language sql security definer set search_path = ''
as $$
  update public.products
  set stock_status = case when quantity_available = 0 then 'sold_out' when quantity_available <= 5 then 'limited' else 'in_stock' end,
      stock_note = case when quantity_available = 0 then 'Sold out' when quantity_available <= 5 then 'Limited stock' else 'In stock' end
  where id = p_product_id;
$$;

-- Caller must hold the order row lock. The status guard makes release exactly-once.
create or replace function private.release_reservation(p_order_id uuid, p_status public.order_status, p_actor uuid default null)
returns public.orders language plpgsql security definer set search_path = '' as $$
declare v_order public.orders; v_product_id text;
begin
  if p_status not in ('cancelled', 'expired') then raise exception 'Invalid release status'; end if;
  select * into v_order from public.orders where id = p_order_id and status = 'pending' for update;
  if not found then select * into v_order from public.orders where id = p_order_id; return v_order; end if;

  perform p.id from public.products p
  where p.id in (select oi.product_id from public.order_items oi where oi.order_id = p_order_id)
  order by p.id for update;
  for v_product_id in
    with restored as (
      select oi.product_id, sum(oi.quantity)::integer quantity from public.order_items oi
      where oi.order_id = p_order_id group by oi.product_id
    )
    update public.products p set quantity_available = p.quantity_available + r.quantity
    from restored r where p.id = r.product_id returning p.id
  loop perform private.sync_product_stock(v_product_id); end loop;

  update public.orders set status = p_status,
    cancelled_at = case when p_status = 'cancelled' then now() else cancelled_at end,
    cancelled_by = case when p_status = 'cancelled' then p_actor else cancelled_by end,
    expired_at = case when p_status = 'expired' then now() else expired_at end
  where id = p_order_id returning * into v_order;
  return v_order;
end $$;

drop function if exists public.create_order(text, jsonb, uuid, text);
create function public.create_order(p_customer_name text, p_items jsonb, p_client_request_id uuid, p_recovery_token text)
returns table (id uuid, order_code text, customer_name text, total_amount integer, status public.order_status,
  created_at timestamptz, updated_at timestamptz, expires_at timestamptz, confirmed_at timestamptz,
  cancelled_at timestamptz, expired_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare v_order public.orders; v_existing public.orders; v_total integer; v_hash text; v_product_id text;
begin
  if p_client_request_id is null then raise exception 'A client request id is required'; end if;
  if p_recovery_token is null or length(p_recovery_token) < 32 then raise exception 'A recovery token is required'; end if;
  v_hash := encode(extensions.digest(p_recovery_token, 'sha256'), 'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_client_request_id::text, 0));
  select * into v_existing from public.orders o where o.client_request_id = p_client_request_id;
  if found then
    if v_existing.recovery_token_hash is distinct from v_hash then raise exception 'This request id belongs to another checkout'; end if;
    return query select v_existing.id,v_existing.order_code,v_existing.customer_name,v_existing.total_amount,v_existing.status,
      v_existing.created_at,v_existing.updated_at,v_existing.expires_at,v_existing.confirmed_at,v_existing.cancelled_at,v_existing.expired_at; return;
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 50 then raise exception 'Cart must contain between 1 and 50 items'; end if;
  if exists (select 1 from jsonb_to_recordset(p_items) x(product_id text,quantity integer) where product_id is null or quantity is null or quantity <= 0)
    then raise exception 'Cart contains an invalid item'; end if;
  perform p.id from public.products p where p.id in (select x.product_id from jsonb_to_recordset(p_items) x(product_id text,quantity integer)) order by p.id for update;
  if exists (select 1 from (select x.product_id,sum(x.quantity)::integer quantity from jsonb_to_recordset(p_items) x(product_id text,quantity integer) group by x.product_id) x
    left join public.products p on p.id=x.product_id where p.id is null or not p.active or p.quantity_available < x.quantity)
    then raise exception 'One or more items are sold out or no longer have enough stock'; end if;
  select sum(p.price_vnd*x.quantity)::integer into v_total from (select i.product_id,sum(i.quantity)::integer quantity from jsonb_to_recordset(p_items) i(product_id text,quantity integer) group by i.product_id) x join public.products p on p.id=x.product_id;
  insert into public.orders(customer_name,total_amount,status,client_request_id,recovery_token_hash,expires_at)
  values(nullif(btrim(left(p_customer_name,30)),''),v_total,'pending',p_client_request_id,v_hash,now()+private.reservation_duration()) returning * into v_order;
  insert into public.order_items(order_id,product_id,quantity,unit_price)
  select v_order.id,p.id,x.quantity,p.price_vnd from (select i.product_id,sum(i.quantity)::integer quantity from jsonb_to_recordset(p_items) i(product_id text,quantity integer) group by i.product_id) x join public.products p on p.id=x.product_id;
  for v_product_id in update public.products p set quantity_available=p.quantity_available-x.quantity from
    (select i.product_id,sum(i.quantity)::integer quantity from jsonb_to_recordset(p_items) i(product_id text,quantity integer) group by i.product_id) x where p.id=x.product_id returning p.id
  loop perform private.sync_product_stock(v_product_id); end loop;
  return query select v_order.id,v_order.order_code,v_order.customer_name,v_order.total_amount,v_order.status,v_order.created_at,v_order.updated_at,v_order.expires_at,v_order.confirmed_at,v_order.cancelled_at,v_order.expired_at;
end $$;

drop function if exists public.confirm_order_payment(uuid);
create function public.confirm_order_payment(target_order_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.orders;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into o from public.orders where id=target_order_id for update;
  if not found then return jsonb_build_object('outcome','not_found','order',null); end if;
  if o.status='confirmed' then return jsonb_build_object('outcome','already_confirmed','order',to_jsonb(o)-'recovery_token_hash'); end if;
  if o.status='cancelled' then return jsonb_build_object('outcome','already_cancelled','order',to_jsonb(o)-'recovery_token_hash'); end if;
  if o.status='expired' then return jsonb_build_object('outcome','already_expired','order',to_jsonb(o)-'recovery_token_hash'); end if;
  if o.expires_at <= now() then o:=private.release_reservation(o.id,'expired'); return jsonb_build_object('outcome','expired','order',to_jsonb(o)-'recovery_token_hash'); end if;
  update public.orders set status='confirmed',confirmed_at=now(),confirmed_by=auth.uid() where id=o.id returning * into o;
  return jsonb_build_object('outcome','confirmed','order',to_jsonb(o)-'recovery_token_hash');
end $$;

create or replace function public.cancel_order(target_order_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.orders;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into o from public.orders where id=target_order_id for update;
  if not found then return jsonb_build_object('outcome','not_found','order',null); end if;
  if o.status='cancelled' then return jsonb_build_object('outcome','already_cancelled','order',to_jsonb(o)-'recovery_token_hash'); end if;
  if o.status='confirmed' then return jsonb_build_object('outcome','already_confirmed','order',to_jsonb(o)-'recovery_token_hash'); end if;
  if o.status='expired' then return jsonb_build_object('outcome','already_expired','order',to_jsonb(o)-'recovery_token_hash'); end if;
  o:=private.release_reservation(o.id,'cancelled',auth.uid()); return jsonb_build_object('outcome','cancelled','order',to_jsonb(o)-'recovery_token_hash');
end $$;

create or replace function public.cancel_customer_order(p_order_id uuid,p_recovery_token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.orders;
begin
  select * into o from public.orders where id=p_order_id for update;
  if not found or o.recovery_token_hash is distinct from encode(extensions.digest(p_recovery_token,'sha256'),'hex') then return jsonb_build_object('outcome','not_found','order',null); end if;
  if o.status='cancelled' then return jsonb_build_object('outcome','already_cancelled','order',to_jsonb(o)-'recovery_token_hash'); end if;
  if o.status='confirmed' then return jsonb_build_object('outcome','already_confirmed','order',to_jsonb(o)-'recovery_token_hash'); end if;
  if o.status='expired' then return jsonb_build_object('outcome','already_expired','order',to_jsonb(o)-'recovery_token_hash'); end if;
  o:=private.release_reservation(o.id,'cancelled',null); return jsonb_build_object('outcome','cancelled','order',to_jsonb(o)-'recovery_token_hash');
end $$;

create or replace function public.expire_pending_orders(batch_size integer default 100) returns jsonb language plpgsql security definer set search_path='' as $$
declare oid uuid; affected uuid[]:='{}'; o public.orders;
begin
  if current_user not in ('postgres','service_role') and auth.uid() is null then raise exception 'Authentication required'; end if;
  for oid in select id from public.orders where status='pending' and expires_at<=now() order by expires_at,id for update skip locked limit greatest(1,least(batch_size,500))
  loop o:=private.release_reservation(oid,'expired'); affected:=array_append(affected,oid); end loop;
  return jsonb_build_object('expired_count',cardinality(affected),'order_ids',to_jsonb(affected));
end $$;

drop function if exists public.get_customer_order(uuid,text);
create function public.get_customer_order(p_order_id uuid,p_recovery_token text)
returns table(id uuid,order_code text,customer_name text,total_amount integer,status public.order_status,created_at timestamptz,updated_at timestamptz,expires_at timestamptz,confirmed_at timestamptz,cancelled_at timestamptz,expired_at timestamptz)
language plpgsql security definer set search_path='' as $$ declare o public.orders; begin
  select * into o from public.orders where orders.id=p_order_id and recovery_token_hash=encode(extensions.digest(p_recovery_token,'sha256'),'hex') for update;
  if not found then return; end if;
  if o.status='pending' and o.expires_at<=now() then o:=private.release_reservation(o.id,'expired'); end if;
  return query select o.id,o.order_code,o.customer_name,o.total_amount,o.status,o.created_at,o.updated_at,o.expires_at,o.confirmed_at,o.cancelled_at,o.expired_at;
end $$;

revoke all on function private.reservation_duration(), private.sync_product_stock(text), private.release_reservation(uuid,public.order_status,uuid) from public,anon,authenticated;
revoke all on function public.create_order(text,jsonb,uuid,text), public.confirm_order_payment(uuid), public.cancel_order(uuid), public.cancel_customer_order(uuid,text), public.expire_pending_orders(integer), public.get_customer_order(uuid,text) from public,anon,authenticated;
grant execute on function public.create_order(text,jsonb,uuid,text), public.get_customer_order(uuid,text), public.cancel_customer_order(uuid,text) to anon,authenticated;
grant execute on function public.confirm_order_payment(uuid), public.cancel_order(uuid), public.expire_pending_orders(integer) to authenticated;

create extension if not exists pg_cron;
do $$ begin
  if exists (select 1 from cron.job where jobname='expire-merch-reservations') then
    perform cron.unschedule('expire-merch-reservations');
  end if;
  perform cron.schedule('expire-merch-reservations','* * * * *','select public.expire_pending_orders(100);');
end $$;
-- If the hosting plan disallows extension creation, enable Supabase Cron in
-- Integrations first and re-run this migration.
-- Verify: select jobid,schedule,command,active from cron.job where jobname='expire-merch-reservations';
-- Manual test: select public.expire_pending_orders(100);
