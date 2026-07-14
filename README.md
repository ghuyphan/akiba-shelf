# Matsuri

Matsuri is a touch-friendly storefront and live order platform for independent artist booths. Customers browse products, build a stock-safe cart, create an order, scan VietQR, and wait for staff confirmation. Staff manage products, fulfilment, payment settings, booth information, and each shop's public design.

## Main features

- Multi-shop storefronts at `/s/:shopSlug`, with Matsuri platform pages kept separate from individual shop branding.
- Responsive storefront with featured-product swipe deck, grid/list browsing, product details, and mobile cart sheet.
- Server-authoritative ordering: totals and stock are validated inside the `create_order` Postgres function.
- VietQR payment flow with live order confirmation.
- Realtime catalog and order updates through Supabase.
- Role-authorized staff workspace for orders, products, booth/payment settings, and storefront design.
- Storefront designer with drag-and-drop ordering of the real featured, booth, controls, cart, and product modules; fixed safe grid spans; editable palette presets; card personality; corner radius; and English/Vietnamese UI.
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

Every `VITE_*` value is compiled into public browser JavaScript. Never put a
service-role key, OAuth client secret, VietQR API secret, VAPID private key, or
other credential in a `VITE_*` variable. Matsuri generates VietQR images from
the public image endpoint and does not require a browser-side VietQR API key.
Never commit `.env.local` or service-role credentials.

## PWA and Android order notifications

The storefront/admin app includes a service worker and installable manifest. Installed-app branding always uses Matsuri; browser title, theme color, and favicon use a verified shop identity only on shop-owned routes.

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

Production Auth must use the deployed app URL as its Site URL (`https://matsuri.pro`) and allow `/auth/callback` and `/auth/set-password`. Its 404 redirect preserves safe relative routes, queries, and Auth fragments. Configure SMTP and email confirmation, set `PUBLIC_SITE_URL` to `https://matsuri.pro`, and deploy both `invite-shop-member` and `notify-new-order`. CAPTCHA and conservative Auth rate limits are recommended. End users never need Supabase Dashboard access.

### Google sign-in

The account and staff login screens use Supabase's Google OAuth provider. Configure it once for each Supabase project:

1. In Google Auth Platform, configure the consent screen with the `openid`, `userinfo.email`, and `userinfo.profile` scopes.
2. Create a **Web application** OAuth client. Add the app origins under **Authorized JavaScript origins**:
   - `https://matsuri.pro` (Production)
   - `http://127.0.0.1:5173` (Local Development)
3. Under **Authorized redirect URIs**, add the Supabase Auth callback shown on the project's Google provider page: `https://kicvenppgjvzqpyagdih.supabase.co/auth/v1/callback`. For local Supabase, also add `http://127.0.0.1:54321/auth/v1/callback`. (Do NOT add the application callback `https://matsuri.pro/auth/callback` here; Google redirects to Supabase's API endpoint, not directly to the application).
4. In Supabase Auth Providers, enable Google and save the client ID and client secret.
5. In Supabase Auth URL Configuration, keep the application callbacks in the redirect allow-list:
   - `https://matsuri.pro/auth/callback`
   - `http://127.0.0.1:5173/auth/callback`

Google redirects to the Supabase `/auth/v1/callback`; Supabase then redirects to this app's `/auth/callback`. They are separate URLs and both must be configured. Never put the Google client secret in a `VITE_*` variable or commit it to this repository.

For a fully local Supabase stack, set `[auth.external.google]` to `enabled = true` in `supabase/config.toml`, reference the client ID and secret through ignored root `.env` variables, and restart with `supabase stop` followed by `supabase start`.

For the production custom domain deployment, configure Supabase Auth URL Configuration with:

- **Site URL**: `https://matsuri.pro`
- **Redirect URLs**:
  - `https://matsuri.pro/auth/callback`
  - `https://matsuri.pro/auth/set-password`
  - `http://127.0.0.1:5173/auth/callback` (Local development)
  - `http://127.0.0.1:5173/auth/set-password` (Local development)

