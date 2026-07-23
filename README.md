# Matsuri

Matsuri is a touch-friendly merch storefront and live order system for
independent artist booths. Customers browse stock, create an order, scan
VietQR, and wait for staff confirmation. Staff manage fulfilment, products,
payment details, booth content, storefront design, offline event sales, and
optional Genshin/HSR-style merch gacha games.

## Product surfaces

| Route                                           | Purpose                                               |
| ----------------------------------------------- | ----------------------------------------------------- |
| `/`                                             | Matsuri landing page                                  |
| `/auth`, `/auth/callback`, `/auth/set-password` | Account, invitation, confirmation, and recovery flows |
| `/dashboard`, `/dashboard/shops/new`            | Shop selection and creation                           |
| `/s/:shopSlug`                                  | Customer storefront                                   |
| `/s/:shopSlug/play`                             | Published merch gacha games                           |
| `/admin`                                        | Staff workspace                                       |

Core behavior:

- Multi-shop storefronts with English/Vietnamese copy and per-shop themes.
- Server-authoritative stock, pricing, promotions, and order reservation.
- VietQR generation in the browser; no VietQR API key is required.
- Realtime catalog and order updates through Supabase.
- Offline storefront browsing, saved assets, cart persistence, and checkout
  recovery.
- Device-bound Offline Event Mode with preallocated stock and idempotent sync.
- Role-based owner, admin, and staff workspaces.
- Two independently publishable vendored gacha simulators.

## Stack

- React 19, TypeScript, Vite, React Router
- Supabase Auth, Postgres, Storage, Realtime, and Edge Functions
- Cloudflare Pages for frontend delivery and application-route fallback
- Vitest, Testing Library, Playwright, pgTAP
- Two vendored SvelteKit simulator workspaces

## Quick start

```bash
npm install
cp .env.example .env.local
npm run dev
```

Frontend environment variables:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-or-anon-key
VITE_VAPID_PUBLIC_KEY=your-public-vapid-key
```

Both current `sb_publishable_...` keys and legacy JWT-based anon keys are
supported. Public checkout, order-notification, and gacha-music Edge Functions
perform their own bounded request or recovery-token validation and therefore
deploy with gateway JWT verification disabled. Staff invitation functions keep
gateway JWT verification enabled and require a signed-in user session.

Every `VITE_*` value is public browser configuration. Never put service-role,
OAuth, SMTP, VietQR, or VAPID private credentials in a Vite variable or commit
them to the repository.

Useful commands:

| Command                  | Purpose                                                                         |
| ------------------------ | ------------------------------------------------------------------------------- |
| `npm run dev`            | Build missing simulator assets and start Vite                                   |
| `npm run check`          | Typecheck, lint, format check, unit tests, security tests, and production build |
| `npm run test:e2e`       | Playwright desktop, touch-tablet, and phone flows                               |
| `npm run test:functions` | Edge Function tests                                                             |
| `npm run test:db`        | Local pgTAP database tests                                                      |
| `npm run test:perf`      | Storefront performance suite                                                    |

## Correctness boundaries

Checkout is never a direct browser insert. The browser calls the
`create-order` Edge Function, which invokes the privileged order RPC. Postgres
locks product rows, reads current prices and promotion rules, reserves stock,
and creates the order atomically. Confirmation does not deduct stock again;
cancellation and expiry restore it exactly once.

Normal offline mode may cache browsing data and queue checkout intent, but it
must reconnect before stock can be reserved. Offline Event Mode is the explicit
exception: an owner/admin allocates stock online to one staff device before the
event, and that device records local event orders against only that allocation.

Owners manage the team and catalog, admins manage catalog/settings, and staff
process orders. UI visibility is not security; database grants, RLS, and RPC
authorization remain authoritative.

## Documentation

Each first-party document has one job:

- [`AGENTS.md`](AGENTS.md): non-negotiable coding and verification contract.
- [`CODEBASE.md`](CODEBASE.md): fast repository map and change-impact guide.
- [`DESIGN.md`](DESIGN.md): durable visual and interaction language.
- [`docs/operations.md`](docs/operations.md): Auth, Supabase, deployment,
  secrets, PWA, and production checks.
- [`docs/technical-debt.md`](docs/technical-debt.md): current, verified backlog.
- [`docs/gacha-admin-redesign.md`](docs/gacha-admin-redesign.md): gacha admin
  structure and remaining simplification work.
- [`docs/legacy-css-migration.md`](docs/legacy-css-migration.md): staged removal
  of the compatibility stylesheet.

Vendored README and locale files under `vendor/` preserve upstream project
documentation. Matsuri integration rules live in the first-party documents
above.

## Production

Production needs a configured Supabase project, SMTP/email confirmation,
allowed Auth callbacks, `PUBLIC_SITE_URL`, checkout rate-limit salt, VAPID
secrets when push is enabled, all migrations, all four Edge Functions, and a
frontend build with the public Vite variables.

Follow [`docs/operations.md`](docs/operations.md) for the deployment order and
verification steps. Do not direct end users to Supabase Dashboard.
