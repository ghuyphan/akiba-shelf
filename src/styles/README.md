# Styles

Application code imports only the ownership entry files, never fragments:

- `base/global.css`: ordered shared foundations and reusable primitives.
- `admin/admin.css`: platform, auth, dashboard, and admin workspaces.
- `catalog/catalog.css`: storefront, products, cart, checkout, and overlays.
- `gacha/admin.css`: gacha editor.
- `gacha/entry.css`: storefront gacha entry point.
- `gacha/host.css`: gacha launch host.
- `legacy.css`: compatibility rules pending incremental removal.

The entry files are import manifests. Their order is part of the cascade
contract, so add a rule to the owning fragment and do not alphabetize imports.
Late `overrides/` and refinement files intentionally remain late until visual
coverage supports consolidating repeated selectors.

Load entries at their route or top-level feature boundary. Keeping one entry per
surface prevents route-dependent import order from changing which rule wins.

When moving CSS between fragments, compare the affected desktop and phone
surfaces before and after, then run the checks in `AGENTS.md`.
