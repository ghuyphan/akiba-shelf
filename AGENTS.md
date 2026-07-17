# Akiba Shelf agent guide

This file is the working contract for future coding sessions in this repository. Read `README.md` and this file before making broad UI, data, or architecture changes.

## Product model

There are two connected experiences:

1. The customer storefront at `/`: browse merch, inspect details, add stock-limited quantities, create an order, scan VietQR, and wait for staff approval.
2. The admin workspace at `/admin`: monitor orders, confirm/cancel fulfilment, manage products, configure booth/payment details, and design the storefront.

Supabase is the source of truth. Catalog and order screens subscribe to Realtime changes. Do not replace server-authoritative stock or price checks with client-only logic.

Platform routes are `/`, `/auth`, `/auth/callback`, `/auth/set-password`, `/dashboard`, and `/dashboard/shops/new`; storefront/admin remain `/s/:shopSlug`, `/s/:shopSlug/play`, and `/admin`. Production requires SMTP/email confirmation, callback allow-list entries under the deployed base, and `PUBLIC_SITE_URL`. Preserve safe GitHub Pages deep-link restoration, deploy both Edge Functions explicitly, recommend CAPTCHA/Auth rate limits, and never direct end users to Supabase Dashboard.

## Non-negotiable database rules

- Use migrations in `supabase/migrations`; never silently change the production schema only through dashboard clicks.
- Preserve the `create_order` RPC contract. It validates the cart, locks product rows, reads current prices, and creates order records atomically.
- Never restore anonymous direct inserts into `orders` or `order_items`.
- Pending order creation reserves inventory. Confirmation finalizes the reservation without deducting again; cancellation and expiry restore inventory exactly once. Keep all terminal actions idempotent and security-definer functions tightly granted.
- Keep RLS and explicit grants least-privileged.
- Treat every `VITE_*` variable as public. Service-role, OAuth, VietQR, SMTP,
  and VAPID private credentials belong only in provider/Edge Function secrets.
- Before pushing linked migrations, compare local and remote migration history.
  Never use `--include-all` to paper over drift; reconcile applied versions and
  validate the resulting schema first.
- When the user asks to migrate or deploy database changes and this checkout is
  linked, use the linked project directly: review `migration list`, run a
  `db push --dry-run`, apply the pending migration with `db push`, then verify
  the remote schema and run the linked security/performance advisors. A local
  Supabase database is optional supplemental coverage, not a prerequisite or a
  blocker for a linked migration.
- When changing Supabase code or SQL, follow `.agents/skills/supabase/SKILL.md` and the Postgres best-practices skill. The `.agents/` directory is gitignored, so that skill file may be absent in fresh clones; the same migration knowledge also lives in `docs/` and the migration files themselves.

## UI and design language

- Overall feeling: polished independent artist booth, friendly rather than corporate.
- Main surfaces: white or near-white cards on a warm soft background.
- Typography: dark navy, strong hierarchy, short supporting copy.
- Primary actions: booth green; destructive actions: red; warnings: restrained amber.
- Badges, stock states, filters, and statuses are pill-shaped.
- Borders are light and shadows soft. Do not stack multiple heavy bordered containers.
- The Storefront Designer controls public theme colors, `--store-radius`, section order, and locale.
- Featured banner copy remains static when changing slides. Only the visual card deck should animate.
- Motion should be smooth and short, and must respect `prefers-reduced-motion` where practical.

## Responsive rules

- Treat 760px and below as phone layout, but collapse complex two-column admin layouts by roughly 1100px when their content needs it.
- Every grid child that may contain text needs `min-width: 0`.
- Never introduce a fixed height just to align cards if content can wrap or localize.
- Mobile controls require at least a comfortable touch target and centered icons.
- The shared interactive-element reset owns `-webkit-tap-highlight-color`.
  Do not reintroduce native blue tap flashes, and do not remove visible keyboard
  focus as part of touch styling.
- The mobile storefront hides the desktop booth-info sidebar card; booth information is available from the header modal.
- Sheets must animate both entrance and exit, remove their backdrop after closing, and restore body interaction.
- Test both product grid and list views after editing product-card CSS.

