# Akiba Shelf - Current Architecture Audit and Remaining Work

Updated: 2026-07-21
Historical baseline: `docs/audit-2026-07-17.md`

This is the live audit tracker. The 2026-07-17 audit remains unchanged as the
historical baseline; this file records what has been completed, the current
architecture assessment, and the next implementation phases.

## Current assessment

The application now has a sound offline-first architecture for a
stock-limited storefront:

- Browsing, searching, filtering, cart preparation, saved shop data, and
  checkout recovery can work offline.
- Final order creation remains online-only and server-authoritative. Product
  rows are locked and current prices, promotions, and inventory are validated
  by the `create_order` RPC.
- The client does not fabricate successful offline orders or payments.
- Reconnecting checkout sessions reuse their client request ID and recovery
  token, preserving the database idempotency contract.

The intended product promise is therefore **offline-first browsing and cart
preparation with online-required stock reservation**, not fully offline order
creation.

## Status dashboard

| Area | Status | Current position |
|---|---|---|
| Offline storefront | Good | Versioned snapshots, local queries, persistent cart, and offline asset packs are implemented. |
| Checkout correctness | Good | Versioned recovery states replace synthetic offline orders; final reservation remains server-authoritative. |
| Realtime | Good | Storefront subscription lifetime is tied to the shop instead of cart/query changes. |
| Database migrations | Deployed | Local and linked histories match; linked dry-run reports the remote database is up to date. |
| API architecture | Needs refactor | `src/lib/api.ts` remains a 1,476-line, 55-export module spanning unrelated domains. |
| Admin architecture | Partial | `GachaManager` was reduced substantially; `AdminPage` remains a large orchestration component. |
| Accessibility | Partial | Important interaction fixes are present, but four jsx-a11y rules remain disabled. |
| CSS ownership | Partial | Screen ownership is documented, but `legacy.css` remains large and must be migrated incrementally. |
| Frontend verification | Good | The latest full gate passed 142 unit tests and the application/simulator builds; Playwright passed 67 tests with 3 skipped. |
| Database test coverage | Partial | Linked lint/advisors ran, but local pgTAP was unavailable because Docker was not running. |

## Completed since the baseline audit

### Offline-first and checkout

- Added complete/partial catalog snapshot semantics so a filtered or paged
  response cannot silently replace a complete offline catalog.
- Added local catalog searching, sorting, filtering, and pagination.
- Added bounded offline asset downloads and retained saved storefront/gacha
  packs.
- Added a versioned checkout-session state model: `queued`, `needs_review`,
  `reserved`, `confirmed`, `cancelled`, and `expired`.
- Migrated legacy synthetic offline orders back to a queued state that must be
  verified by the server.
- Removed synthetic offline payment/order completion paths.
- Kept authoritative inventory, pricing, promotion, and reservation logic in
  Postgres.

### Reliability and performance

- Added route-level and catalog-level error boundaries.
- Stabilized storefront Realtime subscriptions with latest-value refs.
- Reused loaded products when reconciling cart items and fetched only missing
  product IDs.
- Replaced full-catalog image-reference checks with targeted overlap queries.
- Centralized lightweight-network detection.
- Removed the previously identified dead catalog component cluster and the
  duplicate swipe-confirm implementation.

### Structure and testing

- Reorganized auth, gacha, i18n, offline, and utility helpers into clearer
  domain folders.
- Reduced `GachaManager.tsx` from roughly 1,933 lines to roughly 956 lines.
- Added/expanded component, offline, catalog-query, error, and Playwright
  coverage.
- Added current route-level PWA and gacha documentation to the repository
  guide.

## Database and migration state

The following migrations are present in the linked project's migration
history:

- `20260720074500_fix_gacha_publish_soft_pity_order.sql`
- `20260720080000_allow_gacha_publish_without_3star.sql`

Verification completed on 2026-07-21:

- `npx supabase migration list --linked`: local and remote histories match.
- `npx supabase db push --linked --dry-run`: remote database is up to date.
- The publish chain remains `v5 -> v4 -> v3 -> v2 -> v1`.
- Lowering hard pity below previously stored soft pity is handled inside one
  transaction.
- A custom 3-star pool is no longer required; built-in shared souvenirs are
  the fallback.
