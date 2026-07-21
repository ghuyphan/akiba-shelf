-- Fix gacha configuration publish failure when updating hard pities below existing soft pities.
-- Previous publish flow updated hard pities in publish_gacha_configuration (v1) before updating
-- soft pities in publish_gacha_configuration_v3. If the new hard pity was less than or equal to the
-- old soft pity in the database, the check constraint failed during the v1 UPDATE statement.

create or replace function public.publish_gacha_configuration_v3(
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
  v_settings jsonb := coalesce(p_config->'settings', '{}'::jsonb);
  v_rare_pity integer;
  v_legendary_pity integer;
  v_lightcone_pity integer;
  v_rare_soft_pity integer;
  v_legendary_soft_pity integer;
  v_lightcone_soft_pity integer;
  v_featured_rate numeric;
  v_featured_guarantee boolean;
begin
  if not private.has_shop_role(p_shop_id, array['owner', 'admin']) then
    raise exception 'Not allowed to publish gacha configuration for this shop';
  end if;

  v_rare_pity := coalesce((v_settings->>'rare_pity')::integer, 10);
  v_legendary_pity := coalesce((v_settings->>'legendary_pity')::integer, 50);
  v_lightcone_pity := coalesce(
    (v_settings->>'lightcone_legendary_pity')::integer,
    80
  );
  v_rare_soft_pity := coalesce(
    (v_settings->>'rare_soft_pity')::integer,
    greatest(1, v_rare_pity - 1)
  );
  v_legendary_soft_pity := coalesce(
    (v_settings->>'legendary_soft_pity')::integer,
    greatest(1, v_legendary_pity - 1)
  );
  v_lightcone_soft_pity := coalesce(
    (v_settings->>'lightcone_legendary_soft_pity')::integer,
    greatest(1, v_lightcone_pity - 1)
  );
  v_featured_rate := coalesce(
    (v_settings->>'featured_item_rate')::numeric,
    50.00
  );
  v_featured_guarantee := coalesce(
    (v_settings->>'featured_guaranteed_after_loss')::boolean,
    true
  );

  if v_rare_soft_pity not between 1 and v_rare_pity - 1 then
    raise exception 'The 4-star soft pity must be below its hard pity';
  end if;
  if v_legendary_soft_pity not between 1 and v_legendary_pity - 1 then
    raise exception 'The 5-star soft pity must be below its hard pity';
  end if;
  if v_lightcone_soft_pity not between 1 and v_lightcone_pity - 1 then
    raise exception 'The Light Cone 5-star soft pity must be below its hard pity';
  end if;
  if v_featured_rate not between 0 and 100 then
    raise exception 'The featured-item rate must be between 0 and 100';
  end if;

  -- Temporarily reset existing soft pities to 1 so that updating hard pities
  -- in publish_gacha_configuration (v1) cannot violate soft pity check constraints
  -- when a shop lowers hard pities below previously stored soft pities.
  update public.gacha_settings settings
  set rare_soft_pity = 1,
      legendary_soft_pity = 1,
      lightcone_legendary_soft_pity = 1
  where settings.shop_id = p_shop_id;

  -- v2 validates rates and complete rarity pools, then atomically publishes
  -- the main configuration in this same transaction.
  perform public.publish_gacha_configuration_v2(
    p_shop_id,
    p_game_type,
    p_config
  );

  update public.gacha_settings settings
  set rare_soft_pity = v_rare_soft_pity,
      legendary_soft_pity = v_legendary_soft_pity,
      lightcone_legendary_soft_pity = v_lightcone_soft_pity,
      featured_item_rate = v_featured_rate,
      featured_guaranteed_after_loss = v_featured_guarantee
  where settings.shop_id = p_shop_id;
end;
$$;
