# Gacha invariants

Read only for gacha limits, publishing, rolling, fixtures, or simulator work.

Featured limits are defined in `src/lib/gacha/gachaGames.ts` and stay in sync
with `gachaLimits.ts`, publish RPC migrations/database tests, admin editor copy,
both vendored simulator assemblies, and e2e fixtures.

- HSR event banners: exactly one featured 5-star primary plus three featured
  4-star entries. Standard banners may leave all four slots empty. Character
  banners feature characters; Light Cone banners feature non-characters.
- Genshin character banners: exactly one featured 5-star character plus three
  featured 4-star characters.
- Genshin weapon banners: exactly two featured 5-star weapons plus five
  featured 4-star weapons.
- Generic Genshin fallback display maximum: five. Kind-specific display limits:
  four for character banners and seven for weapon banners.
- Overflow entries are un-featured by the host before publishing, never capped
  during rolls. Roll-time featured chance and guarantee-after-loss remain per
  banner and rarity.

For admin editor changes, also read `docs/gacha-admin-redesign.md`.
