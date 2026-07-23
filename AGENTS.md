# Matsuri agent contract

Read this file before changing code. Use `CODEBASE.md` to locate ownership,
`DESIGN.md` for broad UI work, and `docs/operations.md` for deployment. Preserve
unrelated work in a dirty tree and use focused patches.

## Product invariants

- Supabase is the source of truth. Catalog and order screens use Realtime, but
  stock, price, promotion, membership, and payment decisions remain
  server-authoritative.
- Checkout must use the `create-order` Edge Function and the existing order RPC
  contract. Never restore anonymous direct inserts into `orders` or
  `order_items`.
- Pending order creation reserves inventory. Confirmation finalizes the same
  reservation; cancellation and expiry restore it exactly once. Terminal
  actions must remain idempotent.
- Normal offline support covers browsing, saved assets, cart persistence, and a
  queued checkout identity. It must not invent an order, payment, or stock
  reservation.
- Offline Event Mode is the only offline-sale exception. Stock is allocated
  online to one designated staff device before local sales begin. Sync is
  idempotent, payment remains staff-verified, and closing returns only unsold
  allocation.
- Owners manage team and catalog access; admins manage catalog/settings; staff
  process orders. Hidden controls are not an authorization boundary.

## Supabase and database

- Change schema, RLS, grants, functions, and policies only through a new file in
  `supabase/migrations/`. Never rely on Dashboard-only production edits.
- Enable RLS on exposed tables and grant Data API access explicitly and
  minimally. `TO authenticated` alone is not authorization; scope rows to the
  caller/shop. UPDATE policies need both `USING` and `WITH CHECK`.
- Treat `SECURITY DEFINER` as privileged API code. Use a safe `search_path`,
  verify the caller inside the function, revoke default/public execution, and
  grant only the intended roles.
- Preserve the `create_order` behavior: validate the cart, lock product rows in
  stable order, read current prices/promotions, reserve stock, and create order
  records atomically.
- Every `VITE_*` variable is public. Service-role, OAuth, SMTP, checkout salt,
  and VAPID private values belong in provider or Edge Function secrets.
- Before a linked deployment, compare migration history, run a dry-run, apply
  only pending migrations, verify the resulting schema, and run security and
  performance advisors. Never use `--include-all` to hide drift.
- A local Supabase database is supplemental when the checkout is linked. Do not
  block a requested linked deployment on Docker.
- For Supabase work, follow `.agents/skills/supabase/SKILL.md` and, for SQL or
  query/schema work, the Postgres best-practices skill. `.agents/` is ignored,
  so use migrations and `docs/operations.md` as the portable fallback.

## Deployment

- Production frontend hosting is the Cloudflare Pages project `matsuri`.
  `matsuri.pro` is the canonical application origin.
- `www.matsuri.pro` redirects permanently to the equivalent `matsuri.pro` URL
  through the active Cloudflare Redirect Rule `Canonical www to matsuri.pro`.
  Keep both DNS records proxied so the rule and Cloudflare certificates apply.
- Do not restore GitHub Pages deployment, `public/CNAME`, or the GitHub Pages
  SPA `404.html` fallback. GitHub Pages must not control the production domain.
- Normal production releases run from `main` through
  `.github/workflows/validate.yml` after all release gates pass. The workflow
  requires the `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` GitHub
  secrets; never commit provider credentials.
- Preserve the immutable-asset compatibility strategy in
  `scripts/retain-previous-assets.mjs`. Do not copy an unrestricted previous
  deployment into the new artifact.
- Follow `docs/operations.md` for Cloudflare setup, release verification,
  rollback, credential permissions, and any emergency manual deployment.

## Code ownership

- Route fetching and composition: `src/pages/`.
- Reusable admin/storefront sections: `src/components/admin/` and
  `src/components/catalog/`.
