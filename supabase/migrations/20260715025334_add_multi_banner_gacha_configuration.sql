create table public.gacha_banners (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null default 'Merch Event Wish',
  description text not null default '',
  kind text not null default 'character',
  display_limit smallint not null default 3,
  sort_order smallint not null default 0,
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint gacha_banners_shop_id_id_key unique (shop_id, id),
  constraint gacha_banners_name_length check (length(btrim(name)) between 1 and 80),
  constraint gacha_banners_description_length check (length(description) between 0 and 240),
  constraint gacha_banners_kind_check check (kind in ('character', 'weapon')),
  constraint gacha_banners_display_limit_check check (display_limit between 1 and 5),
  constraint gacha_banners_sort_order_check check (sort_order between 0 and 1000)
);

create index gacha_banners_shop_order_idx
  on public.gacha_banners (shop_id, sort_order, id);

insert into public.gacha_banners (shop_id, name, description)
select
  shop_id,
  title,
  description
from public.gacha_settings;

alter table public.gacha_pool_entries
  add column banner_id uuid,
  add column element text not null default 'anemo',
  add column weapon_type text not null default 'sword';

update public.gacha_pool_entries entry
set banner_id = banner.id
from public.gacha_banners banner
where banner.shop_id = entry.shop_id;

alter table public.gacha_pool_entries
  alter column banner_id set not null,
  drop constraint gacha_pool_entries_pkey,
  add constraint gacha_pool_entries_pkey primary key (banner_id, product_id),
  add constraint gacha_pool_entries_banner_fkey
    foreign key (shop_id, banner_id)
    references public.gacha_banners(shop_id, id) on delete cascade,
  add constraint gacha_pool_entries_element_check
    check (element in ('anemo', 'geo', 'electro', 'dendro', 'hydro', 'pyro', 'cryo')),
  add constraint gacha_pool_entries_weapon_type_check
    check (weapon_type in ('sword', 'claymore', 'polearm', 'bow', 'catalyst'));

drop index public.gacha_pool_entries_public_pool_idx;

create index gacha_pool_entries_public_pool_idx
  on public.gacha_pool_entries (banner_id, rarity, featured, product_id)
  where active;

create index gacha_pool_entries_shop_idx
  on public.gacha_pool_entries (shop_id, banner_id);

create trigger gacha_banners_set_updated_at
before update on public.gacha_banners
for each row execute function public.set_updated_at();

alter table public.gacha_banners enable row level security;

create policy "Anonymous reads enabled gacha banners"
on public.gacha_banners for select to anon
using (
  active
  and exists (
    select 1
    from public.shops shop
    join public.gacha_settings settings on settings.shop_id = shop.id
    where shop.id = gacha_banners.shop_id
      and shop.active
      and settings.enabled
  )
);

create policy "Authenticated users read permitted gacha banners"
on public.gacha_banners for select to authenticated
using (
  (
    active
    and exists (
      select 1
      from public.shops shop
      join public.gacha_settings settings on settings.shop_id = shop.id
      where shop.id = gacha_banners.shop_id
        and shop.active
        and settings.enabled
    )
  )
  or private.has_shop_role(shop_id, array['owner', 'admin'])
);

create policy "Shop admins create gacha banners"
on public.gacha_banners for insert to authenticated
with check (private.has_shop_role(shop_id, array['owner', 'admin']));

create policy "Shop admins update gacha banners"
on public.gacha_banners for update to authenticated
using (private.has_shop_role(shop_id, array['owner', 'admin']))
with check (private.has_shop_role(shop_id, array['owner', 'admin']));

create policy "Shop admins delete gacha banners"
on public.gacha_banners for delete to authenticated
using (private.has_shop_role(shop_id, array['owner', 'admin']));

drop policy "Anonymous reads enabled gacha pool" on public.gacha_pool_entries;
drop policy "Authenticated users read permitted gacha pool" on public.gacha_pool_entries;

create policy "Anonymous reads enabled gacha pool"
on public.gacha_pool_entries for select to anon
using (
  active
  and exists (
    select 1
    from public.shops shop
    join public.gacha_settings settings on settings.shop_id = shop.id
    join public.gacha_banners banner
      on banner.shop_id = gacha_pool_entries.shop_id
     and banner.id = gacha_pool_entries.banner_id
    join public.products product
      on product.shop_id = gacha_pool_entries.shop_id
     and product.id = gacha_pool_entries.product_id
    where shop.id = gacha_pool_entries.shop_id
      and shop.active
      and settings.enabled
      and banner.active
      and product.active
  )
);

create policy "Authenticated users read permitted gacha pool"
on public.gacha_pool_entries for select to authenticated
using (
  (
    active
    and exists (
      select 1
      from public.shops shop
      join public.gacha_settings settings on settings.shop_id = shop.id
      join public.gacha_banners banner
        on banner.shop_id = gacha_pool_entries.shop_id
       and banner.id = gacha_pool_entries.banner_id
      join public.products product
        on product.shop_id = gacha_pool_entries.shop_id
       and product.id = gacha_pool_entries.product_id
      where shop.id = gacha_pool_entries.shop_id
        and shop.active
        and settings.enabled
        and banner.active
        and product.active
    )
  )
  or private.has_shop_role(shop_id, array['owner', 'admin'])
);

revoke all on public.gacha_banners from public, anon, authenticated;

grant select (
  id, shop_id, name, description, kind, display_limit, sort_order, active, updated_at
) on public.gacha_banners to anon, authenticated;
grant insert, update, delete on public.gacha_banners to authenticated;

revoke all on public.gacha_pool_entries from public, anon, authenticated;
grant select (
  shop_id, banner_id, product_id, kind, element, weapon_type,
  rarity, weight, featured, active, updated_at
) on public.gacha_pool_entries to anon, authenticated;
grant insert, update, delete on public.gacha_pool_entries to authenticated;