If the production callback is missing from the allow-list, Supabase falls back to the Site URL, which is why an unchanged localhost Site URL sends confirmation emails back to localhost.

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

Before pushing, compare local and remote migration history:

```bash
npx supabase migration list --linked
```

If production contains schema changes whose migration versions are absent from
the remote history, reconcile that history deliberately before another push.
Do not use `db push --include-all` as a shortcut: replaying historical migrations
against an already-mutated database can fail partway through or overwrite newer
function and policy definitions.

Create a Supabase Auth user and sign in. Accounts with no memberships land on an empty dashboard where creating a shop is optional. A user who creates a first shop becomes its owner atomically, while invitees can join and work in an existing shop without creating one. Existing `staff_members` are migrated into the deterministic `akiba-shelf` shop.

Staff invitations require deploying the owner-only Edge Function and setting its public redirect origin:

```bash
npx supabase secrets set PUBLIC_SITE_URL=https://matsuri.pro
npx supabase functions deploy invite-shop-member
```

Configure Supabase Auth Site URL/Redirect URLs and SMTP email delivery for production invitations. The service-role key is provided only to the Edge Function runtime and must never be exposed through Vite.

Invitation processing intentionally returns one generic success result; it does not reveal whether an Auth account exists or whether access was granted immediately. Existing inactive non-owner members are reactivated with their previous role, active members are not reassigned, owners are never changed by an invitation, and inactive shops reject invitation operations.

Invitation and recovery callbacks create a short-lived session marker. Password completion and invitation acceptance are separate retryable steps: temporary acceptance or metadata-cleanup failures retain the invitation identifier so completion can be retried without changing the password again. Direct or expired `/auth/set-password` visits are rejected.

Apply `20260713140000_production_hardening.sql` before deploying the updated frontend and Edge Function. It adds explicit public-safe column grants, role-checked private admin projections, a member-safe workspace summary, protected confirmed-account membership processing, and the per-user shop-creation advisory lock.

GitHub Pages deep-link generation belongs to `public/404.html`. Runtime restoration is owned only by `restoreRedirect()` and derives its prefix from `import.meta.env.BASE_URL`; do not add a second inline restoration script to `index.html`.

Do not add an automatic auth-user trigger. Owners may manage staff; admins manage the catalog/settings; staff may view and process orders only. Anonymous users may read the active catalog and required public checkout settings, call safe order creation, and recover/cancel only with the matching order ID and recovery token.

## Deployment boundaries

- Frontend: build with the three documented `VITE_*` values, then deploy `dist/`.
- Database: review and apply `supabase/migrations` in order with `supabase db push`; pull requests never deploy schema.
- Edge Functions: set `PUBLIC_SITE_URL`, then deploy `invite-shop-member` and
  `notify-new-order` separately after migrations. Both restrict browser CORS to
  that configured origin.
- Secrets: set VAPID private material only with `supabase secrets set`; never expose it through Vite variables.

## Repository health

Use the full local gate before deployment:

```bash
npm run check
npm audit --omit=dev --audit-level=moderate
npm run test:functions
git diff --check
```

Database changes additionally require a local Supabase run (`npm run test:db`
and the integration suite) or an explicitly documented reason they could not be
run. For a linked project, run both security and performance advisors with
`npx supabase db advisors --linked --type security` and `--type performance`.

The 2026-07-14 review and its remaining operational checks are recorded in
[`docs/repository-review.md`](docs/repository-review.md). The staged stylesheet
cleanup plan is in
[`docs/legacy-css-migration.md`](docs/legacy-css-migration.md).

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
- Native mobile tap highlights are disabled for interactive controls, while
  keyboard `:focus-visible` feedback must remain intact.

See `AGENTS.md` for implementation conventions and the handoff guide for future coding sessions.
