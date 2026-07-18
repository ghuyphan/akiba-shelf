alter table public.gacha_banners
  add column starts_at timestamptz,
  add column ends_at timestamptz,
  add constraint gacha_banners_schedule_check
    check (starts_at is null or ends_at is null or ends_at > starts_at);

create index gacha_banners_active_schedule_idx
  on public.gacha_banners (shop_id, starts_at, ends_at)
  where active;

grant select (starts_at, ends_at)
on public.gacha_banners to anon, authenticated;

create or replace function public.publish_gacha_configuration_v4(
  p_shop_id uuid,
  p_game_type text,
  p_config jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_banner record;
begin
  if not private.has_shop_role(p_shop_id, array['owner', 'admin']) then
    raise exception 'Not allowed to publish gacha configuration for this shop';
  end if;

  for v_banner in
    select banner.*
    from jsonb_to_recordset(coalesce(p_config->'banners', '[]'::jsonb)) as banner(
      id uuid,
      starts_at timestamptz,
      ends_at timestamptz
    )
  loop
    if v_banner.starts_at is not null
      and v_banner.ends_at is not null
      and v_banner.ends_at <= v_banner.starts_at then
      raise exception 'A banner end time must be later than its start time';
    end if;
  end loop;

  perform public.publish_gacha_configuration_v3(
    p_shop_id,
    p_game_type,
    p_config
  );

  update public.gacha_banners target
  set starts_at = schedule.starts_at,
      ends_at = schedule.ends_at
  from jsonb_to_recordset(coalesce(p_config->'banners', '[]'::jsonb)) as schedule(
    id uuid,
    starts_at timestamptz,
    ends_at timestamptz
  )
  where target.shop_id = p_shop_id
    and target.id = schedule.id;
end;
$$;

revoke all on function public.publish_gacha_configuration_v3(uuid, text, jsonb)
from public, anon, authenticated;
revoke all on function public.publish_gacha_configuration_v4(uuid, text, jsonb)
from public, anon, authenticated;
grant execute on function public.publish_gacha_configuration_v4(uuid, text, jsonb)
to authenticated;

notify pgrst, 'reload schema';
