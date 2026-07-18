-- Live gacha tables are a public projection. Admins edit gacha_game_configs
-- and publish through publish_gacha_configuration; direct relational writes
-- bypass cross-row invariants and are no longer part of the browser contract.
revoke insert, update, delete
on public.gacha_settings, public.gacha_banners, public.gacha_pool_entries
from authenticated;

create or replace function private.assert_published_gacha_configuration(
  p_shop_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings public.gacha_settings;
  v_offender text;
begin
  select * into v_settings
  from public.gacha_settings settings
  where settings.shop_id = p_shop_id;

  if not found or not v_settings.enabled then
    return;
  end if;

  if not exists (
    select 1
    from public.gacha_banners banner
    where banner.shop_id = p_shop_id and banner.active
  ) then
    raise exception
      'An enabled gacha configuration needs at least one active banner';
  end if;

  select banner.name into v_offender
  from public.gacha_banners banner
  where banner.shop_id = p_shop_id
    and banner.active
    and not exists (
      select 1
      from public.gacha_pool_entries entry
      where entry.shop_id = p_shop_id
        and entry.banner_id = banner.id
        and entry.active
    )
  limit 1;
  if v_offender is not null then
    raise exception
      'Every active banner needs at least one active merch item ("%")',
      v_offender;
  end if;

  if v_settings.game_type = 'hsr' then
    select banner.name into v_offender
    from public.gacha_banners banner
    where banner.shop_id = p_shop_id
      and banner.active
      and (
        select count(*)
        from public.gacha_pool_entries entry
        where entry.shop_id = p_shop_id
          and entry.banner_id = banner.id
          and entry.active
          and entry.featured
          and entry.rarity = 5
          and (banner.kind = 'character') = (entry.kind = 'character')
      ) <> 1
    limit 1;
    if v_offender is not null then
      raise exception
        'Every active HSR banner needs one featured 5-star item ("%")',
        v_offender;
    end if;
  end if;
end;
$$;

revoke all on function private.assert_published_gacha_configuration(uuid)
from public, anon, authenticated;

create or replace function private.enforce_published_gacha_configuration()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_published_gacha_configuration(
    coalesce(new.shop_id, old.shop_id)
  );
  return null;
end;
$$;

revoke all on function private.enforce_published_gacha_configuration()
from public, anon, authenticated;

-- Disable invalid historical projections before installing the deferred guard.
update public.gacha_settings settings
set enabled = false
where settings.enabled
  and (
    not exists (
      select 1 from public.gacha_banners banner
      where banner.shop_id = settings.shop_id and banner.active
    )
    or exists (
      select 1
      from public.gacha_banners banner
      where banner.shop_id = settings.shop_id
        and banner.active
        and not exists (
          select 1 from public.gacha_pool_entries entry
          where entry.shop_id = settings.shop_id
            and entry.banner_id = banner.id
            and entry.active
        )
    )
    or (
      settings.game_type = 'hsr'
      and exists (
        select 1
        from public.gacha_banners banner
        where banner.shop_id = settings.shop_id
          and banner.active
          and (
            select count(*)
            from public.gacha_pool_entries entry
            where entry.shop_id = settings.shop_id
              and entry.banner_id = banner.id
              and entry.active
              and entry.featured
              and entry.rarity = 5
              and (banner.kind = 'character') = (entry.kind = 'character')
          ) <> 1
      )
    )
  );

create constraint trigger gacha_settings_validate_published
after insert or update or delete on public.gacha_settings
deferrable initially deferred
for each row execute function private.enforce_published_gacha_configuration();

create constraint trigger gacha_banners_validate_published
after insert or update or delete on public.gacha_banners
deferrable initially deferred
for each row execute function private.enforce_published_gacha_configuration();

create constraint trigger gacha_pool_validate_published
after insert or update or delete on public.gacha_pool_entries
deferrable initially deferred
for each row execute function private.enforce_published_gacha_configuration();
