`src/styles/legacy.css` and all intermediate `legacy-compat.css` files have been fully migrated and retired. All shared foundations,
controls, and route surfaces are now owned directly by their respective modular stylesheets within:
`src/styles/base/`, `src/styles/admin/`, `src/styles/catalog/`, and `src/styles/gacha/`. Do not reintroduce
`legacy.css` or `legacy-compat.css`.

## Architecture & Ownership

- `src/styles/base/global.css`: import manifest for tokens, reset, typography,
  shared controls, overlays, feedback, and accessibility states.
- `src/styles/catalog/catalog.css`: import manifest for storefront layout, browsing,
  featured deck, products, booth, cart, checkout, and payment fragments.
- `src/styles/admin/admin.css`: import manifest for platform, auth, dashboard,
  navigation, workspace, settings, team, and designer fragments.
- `src/styles/gacha/`: `admin.css` and `host.css` are import manifests;
  `entry.css` owns the small storefront gacha entry surface directly.

Manifest order is part of the current cascade contract. Do not alphabetize
imports or load individual fragments from components.
