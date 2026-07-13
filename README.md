# Akiba Shelf

Akiba Shelf is a touch-friendly merch booth storefront and admin workspace. Customers browse products, build a stock-safe cart, create an order, scan a VietQR payment code, and wait for staff confirmation. Staff manage products, fulfilment, payment settings, booth information, and the public storefront design.

## Main features

- Multi-shop storefronts at `/s/:shopSlug`, with `/` preserving the default Akiba Shelf link.
- Responsive storefront with featured-product swipe deck, grid/list browsing, product details, and mobile cart sheet.
- Server-authoritative ordering: totals and stock are validated inside the `create_order` Postgres function.
- VietQR payment flow with live order confirmation.
- Realtime catalog and order updates through Supabase.
- Role-authorized staff workspace for orders, products, booth/payment settings, and storefront design.
- Storefront designer with drag-and-drop ordering of the real featured, booth, controls, cart, and product modules; fixed safe grid spans; theme colors; corner radius; and English/Vietnamese UI.
- Shared queued toast system through `useToast()`.

## Stack

- React 19, TypeScript, Vite
- React Router
- Supabase Auth, Postgres, Storage, and Realtime
- Lucide icons and `qrcode`

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Required frontend variables:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-or-anon-key
VITE_VAPID_PUBLIC_KEY=your-public-vapid-key
```

Never commit `.env.local` or service-role credentials.

## PWA and Android order notifications

The storefront/admin app includes a service worker and installable manifest. The installed app name, browser title, theme color, and favicon follow the current booth settings and logo.

To enable background order notifications:

1. Apply `supabase/migrations/20260711100000_add_web_push_subscriptions.sql`.
2. Generate a VAPID key pair, put the public key in `VITE_VAPID_PUBLIC_KEY`, and configure the Edge Function secrets:

```bash
npx supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:you@example.com
npx supabase functions deploy notify-new-order
```

3. Install the PWA on the Android device, sign into admin, and tap **Enable alerts**. Push requires HTTPS in production.

Production verification:

```bash
npm run build
git diff --check
```

## Routes

- `/` — platform homepage
- `/auth`, `/auth/callback`, `/auth/set-password` — account, confirmation, invitation, and recovery lifecycle
- `/dashboard`, `/dashboard/shops/new` — shop selection and creation
- `/s/:shopSlug` — shop-specific customer storefront
- `/admin` — authenticated admin workspace

Production Auth must use the deployed app URL as its Site URL and allow `<app-base>/auth/callback` and `<app-base>/auth/set-password`. GitHub Pages uses `/akiba-shelf/`; its 404 redirect preserves safe relative routes, queries, and Auth fragments. Configure SMTP and email confirmation, set `PUBLIC_SITE_URL` to the exact public app base, and deploy both `invite-shop-member` and `notify-new-order`. CAPTCHA and conservative Auth rate limits are recommended. End users never need Supabase Dashboard access.

## Project structure

```text
src/
  components/admin/       Admin-only components
  components/catalog/     Storefront-only components
  components/ui/          Shared primitives, toast provider, modal, fields
  hooks/                  Reusable stateful behavior
  lib/                    Supabase API, theme, i18n, formatting, validation
  pages/                  Route-level composition
  styles/global.css       Tokens and genuinely shared primitives
  styles/catalog.css      Storefront-only layout and responsive rules
  styles/admin.css        Admin-only layout and responsive rules
  styles/legacy.css       Compatibility rules awaiting gradual removal
  types/catalog.ts        Shared domain models
supabase/migrations/      Ordered database migrations
```

## Data model and ordering

Core tables:

- `products` — catalog listing, images, price, availability, badges, and ordering.
- `booth_settings` — booth identity, public theme, section order, radius, and locale.
- `payment_settings` — VietQR/bank configuration and customer instructions.
- `orders` — customer order header and status.
- `order_items` — immutable product quantities and unit prices for each order.

The browser cannot directly insert orders or order items. `createOrder()` calls the `create_order` RPC, which locks requested product rows, rejects inactive/sold-out/insufficient stock, calculates the total from database prices, creates the order atomically, and immediately reserves inventory. Confirmation finalizes that reservation without deducting stock again. Customer/staff cancellation and expiry restore reserved stock exactly once. Customer recovery requires both the order ID and its recovery token; only the token hash is stored.

Apply migrations in filename order. For a linked project:

```bash
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

Create a Supabase Auth user and sign into `/admin`. A user with no memberships can create the first shop and becomes its owner atomically. Existing `staff_members` are migrated into the deterministic `akiba-shelf` shop.

Staff invitations require deploying the owner-only Edge Function and setting its public redirect origin:

```bash
npx supabase secrets set PUBLIC_SITE_URL=https://your-store.example
npx supabase functions deploy invite-shop-member
```

Configure Supabase Auth Site URL/Redirect URLs and SMTP email delivery for production invitations. The service-role key is provided only to the Edge Function runtime and must never be exposed through Vite.

Do not add an automatic auth-user trigger. Owners may manage staff; admins manage the catalog/settings; staff may view and process orders only. Anonymous users may read the active catalog and required public checkout settings, call safe order creation, and recover/cancel only with the matching order ID and recovery token.

## Deployment boundaries

- Frontend: build with the three documented `VITE_*` values, then deploy `dist/`.
- Database: review and apply `supabase/migrations` in order with `supabase db push`; pull requests never deploy schema.
- Edge Function: deploy `notify-new-order` separately after migrations.
- Secrets: set VAPID private material only with `supabase secrets set`; never expose it through Vite variables.

## UI architecture

The public theme is generated by `getThemeStyle()` and exposed through CSS variables such as `--coral`, `--accent`, `--page-bg`, and `--store-radius`. The admin Storefront Designer persists those values in `booth_settings`; the storefront consumes them on reload and through Realtime.

Customer-facing translations live in `src/lib/catalogI18n.tsx`. Use `useCatalogCopy()` in catalog components instead of embedding new English-only interface text.

Transient notifications use `useToast()` from `ToastProvider`. Use `toast.success`, `toast.error`, or `toast.info`; use the `Alert` component only for errors or notices that belong inside a form or page section.

## Design direction

- Warm, friendly booth character with clean white surfaces and muted peach page background.
- Dark navy typography, green primary actions, restrained yellow accents.
- Pill-shaped statuses and badges.
- Large tap targets and compact information hierarchy on mobile.
- Motion should explain state changes. Keep copy static; animate cards, sheets, and state transitions subtly.
- Mobile must not depend on hover, fixed desktop heights, or horizontally clipped two-column layouts.

See `AGENTS.md` for implementation conventions and the handoff guide for future coding sessions.
