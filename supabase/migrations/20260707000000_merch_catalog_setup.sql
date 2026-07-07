create table if not exists public.products (
  id text primary key,
  name text not null,
  collection text not null default '',
  description text not null default '',
  price_vnd integer not null default 0 check (price_vnd >= 0),
  item_code text not null,
  quantity_available integer not null default 0 check (quantity_available >= 0),
  category text not null default '',
  badge text,
  stock_status text not null default 'in_stock' check (stock_status in ('in_stock', 'limited', 'sold_out')),
  stock_note text not null default 'In stock',
  images text[] not null default '{}',
  featured boolean not null default false,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.booth_settings (
  id text primary key default 'main',
  booth_name text not null,
  subtitle text not null default '',
  booth_code text not null default '',
  location text not null default '',
  open_hours text not null default '',
  hero_title text not null default '',
  hero_text text not null default '',
  theme_primary text,
  theme_secondary text,
  theme_accent text,
  theme_background text,
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_settings (
  id text primary key default 'main',
  momo_qr_url text not null default '',
  bank_qr_url text not null default '',
  momo_label text not null default 'MoMo / QR Payment',
  bank_label text not null default 'Bank Transfer',
  bank_code text,
  bank_acq_id text,
  bank_account_no text,
  bank_account_name text,
  bank_add_info_template text,
  payment_instructions text not null default '',
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
  before update on public.products
  for each row
  execute function public.set_updated_at();

drop trigger if exists booth_settings_set_updated_at on public.booth_settings;
create trigger booth_settings_set_updated_at
  before update on public.booth_settings
  for each row
  execute function public.set_updated_at();

drop trigger if exists payment_settings_set_updated_at on public.payment_settings;
create trigger payment_settings_set_updated_at
  before update on public.payment_settings
  for each row
  execute function public.set_updated_at();

create index if not exists products_active_sort_order_idx
  on public.products (active, sort_order);

create unique index if not exists products_item_code_idx
  on public.products (item_code);

grant usage on schema public to anon, authenticated;
grant select on public.products, public.booth_settings, public.payment_settings to anon;
grant select, insert, update, delete on public.products to authenticated;
grant select, insert, update on public.booth_settings, public.payment_settings to authenticated;

alter table public.products enable row level security;
alter table public.booth_settings enable row level security;
alter table public.payment_settings enable row level security;

drop policy if exists "Public can read active products" on public.products;
create policy "Public can read active products"
  on public.products
  for select
  to anon, authenticated
  using (active = true or (select auth.uid()) is not null);

drop policy if exists "Admins can manage products" on public.products;
create policy "Admins can manage products"
  on public.products
  for all
  to authenticated
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);

drop policy if exists "Public can read booth settings" on public.booth_settings;
create policy "Public can read booth settings"
  on public.booth_settings
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Admins can manage booth settings" on public.booth_settings;
create policy "Admins can manage booth settings"
  on public.booth_settings
  for all
  to authenticated
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);

drop policy if exists "Public can read payment settings" on public.payment_settings;
create policy "Public can read payment settings"
  on public.payment_settings
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Admins can manage payment settings" on public.payment_settings;
create policy "Admins can manage payment settings"
  on public.payment_settings
  for all
  to authenticated
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);

insert into storage.buckets (id, name, public)
values
  ('product-images', 'product-images', true),
  ('payment-qr', 'payment-qr', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Public can read merch images" on storage.objects;
create policy "Public can read merch images"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id in ('product-images', 'payment-qr'));

drop policy if exists "Admins can upload merch images" on storage.objects;
create policy "Admins can upload merch images"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id in ('product-images', 'payment-qr'));

drop policy if exists "Admins can update merch images" on storage.objects;
create policy "Admins can update merch images"
  on storage.objects
  for update
  to authenticated
  using (bucket_id in ('product-images', 'payment-qr'))
  with check (bucket_id in ('product-images', 'payment-qr'));

drop policy if exists "Admins can delete merch images" on storage.objects;
create policy "Admins can delete merch images"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id in ('product-images', 'payment-qr'));

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'products'
  ) then
    alter publication supabase_realtime add table public.products;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'booth_settings'
  ) then
    alter publication supabase_realtime add table public.booth_settings;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'payment_settings'
  ) then
    alter publication supabase_realtime add table public.payment_settings;
  end if;
end $$;