- Cross-screen primitives: `src/components/ui/`.
- Supabase reads, writes, RPCs, Storage calls, and Edge Function calls:
  `src/lib/api/`. `src/lib/api.ts` is exports only.
- Shared domain types: `src/types/catalog.ts` and `src/types/gacha.ts`.
- Runtime validation of remote/persisted data: `src/lib/schemas.ts`.
- Stateful async forms: `useAsyncAction`; transient feedback: `useToast()`;
  persistent form/content messages: `Alert`.
- Any changed data path under `src/lib/api/` requires matching review of
  `e2e/fixtures.ts`, API contract tests, schemas, and response types.

## Copy and UI

- Storefront and gacha-host copy belongs in
  `src/lib/i18n/catalogI18n.tsx`; platform, auth, dashboard, and admin copy
  belongs in `src/lib/i18n/platformI18n.tsx`. Update English and Vietnamese
  together.
- Follow `DESIGN.md`. Use existing tokens and patterns before introducing new
  ones. Keep checkout and fulfilment states calm and explicit.
- Treat 760px and below as phone layout. Collapse dense admin two-column layouts
  near 1100px when needed. Text-bearing grid/flex children need `min-width: 0`.
- Do not use fixed heights for content that can wrap/localize. Keep mobile touch
  targets comfortable and preserve `:focus-visible`.
- Sheets must animate entrance and exit, remove their backdrop after closing,
  restore body interaction, and handle safe-area insets.
- After product-card CSS changes, verify both grid and list modes. The mobile
  storefront keeps booth information in the header modal, not the desktop
  sidebar card.

CSS ownership:

- `global.css`: tokens, resets, shared buttons/fields/modal/alert/toast only.
- `catalog.css`: storefront, product, cart, checkout, and payment UI.
- `admin.css`: platform, auth, dashboard, and admin workspace.
- `gacha-admin.css`, `gacha-entry.css`, `gacha-host.css`: their named surfaces.
- `legacy.css`: compatibility only. Do not add new rules; follow
  `docs/legacy-css-migration.md` one slice at a time.

## Gacha invariants

Featured limits are defined in `src/lib/gacha/gachaGames.ts` and must stay in
sync with `gachaLimits.ts`, publish RPC migrations/database tests, admin editor
copy, both vendored simulator assemblies, and e2e fixtures.

- HSR event banners: exactly one featured 5-star primary plus three featured
  4-star entries. Standard banners may leave all four slots empty. Character
  banners feature characters; Light Cone banners feature non-characters.
- Genshin character banners: exactly one featured 5-star character plus three
  featured 4-star characters.
- Genshin weapon banners: exactly two featured 5-star weapons plus five
  featured 4-star weapons.
- The generic Genshin fallback display maximum remains five; kind-specific
  display limits are four for character and seven for weapon banners.
- Overflow entries are un-featured by the host before publishing, never capped
  during rolls. Roll-time featured chance and guarantee-after-loss remain per
  banner and rarity.

Use `docs/gacha-admin-redesign.md` when changing the admin editor.

## Storefront designer

Persisted `booth_settings` include layout order, corner radius, locale, theme
colors, and `card_style`, `featured_style`, `controls_style`, and
`product_style` variants.

Any new configurable storefront property requires:

1. migration plus constraint/default when appropriate;
2. shared type and runtime schema update;
3. safe default in `src/lib/constants.ts`;
4. designer control and preview;
5. storefront consumption;
6. desktop and phone verification.

## Verification

Always finish with:

```bash
npm run check
git diff --check
```

Also run:

- `npm run test:e2e` for API data paths or page-level flows;
- `npm run test:functions` for Edge Functions;
- `npm audit --omit=dev` for dependency changes;
- database tests plus linked history/dry-run/advisors for migration work.

For meaningful UI changes, visually verify desktop and phone, English and
Vietnamese, loading/empty/error/success states, keyboard focus, and the affected
grid/list, modal, sheet, or admin workflow.
