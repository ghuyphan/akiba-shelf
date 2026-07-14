# Repository review — 2026-07-14

This review covered the React application, Supabase migrations and Edge
Functions, browser storage and service-worker boundaries, responsive CSS,
tests/CI, and production dependencies.

## Resolved in this pass

- Removed dead VietQR API code that referenced a `VITE_*_CLIENT_SECRET`. All
  `VITE_*` values are public, so VietQR now uses only its public image URL.
- Restricted `notify-new-order` browser CORS to `PUBLIC_SITE_URL`, validated
  method/origin/body/order identifiers, stopped returning raw internal errors,
  and added Edge Function request tests.
- Constrained push-notification click URLs to the service worker's own origin.
- Disabled the native mobile tap highlight for links, buttons, role-buttons,
  summaries, form controls, and associated labels without removing keyboard
  `:focus-visible` behavior; added a phone browser regression test.
- Reduced offline pending-order reconciliation from every 2.5 seconds to every
  15 seconds. Online reconciliation remains five seconds and still reacts
  immediately to reconnect, focus, and visibility changes.
- Removed duplicated fixed/scrolling option rendering from `SelectMenu` while
  preserving its keyboard navigation and tests.
- Added VietQR URL, encoding, length-limit, and incomplete-configuration tests.
- Reconciled all 20 verified production migration versions without replaying
  historical SQL, then deployed `20260714033844_address_database_advisors.sql`.
- Added five foreign-key indexes, removed a superseded queue index and duplicate
  invitation index, and split admin mutation policies so authenticated SELECTs
  evaluate one permissive policy per table.
- Added an explicit service-role-only notification-event policy while keeping
  browser roles deny-all.
- Reran production advisors and cleared every uncovered-foreign-key, duplicate
  policy, duplicate index, and policyless-table result.
- Deployed both Edge Functions with exact Supabase client versions. Production
  preflight now returns `Access-Control-Allow-Origin: https://matsuri.pro`.

## Verified strengths

- Order totals, stock checks, reservation, confirmation, cancellation, and
  expiry are server-authoritative and transactionally implemented.
- Current security-definer functions use explicit empty `search_path` values;
  sensitive functions are revoked from broad roles and selectively granted.
- RLS is enabled on exposed operational tables. Public projections grant named
  columns instead of automatically exposing future columns.
- Tenant query and policy columns have purpose-built indexes, including product,
  order, membership, invitation, and notification paths.
- Service-role usage is confined to Edge Functions and integration tests.
- Routes are code-split, product images use bounded runtime caching, and the
  catalog already uses `content-visibility` for off-screen cards.
- Production `npm audit --omit=dev --audit-level=moderate` reported zero known
  vulnerabilities during this review.
- CI covers type/lint/format/unit/build, local Supabase database tests, Edge
  Function tests, database concurrency integration, browser E2E, and deployment.

## Operational follow-ups

1. Supabase Auth leaked-password protection remains disabled because it requires
   the Pro plan. This is an accepted Free-plan limitation; reconsider it when the
   project upgrades. The CLI does not expose this individual hosted Auth toggle.
2. Execute the incremental stylesheet work in
   [`legacy-css-migration.md`](legacy-css-migration.md). `legacy.css` remains the
   largest simplification opportunity; broad movement without visual baselines
   would carry more regression risk than benefit.
3. Consider replacing full product-list refreshes after single-item admin
   mutations with RPC/select responses once equivalent RLS-safe projections and
   cache invalidation tests exist. The current behavior is correct but performs
   avoidable reads on large catalogs.
4. Schedule dependency upgrades in isolated changes. The audit found no known
   production vulnerabilities, but `npm outdated` reports a small Supabase patch
   update plus major-version upgrades for Vite/Vitest, ESLint, TypeScript,
   Lucide, and related tooling. Do not combine those majors with UI or database
   work; upgrade one toolchain group at a time and run the full browser suite.

## Required release gate

Run `npm run check`, `npm audit --omit=dev --audit-level=moderate`,
`npm run test:functions`, database tests for migration changes, and
`git diff --check`. Verify desktop and phone storefronts, grid/list, featured
deck, checkout/payment/success, admin orders/products/designer/settings, both
locales, and empty/sold-out/loading/error states.

For this review, both Edge Function suites were executed with an ephemeral Deno
runner: 13 tests passed.

The remaining advisor notices are reviewed exceptions, not uncovered access:
the public checkout functions validate unguessable recovery credentials, and
authenticated SECURITY DEFINER functions validate shop roles or invitation
ownership internally. Newly created indexes can appear as unused until normal
production traffic exercises them; do not remove fresh foreign-key or
tenant-query indexes based only on zero-scan startup statistics.
