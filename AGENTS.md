# Akiba Shelf agent guide

This file is the working contract for future coding sessions in this repository. Read `README.md` and this file before making broad UI, data, or architecture changes.

## Product model

There are two connected experiences:

1. The customer storefront at `/`: browse merch, inspect details, add stock-limited quantities, create an order, scan VietQR, and wait for staff approval.
2. The admin workspace at `/admin`: monitor orders, confirm/cancel fulfilment, manage products, configure booth/payment details, and design the storefront.

Supabase is the source of truth. Catalog and order screens subscribe to Realtime changes. Do not replace server-authoritative stock or price checks with client-only logic.

Platform routes are `/`, `/auth`, `/auth/callback`, `/auth/set-password`, `/dashboard`, and `/dashboard/shops/new`; storefront/admin remain `/s/:shopSlug` and `/admin`. Production requires SMTP/email confirmation, callback allow-list entries under the deployed base, and `PUBLIC_SITE_URL`. Preserve safe GitHub Pages deep-link restoration, deploy both Edge Functions explicitly, recommend CAPTCHA/Auth rate limits, and never direct end users to Supabase Dashboard.

## Non-negotiable database rules

- Use migrations in `supabase/migrations`; never silently change the production schema only through dashboard clicks.
- Preserve the `create_order` RPC contract. It validates the cart, locks product rows, reads current prices, and creates order records atomically.
- Never restore anonymous direct inserts into `orders` or `order_items`.
- Pending order creation reserves inventory. Confirmation finalizes the reservation without deducting again; cancellation and expiry restore inventory exactly once. Keep all terminal actions idempotent and security-definer functions tightly granted.
- Keep RLS and explicit grants least-privileged.
- When changing Supabase code or SQL, follow `.agents/skills/supabase/SKILL.md` and the Postgres best-practices skill.

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
- The mobile storefront hides the desktop booth-info sidebar card; booth information is available from the header modal.
- Sheets must animate both entrance and exit, remove their backdrop after closing, and restore body interaction.
- Test both product grid and list views after editing product-card CSS.

## CSS ownership

- `src/styles/global.css`: tokens, resets, shared buttons/fields/modal/alert/toast primitives only.
- `src/styles/catalog.css`: catalog page, product cards, featured banner, booth/cart/payment UI.
- `src/styles/admin.css`: admin header, login, product editor, orders, settings, designer.
- `src/styles/legacy.css`: compatibility layer. Avoid adding new rules here. When touching an old rule, prefer moving the final behavior into the screen-specific stylesheet.
- Do not solve a screen-specific problem with a broad global selector.
- Prefer existing CSS variables over new hard-coded theme colors.

## Component conventions

- Route-level fetching and composition belong in `src/pages`.
- Reusable screen components belong in `components/admin` or `components/catalog`.
- Cross-screen primitives belong in `components/ui`.
- Keep Supabase calls in `src/lib/api.ts`, not inside presentational components.
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
npm run build
git diff --check
```

For database changes, also validate migrations against a local or linked Supabase project when available. If the checkout is not linked or the local database is unavailable, report that clearly instead of claiming deployment.

Visually check at minimum:

- desktop and phone storefront;
- featured swipe deck;
- product grid and list modes;
- product detail, cart sheet, confirmation, payment QR, and success modal;
- admin orders, products, designer, and settings;
- English and Vietnamese storefront copy;
- empty, sold-out, loading, success, and error states.

Preserve unrelated user changes in a dirty worktree. Use focused patches and avoid destructive Git commands.
