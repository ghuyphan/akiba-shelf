-- 1. Create order status type if not exists
do $$
begin
  if not exists (select 1 from pg_type where typname = 'order_status') then
    create type order_status as enum ('pending', 'confirmed', 'cancelled');
  end if;
end $$;

-- 2. Create function to generate order codes
create or replace function public.generate_order_code()
returns text
language plpgsql
as $$
declare
  chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result text := '';
  i integer;
begin
  for i in 1..6 loop
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  end loop;
  return result;
end;
$$;

-- 3. Create orders table
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_code text not null unique default public.generate_order_code(),
  customer_name text,
  total_amount integer not null check (total_amount >= 0),
  status order_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. Create order_items table
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id text not null references public.products(id),
  quantity integer not null check (quantity > 0),
  unit_price integer not null check (unit_price >= 0)
);

-- 5. Set up updated_at trigger for orders table
drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
  before update on public.orders
  for each row
  execute function public.set_updated_at();

-- 6. Enable RLS
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- 7. RLS Policies for orders
drop policy if exists "Anyone can insert orders" on public.orders;
create policy "Anyone can insert orders"
  on public.orders
  for insert
  to anon, authenticated
  with check (status = 'pending');

drop policy if exists "Anyone can read specific orders" on public.orders;
create policy "Anyone can read specific orders"
  on public.orders
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Admins can manage orders" on public.orders;
create policy "Admins can manage orders"
  on public.orders
  for all
  to authenticated
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);

-- 8. RLS Policies for order_items
drop policy if exists "Anyone can insert order items" on public.order_items;
create policy "Anyone can insert order items"
  on public.order_items
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Anyone can read order items" on public.order_items;
create policy "Anyone can read order items"
  on public.order_items
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Admins can manage order items" on public.order_items;
create policy "Admins can manage order items"
  on public.order_items
  for all
  to authenticated
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);

-- 9. Grants
grant select, insert on public.orders, public.order_items to anon;
grant select, insert, update, delete on public.orders, public.order_items to authenticated;

-- 10. RPC function to confirm payment and decrement stock transactionally
create or replace function public.confirm_order_payment(target_order_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  item record;
begin
  -- Lock the order and verify it is pending
  if not exists (
    select 1 from public.orders
    where id = target_order_id and status = 'pending'
    for update
  ) then
    raise exception 'Order is not in pending status or does not exist';
  end if;

  -- Decrement inventory for each item in the order
  for item in (
    select product_id, quantity from public.order_items where order_id = target_order_id
  ) loop
    -- Check stock availability and lock the product row
    if not exists (
      select 1 from public.products
      where id = item.product_id and quantity_available >= item.quantity
      for update
    ) then
      raise exception 'Insufficient stock for product id %', item.product_id;
    end if;

    -- Update inventory and stock status
    update public.products
    set 
      quantity_available = quantity_available - item.quantity,
      stock_status = case 
        when quantity_available - item.quantity = 0 then 'sold_out'
        when quantity_available - item.quantity <= 5 then 'limited'
        else 'in_stock'
      end,
      stock_note = case 
        when quantity_available - item.quantity = 0 then 'Sold out'
        when quantity_available - item.quantity <= 5 then 'Limited stock'
        else 'In stock'
      end
    where id = item.product_id;
  end loop;

  -- Mark the order as confirmed
  update public.orders
  set status = 'confirmed', updated_at = now()
  where id = target_order_id;
end;
$$;

-- 11. Add to realtime publication
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'order_items'
  ) then
    alter publication supabase_realtime add table public.order_items;
  end if;
end $$;