- Only the current `publish_gacha_configuration_v5` entry point is granted to
  authenticated clients; internal publish versions remain revoked.

Immediate repository risk: both deployed migration files are currently
untracked in this worktree. They must be committed so a fresh checkout can
reproduce the remote migration history.

Database follow-up:

1. Add a pgTAP regression that publishes an enabled configuration containing
   active 4-star and 5-star entries but no custom 3-star entry.
2. Run the database suite when Docker is available. `npm run test:db` currently
   also assumes a locally installed `supabase` executable; use or standardize
   `npx supabase` for a portable repository command.
3. Add a new migration, rather than editing applied history, to explicitly
   initialize the original publish RPC arrays as typed `uuid[]` and `text[]`.
4. Enable Supabase Auth leaked-password protection.
5. Continue reviewing advisor warnings for exposed `SECURITY DEFINER` RPCs.
   The current order and gacha entry points are intentionally exposed and
   perform authorization/token validation internally.

## Current priority backlog

### P0 - preserve deployed state and regression coverage

1. Commit the two already-deployed migration files.
2. Add the missing no-custom-3-star pgTAP regression.
3. Run the database suite when Docker is available and record the result.

### P1 - structural maintainability

1. Split `src/lib/api.ts` by domain using the phased plan below.
2. Extract admin state/orchestration from `AdminPage.tsx` into focused hooks.
3. Move the direct password-completion RPC out of `SetPasswordPage.tsx`.
4. Move admin order Realtime channel ownership out of `AdminPage.tsx`.
5. Continue splitting `GachaManager` by editor section where responsibilities
   remain coupled.

### P1 - accessibility enforcement

Regenerate the warning inventory before resuming because the old line-level
list is stale. The following rules are still disabled in `eslint.config.js`:

- `jsx-a11y/no-autofocus`
- `jsx-a11y/label-has-associated-control`
- `jsx-a11y/click-events-have-key-events`
- `jsx-a11y/no-static-element-interactions`

Re-enable them as warnings, fix one interaction category at a time, then move
them to errors when the warning count reaches zero.

### P2 - CSS and tooling

1. Continue `legacy.css` migration one ownership slice at a time, following
   `docs/legacy-css-migration.md` and verifying desktop/phone plus product
   grid/list views after every slice.
2. Route-split admin-only CSS where it can be done without changing screen
   behavior.
3. Add database lint and production dependency audit to CI.
4. Add coverage thresholds incrementally.
5. Add WebKit Playwright coverage for the iPad-oriented target.
6. Document vendored simulator patches and lockfile ownership.

### P3 - optional optimization

- Dynamically import `qrcode` when the social QR surface opens.
- Compress bank-logo assets for their rendered dimensions.
- Add snapshot-age UI while offline.
- Add storage quota/eviction feedback for very large saved shops.
- Replace remaining translated `window.confirm` flows with accessible in-app
  confirmation surfaces.

## API refactor decision

The API should be split. The objective is ownership and testability, not a
generic repository abstraction. Supabase queries should remain explicit.

Current characteristics:

- `src/lib/api.ts`: 1,476 lines and 55 exports.
- Responsibilities include catalog, products, storage, settings, gacha, auth,
  shops, staff, invitations, checkout, and order fulfilment.
- More than 20 components/hooks/pages import the public module.
- Playwright mirrors its request paths in `e2e/fixtures.ts`.
- Response validation is inconsistent: some paths use schemas while others
  rely on casts.

The first refactor must be behavior-neutral. Do not combine module movement
with RPC renaming, query optimization, grant changes, or response-shape
changes.

### Target structure

```text
src/lib/api/
  shared.ts
  auth.ts
  shops.ts
  staff.ts
  orders.ts
  products.ts
  storage.ts
  settings.ts
  catalog.ts
  gacha.ts

src/lib/api.ts       # stable compatibility barrel
```

Shared domain models remain in `src/types/catalog.ts`. Query-only types should
stay close to their domain module or existing query helper; do not create a
second domain-type hierarchy inside `lib/api`.

Dependency direction:

```text
types / schemas / constants
            |
       api/shared
            |
      domain modules
            |
       api.ts barrel
            |
  hooks / pages / components
```

