-- Table RLS remains responsible for authorizing the resulting write. This
-- private trigger only normalizes NEW and performs no database writes.
-- Owner execution is required because clients cannot call the canonicalizer.
alter function private.canonicalize_gacha_game_config_row()
security definer;

alter function private.canonicalize_gacha_game_config_row()
set search_path = '';

-- jsonb_build_object is STABLE, so the helper must not overstate volatility.
alter function private.canonicalize_gacha_configuration(uuid, text, jsonb)
stable;

revoke all on function private.canonicalize_gacha_game_config_row()
from public, anon, authenticated;

revoke all on function private.canonicalize_gacha_configuration(uuid, text, jsonb)
from public, anon, authenticated;
