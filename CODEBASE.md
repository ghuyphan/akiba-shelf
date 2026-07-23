# Matsuri codebase map

Use this file to find the right ownership slice quickly. Product/setup belongs
in `README.md`, mandatory rules in `AGENTS.md`, visual direction in `DESIGN.md`,
and production procedures in `docs/operations.md`.

## Architecture

```text
route page -> screen component / domain hook -> src/lib/api/* -> Supabase
                                      |              |
                                      |              +-> Zod schemas/types
                                      +-> offline cache / Realtime
```

- Pages compose route flows and fetch at route level.
- Components render screens and collect input.
- Hooks own reusable stateful behavior.
- `src/lib/api/` owns all remote data access.
- Migrations/RPCs remain authoritative for security and business rules.

## Routes

| Route               | Page                         | Copy               | Styles                                      |
| ------------------- | ---------------------------- | ------------------ | ------------------------------------------- |
| `/`                 | `HomePage.tsx`               | `platformI18n.tsx` | `styles/admin/admin.css`                    |
| `/auth*`            | Auth/callback/password pages | `platformI18n.tsx` | `styles/admin/admin.css`                    |
| `/dashboard*`       | Dashboard/new-shop pages     | `platformI18n.tsx` | `styles/admin/admin.css`                    |
| `/s/:shopSlug`      | `CatalogPage.tsx`            | `catalogI18n.tsx`  | `styles/catalog/`, `styles/gacha/entry.css` |
| `/s/:shopSlug/play` | `GachaPage.tsx`              | `catalogI18n.tsx`  | `styles/gacha/host.css`                     |
| `/admin`            | `AdminPage.tsx`              | `platformI18n.tsx` | `styles/admin/`, `styles/gacha/admin.css`   |

Entry points:

- `src/main.tsx`: deep-link restoration, cached theme, route prefetch, mount.
- `src/App.tsx`: lazy routes, providers, PWA, loading/error boundaries.
- `vite.config.ts`: PWA build and local simulator serving.

## Directory map

```text
src/
  components/admin/       Admin features: auth, dashboard, design, events,
                          gacha, orders, products, settings, shell, team;
                          shared holds admin-only cross-feature controls
  components/catalog/     Storefront features: browsing, cart, checkout,
                          overlays, shell, social
  components/gacha/host/  Public gacha host and selector presentation
  components/ui/          Shared primitives
  hooks/admin/             Admin session and order Realtime orchestration
  hooks/catalog/           Storefront, cart, and checkout orchestration
  hooks/shared/            Cross-feature UI and async behavior
  lib/api/                 Supabase/Storage/Edge Function domain modules
  lib/auth/                Auth routing, URLs, validation, safe errors
  lib/gacha/               Game rules, featured limits, launch handoff
  lib/i18n/                English/Vietnamese providers and dictionaries
  lib/offline/             PWA, caches, cart, checkout, event ledger
  lib/schemas.ts           Runtime validation
  lib/realtime.ts          Catalog and admin order subscriptions
  pages/                   Route composition
  styles/base/             Global tokens, resets, and shared primitives
  styles/admin/            Platform, auth, dashboard, and admin workspace CSS
  styles/catalog/          Storefront, product, cart, and checkout CSS
  styles/gacha/            Gacha admin, entry, and host CSS
  styles/legacy.css        Compatibility-only CSS pending incremental removal
  types/                   Shared catalog and gacha models
  utils/                   Pricing, theme, images, VietQR, formatting
e2e/                       Playwright specs and Supabase HTTP mock
scripts/                   Simulator/offline asset build scripts
supabase/functions/        Four independently deployed Edge Functions
supabase/migrations/       Ordered schema, RLS, grants, and RPC history
supabase/tests/database/   pgTAP behavior/security tests
vendor/                    Vendored Genshin and HSR SvelteKit simulators
docs/                      Operations, debt, and focused plans
public/                    PWA/deep-link assets and bank/brand files
```

Each non-legacy stylesheet entry is an ordered import manifest. See
`src/styles/README.md` before moving rules between fragments; import order is
part of the current cascade contract.

Ignored build/local output is not source of truth: `dist/`, `.gacha-dist/`,
`.hsr-gacha-dist/`, `.perf-dist/`, `coverage/`, `test-results/`,
`supabase/.temp/`, and `.agents/`.

## Data modules

`src/lib/api.ts` is a compatibility barrel only.

| Module                 | Ownership                                    |
| ---------------------- | -------------------------------------------- |
| `api/auth.ts`          | Credentials, OAuth, recovery, invitations    |
| `api/shops.ts`         | Public shops, memberships, workspace summary |
| `api/catalog.ts`       | Aggregated public/admin catalog loading      |
| `api/products.ts`      | Product normalization, queries, writes       |
| `api/settings.ts`      | Booth, payment, promotion settings           |
| `api/orders.ts`        | Checkout, recovery, queue, terminal actions  |
| `api/staff.ts`         | Team members and invitations                 |
| `api/storage.ts`       | Upload and safe image cleanup                |
| `api/gacha.ts`         | Draft/published config and publish contract  |
| `api/gachaPublic.ts`   | Focused public gacha availability reads      |
| `api/offlineEvents.ts` | Server event allocation and sync RPCs        |
| `api/push.ts`          | Push subscription registration               |
| `api/shared.ts`        | Shared API request and normalization helpers |

Supporting sources of truth:

- `src/types/catalog.ts`, `src/types/gacha.ts`: shared types.
- `src/lib/schemas.ts`: untrusted response/persisted-data parsing.
- `src/lib/constants.ts`: safe client defaults.
- `src/lib/catalogQueries.ts`: public product columns and local query behavior.
- `src/utils/pricing.ts`: presentation pricing; server checkout remains final.

When an API path changes, also inspect `e2e/fixtures.ts`, API contract tests,
schemas, and shared response types.

## Main flows

### Storefront

```text
CatalogPage
  -> getPublicShop(slug)
  -> useCatalogData(shopId, query, cart ids)
       -> useCatalogProducts()       paged/filterable products
       -> useStorefrontBootstrap()   booth, featured, categories, promotion
       -> cart product reconciliation
       -> catalog Realtime subscription
       -> offline snapshots as fallback
```

Payment settings load lazily when checkout becomes relevant. Cached shop,
theme, catalog, and cart state render offline and reconcile when online.

### Checkout

```text
PaymentQrModal / hooks/catalog/useCheckoutSession
  -> api/orders.createOrder()
  -> create-order Edge Function
  -> create_order_rate_limited RPC
  -> create_order database contract
  -> notify-new-order (best effort)
  -> customer status polling/recovery
```

### Admin

`hooks/admin/useAdminSession.ts` resolves Auth plus memberships and remembers
the selected shop in `akiba-active-shop`.
`components/admin/shell/AdminWorkspaceContent.tsx` maps tabs to:

- orders: `OrderQueue`
- event: `OfflineEventManager`
- products: `AdminProductsWorkspace`
- gacha: `GachaManager`
- design: `StorefrontDesigner`
- settings: `SettingsForm` and `QrManager`
- team: `StaffManager`

### Offline

| File                           | Responsibility                             |
| ------------------------------ | ------------------------------------------ |
| `offline/offline.ts`           | Shop/catalog/cart localStorage snapshots   |
| `offline/checkoutSession.ts`   | Recoverable checkout identity              |
| `offline/storefrontOffline.ts` | Complete storefront/image cache            |
| `offline/pwa.ts`               | Service worker, install, push              |
| `offline/offlinePack.ts`       | Simulator asset packs                      |
| `offline/adminOffline.ts`      | Cached access/order snapshots              |
| `offline/offlineEvents.ts`     | IndexedDB-first event session/order ledger |

### Gacha

```text
GachaManager -> api/gacha.ts -> publish RPC/migrations
GachaPage -> components/gacha/host -> gachaLaunch.ts -> simulator iframe
build scripts -> .gacha-dist/.hsr-gacha-dist -> dist simulator folders
```

Rules span the host, database, editors, tests, and both simulators. Use the full
coupling list in `AGENTS.md` before changing banner composition or roll logic.

## Task locator

| Task                  | Start                                         | Also inspect                                    |
| --------------------- | --------------------------------------------- | ----------------------------------------------- |
| Product/card UI       | `catalog/browsing/ProductCard.tsx`            | `styles/catalog/catalog.css`, grid/list tests   |
| Cart/payment          | `catalog/checkout/PaymentQrModal.tsx`         | checkout hook, orders API, storage, pricing     |
| Catalog fetching      | `hooks/catalog/useCatalogData.ts`             | products hook, API, Realtime, snapshots         |
| Admin shell           | `AdminPage.tsx`, `admin/shell/`               | header, permissions, admin CSS                  |
| Product/settings data | matching admin feature form                   | API module, types/defaults, migration, fixture  |
| Storefront designer   | `admin/design/StorefrontDesigner.tsx`         | checklist in `AGENTS.md`, theme, mobile preview |
| Auth/membership       | page/hook plus auth/shops API                 | auth helpers, callback tests, RPC/function      |
| Order lifecycle       | `api/orders.ts`                               | latest RPC migrations, database/function tests  |
| Offline/PWA           | relevant `lib/offline/*`                      | Vite PWA config, build scripts, offline tests   |
| Gacha admin           | `components/admin/gacha/GachaManager.tsx`     | focused plan and `styles/gacha/admin.css`       |
| Gacha limits          | `gachaGames.ts`, `gachaLimits.ts`             | publish SQL/tests, both simulators, fixtures    |
| UI copy               | correct i18n provider                         | English/Vietnamese parity tests                 |
| CSS migration         | owning stylesheet                             | `legacy.css` and migration plan                 |

## Database navigation

Migrations are layered history. Find every function/policy definition and read
the newest replacement plus later grants:

```bash
rg -n "create( or replace)? function public\.create_order" supabase/migrations
rg -n "publish_gacha_configuration" supabase/migrations
rg -n "create policy|grant |revoke " supabase/migrations
find supabase/migrations -maxdepth 1 -name '*.sql' | sort | tail
```

Edge Functions:

- `create-order`: request/rate boundary for checkout.
- `invite-shop-member`: owner invitation lifecycle.
- `notify-new-order`: push delivery and deduplication.
- `gacha-music-proxy`: origin-restricted HSR media proxy.

## Fast session loop

1. Run `git status --short` and preserve unrelated work.
2. Read the route/page and direct imports only.
3. Search the relevant API/RPC/table and tests with `rg`.
4. Check the coupling rules in `AGENTS.md`.
5. Patch one ownership slice and run focused tests.
6. Finish with the required verification from `AGENTS.md`.