Domain modules must import one another directly, never through the barrel.
`gacha.ts` may depend on product hydration from `products.ts`; products must
not depend on gacha. `catalog.ts` may compose products and settings.

## Phased API refactor plan

### Phase 0 - contract coverage

- Add characterization tests for `createOrder`, customer recovery, order
  status counts, gacha publish payloads, and public product normalization.
- Record the existing RPC/table paths represented by `e2e/fixtures.ts`.
- Establish a green `npm run check` and `npm run test:e2e` baseline.

Exit gate: production code has not moved and all existing contracts are
covered sufficiently to detect accidental request changes.

### Phase 1 - shared foundation

- Extract only primitive response helpers and shared Edge Function error
  handling into `api/shared.ts`.
- Keep product, order, gacha, and settings normalization inside their domains.
- Convert `src/lib/api.ts` into a gradual compatibility barrel as modules move.

Exit gate: no consumer import changes and no Supabase request changes.

### Phase 2 - auth, shops, and staff

- Move sign-in, Google auth, sign-out, and password-completion operations into
  `auth.ts`.
- Move public shop, memberships, workspace summary, create-shop, and
  update-shop operations into `shops.ts`.
- Move staff membership and invitation operations into `staff.ts`.
- Remove the direct RPC call from `SetPasswordPage.tsx`.

Exit gate: auth/pages contain no direct database calls; auth, dashboard, and
invitation tests pass.

### Phase 3 - orders

- Move order creation, recovery, listing, counts, confirmation, staff
  cancellation, and customer cancellation into `orders.ts`.
- Preserve the exact `create_order` parameters and idempotency behavior.
- Add explicit response parsing where it can be introduced without changing
  the public return shape.

Exit gate: payment modal, order queue, checkout Playwright, and recovery tests
pass; fixture request paths remain synchronized.

### Phase 4 - products, storage, and settings

- Move public/admin product queries and product normalization into
  `products.ts`.
- Move generic uploads, product image uploads, and unreferenced-image cleanup
  into `storage.ts`.
- Move booth, payment, and promotion settings into `settings.ts`.
- Preserve private storage-path protections and narrowed public column lists.

Exit gate: no expanded grants, no `select('*')`, image cleanup remains
reference-safe, and admin/storefront tests pass.

### Phase 5 - catalog

- Move catalog bootstrap composition, pagination, featured products,
  categories, and offline-compatible public query boundaries into
  `catalog.ts`.
- Compose `products.ts` and `settings.ts` rather than duplicating queries.
- Preserve complete/partial snapshot semantics and targeted Realtime refreshes.

Exit gate: storefront bootstrap and offline fallback behave identically and
every data path remains mocked in `e2e/fixtures.ts`.

### Phase 6 - gacha

- Move settings/banner/entry normalization, published catalog hydration,
  draft loading/saving, and publish payload construction into `gacha.ts`.
- Keep featured caps and per-game defaults synchronized with the existing
  gacha domain helpers and database RPC.
- Continue calling only `publish_gacha_configuration_v5` from the frontend.

Exit gate: Genshin/HSR tests pass, publish payload behavior is unchanged, and
the database gacha regressions pass.

### Phase 7 - Realtime boundary

- Keep channel construction and cleanup in `src/lib/realtime.ts`.
- Add an admin order Realtime hook that owns React lifecycle and latest-value
  refs.
- Remove direct channel construction from `AdminPage.tsx`.

Exit gate: the channel lifetime is tied to shop ID, pagination/filter changes
do not recreate it, and cleanup works on logout/shop change.

### Phase 8 - cleanup and final verification

- Reduce `src/lib/api.ts` to compatibility exports only.
- Split the existing API test file into domain test files.
- Remove unused helpers and check for circular dependencies.
- Confirm pages and presentational components contain no direct Supabase data
  access.

Final gates:

```bash
npm run check
npm run test:e2e
git diff --check
npx supabase db lint --linked --schema public,private --fail-on none
npx supabase db advisors --linked --type all --level warn --fail-on none
```

Target outcome:

- `src/lib/api.ts` is a small compatibility barrel.
- No API domain module exceeds roughly 400-500 lines without a documented
  reason.
- Existing public imports remain compatible during the migration.
- Query and RPC behavior changes are reviewed separately from file movement.