## CSS ownership

- `src/styles/global.css`: tokens, resets, shared buttons/fields/modal/alert/toast primitives only.
- `src/styles/catalog.css`: catalog page, product cards, featured banner, booth/cart/payment UI.
- `src/styles/admin.css`: admin header, login, product editor, orders, settings, designer.
- `src/styles/gacha-admin.css`: GachaManager admin workspace styles.
- `src/styles/gacha-entry.css`: storefront minigame entry UI in the catalog header.
- `src/styles/gacha-host.css`: `/s/:shopSlug/play` host page and simulator embeds.
- `src/styles/legacy.css`: compatibility layer. Avoid adding new rules here. When touching an old rule, prefer moving the final behavior into the screen-specific stylesheet.
- Follow `docs/legacy-css-migration.md`: move one ownership slice at a time,
  prove desktop/phone and grid/list behavior, then delete only the superseded
  legacy selectors. Do not perform a bulk selector move without visual coverage.
- Do not solve a screen-specific problem with a broad global selector.
- Prefer existing CSS variables over new hard-coded theme colors.

## Component conventions

- Route-level fetching and composition belong in `src/pages`.
- Reusable screen components belong in `components/admin` or `components/catalog`.
- Cross-screen primitives belong in `components/ui`.
- Keep Supabase calls in `src/lib/api.ts`, not inside presentational components.
- When you add or change a data path in `src/lib/api.ts` (new RPC, new table
  query, changed response shape), update the Playwright mock in
  `e2e/fixtures.ts` in the same change. Unmocked requests fall through to a
  catch-all that returns `[]`, which silently empties rendered lists and makes
  schema-parsed RPC responses crash the page under test.
- Keep shared domain types in `src/types/catalog.ts`.
- Use `useAsyncAction` for form busy/error state.
- Use `useToast()` for transient feedback:
  - `toast.success("Item saved.")`
  - `toast.error(message, "Could not save item")`
  - `toast.info(message, title)`
- Use inline `Alert` only when the message should remain attached to the current form or content region.
- Customer-facing interface strings must come from `catalogI18n.tsx`; update both `en` and `vi` entries together.

## Storefront designer

The designer persists these `booth_settings` fields:

- `layout_order`: permutation of `featured`, `booth`, `controls`, `cart`, `products`; wide and side modules retain fixed safe spans
- `corner_radius`: integer from 0 through 32
- `catalog_locale`: `en` or `vi`
- `card_style`: `soft`, `outlined`, `elevated`, or `playful`
- `featured_style`: `deck`, `editorial`, `minimal`, or `poster`
- `controls_style`: `panel`, `floating`, `compact`, or `playful`
- `product_style`: `classic`, `minimal`, `framed`, or `playful`
- existing theme color fields

Any new configurable storefront property needs:

1. a migration and constraint/default when appropriate;
2. a `BoothSettings` type update;
3. a safe default in `src/lib/constants.ts`;
4. a designer control and preview;
5. actual storefront consumption;
6. mobile verification.

## Verification checklist

Before handing off:

```bash
npm run check
git diff --check
```

When Edge Functions change, also run `npm run test:functions`. When dependencies
change, run `npm audit --omit=dev`. When data paths in `src/lib/api.ts` or
page-level flows change, also run `npm run test:e2e`. Preserve `:focus-visible`
behavior when verifying touch/highlight changes.

For database changes, validate migrations against the linked Supabase project
when this checkout is linked. When the user requested deployment, push and
verify the migration remotely without requiring a local Docker database. Use
local database tests as supplemental coverage when available. If the checkout
is not linked and no local database is available, report that clearly instead
of claiming deployment.

Visually check at minimum:

- desktop and phone storefront;
- featured swipe deck;
- product grid and list modes;
- product detail, cart sheet, confirmation, payment QR, and success modal;
- admin orders, products, designer, and settings;
- English and Vietnamese storefront copy;
- empty, sold-out, loading, success, and error states.

Preserve unrelated user changes in a dirty worktree. Use focused patches and avoid destructive Git commands.
