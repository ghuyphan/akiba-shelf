-- Free, entertainment-only product gacha. Pull state and history remain in the
-- browser; Supabase stores only shop-owned presentation and pool configuration.

alter table public.products
  add constraint products_shop_id_id_key unique (shop_id, id);

create table public.gacha_settings (
  shop_id uuid primary key references public.shops(id) on delete cascade,
  enabled boolean not null default false,
  title text not null default 'Wish upon the shelf',
  description text not null default 'Meet a surprise character or discover a featured weapon from this shop.',
  rare_pity smallint not null default 10,
  legendary_pity smallint not null default 50,
  updated_at timestamptz not null default now(),
  constraint gacha_settings_title_length check (length(btrim(title)) between 1 and 80),
  constraint gacha_settings_description_length check (length(description) between 0 and 240),
  constraint gacha_settings_rare_pity_check check (rare_pity between 2 and 30),
  constraint gacha_settings_legendary_pity_check check (legendary_pity between 10 and 100),
  constraint gacha_settings_pity_order_check check (legendary_pity > rare_pity)
);

create table public.gacha_pool_entries (
  shop_id uuid not null,
  product_id text not null,
  kind text not null default 'character',
  rarity smallint not null default 3,
  weight smallint not null default 100,
  featured boolean not null default false,
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (shop_id, product_id),
  constraint gacha_pool_entries_shop_fkey
    foreign key (shop_id) references public.shops(id) on delete cascade,
  constraint gacha_pool_entries_shop_product_fkey
    foreign key (shop_id, product_id)
    references public.products(shop_id, id) on delete cascade,
  constraint gacha_pool_entries_kind_check check (kind in ('character', 'weapon')),
  constraint gacha_pool_entries_rarity_check check (rarity between 3 and 5),
  constraint gacha_pool_entries_weight_check check (weight between 1 and 1000)
);

create index gacha_pool_entries_public_pool_idx
  on public.gacha_pool_entries (shop_id, rarity, featured, product_id)
  where active;

create trigger gacha_settings_set_updated_at
before update on public.gacha_settings
for each row execute function public.set_updated_at();

create trigger gacha_pool_entries_set_updated_at
before update on public.gacha_pool_entries
for each row execute function public.set_updated_at();

alter table public.gacha_settings enable row level security;
alter table public.gacha_pool_entries enable row level security;

create policy "Anonymous reads enabled gacha settings"
on public.gacha_settings for select to anon
using (
  enabled
  and exists (
    select 1 from public.shops s
    where s.id = shop_id and s.active
  )
);

create policy "Authenticated users read permitted gacha settings"
on public.gacha_settings for select to authenticated
using (
  (
    enabled
    and exists (
      select 1 from public.shops s
      where s.id = shop_id and s.active
    )
  )
  or private.has_shop_role(shop_id, array['owner', 'admin'])
);

create policy "Shop admins create gacha settings"
on public.gacha_settings for insert to authenticated
with check (private.has_shop_role(shop_id, array['owner', 'admin']));

create policy "Shop admins update gacha settings"
on public.gacha_settings for update to authenticated
using (private.has_shop_role(shop_id, array['owner', 'admin']))
with check (private.has_shop_role(shop_id, array['owner', 'admin']));

create policy "Anonymous reads enabled gacha pool"
on public.gacha_pool_entries for select to anon
using (
  active
  and exists (
    select 1
    from public.shops s
    join public.gacha_settings gs on gs.shop_id = s.id
    join public.products p
      on p.shop_id = gacha_pool_entries.shop_id
     and p.id = gacha_pool_entries.product_id
    where s.id = gacha_pool_entries.shop_id
      and s.active
      and gs.enabled
      and p.active
  )
);

create policy "Authenticated users read permitted gacha pool"
on public.gacha_pool_entries for select to authenticated
using (
  (
    active
    and exists (
      select 1
      from public.shops s
      join public.gacha_settings gs on gs.shop_id = s.id
      join public.products p
        on p.shop_id = gacha_pool_entries.shop_id
       and p.id = gacha_pool_entries.product_id
      where s.id = gacha_pool_entries.shop_id
        and s.active
        and gs.enabled
        and p.active
    )
  )
  or private.has_shop_role(shop_id, array['owner', 'admin'])
);

create policy "Shop admins create gacha pool entries"
on public.gacha_pool_entries for insert to authenticated
with check (private.has_shop_role(shop_id, array['owner', 'admin']));

create policy "Shop admins update gacha pool entries"
on public.gacha_pool_entries for update to authenticated
using (private.has_shop_role(shop_id, array['owner', 'admin']))
with check (private.has_shop_role(shop_id, array['owner', 'admin']));

create policy "Shop admins delete gacha pool entries"
on public.gacha_pool_entries for delete to authenticated
using (private.has_shop_role(shop_id, array['owner', 'admin']));

-- Public fields are intentionally explicit so future private columns are not
-- exposed automatically by broad table grants.
revoke all on public.gacha_settings, public.gacha_pool_entries
from public, anon, authenticated;

grant select (
  shop_id, enabled, title, description, rare_pity, legendary_pity, updated_at
) on public.gacha_settings to anon, authenticated;
grant insert, update on public.gacha_settings to authenticated;

grant select (
  shop_id, product_id, kind, rarity, weight, featured, active, updated_at
) on public.gacha_pool_entries to anon, authenticated;
grant insert, update, delete on public.gacha_pool_entries to authenticated;
