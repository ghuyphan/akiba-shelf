# Matsuri operations

This is the production and Supabase runbook. `AGENTS.md` owns coding rules;
this file owns environment, Auth, migration, function, and release procedures.

## Environments and secrets

Public frontend variables:

```bash
VITE_SUPABASE_URL=https://PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=publishable-or-anon-key
VITE_VAPID_PUBLIC_KEY=public-vapid-key
```

Every `VITE_*` value is shipped to browsers. Keep these values out of Vite:

- Supabase service-role/secret key
- Google OAuth client secret
- SMTP credentials
- `CHECKOUT_RATE_LIMIT_SALT`
- VAPID private key

Matsuri creates VietQR payloads and SVG images locally. It does not require a
VietQR API secret.

Required Edge Function secrets depend on enabled features:

```bash
npx supabase secrets set \
  PUBLIC_SITE_URL=https://matsuri.pro \
  CHECKOUT_RATE_LIMIT_SALT=independent-random-value

npx supabase secrets set \
  VAPID_PUBLIC_KEY=... \
  VAPID_PRIVATE_KEY=... \
  VAPID_SUBJECT=mailto:ops@example.com
```

Never commit `.env.local`, secret env files, or service-role credentials.

## Supabase Auth

Production requires SMTP and email confirmation. Configure:

- Site URL: `https://matsuri.pro`
- Redirect URLs:
  - `https://matsuri.pro/auth/callback`
  - `https://matsuri.pro/auth/set-password`
  - `http://127.0.0.1:5173/auth/callback`
  - `http://127.0.0.1:5173/auth/set-password`

Use the deployed base URL if the production domain changes. Missing callbacks
cause confirmation/recovery links to fall back to the Site URL.

For Google sign-in:

1. Create a Google Web application OAuth client.
2. Add application origins such as `https://matsuri.pro` and
   `http://127.0.0.1:5173`.
3. Add the Supabase API callback shown by the Google provider, for example
   `https://PROJECT_REF.supabase.co/auth/v1/callback`, as the Google redirect.
4. Put the client ID and secret only in Supabase Auth provider settings.
5. Keep the Matsuri `/auth/callback` URLs in Supabase's redirect allow-list.

Google redirects to Supabase `/auth/v1/callback`; Supabase then redirects to
Matsuri `/auth/callback`. They are different endpoints.

For a fully local stack, enable `[auth.external.google]` in
`supabase/config.toml`, load credentials from the ignored root `.env`, and
restart the local stack.

Recommend CAPTCHA, conservative Auth rate limits, leaked-password protection,
and short-lived sessions appropriate to the deployment. End users never need
Supabase Dashboard access.

## Database changes

Create all schema changes as ordered files in `supabase/migrations/`. New
tables exposed through the Data API need both RLS and explicit least-privileged
grants; RLS alone does not grant API access.

Before deploying to a linked project:

```bash
npx supabase migration list --linked
npx supabase db push --linked --dry-run
```

Review local/remote history and the exact pending migration list. If history
drift exists, reconcile applied versions deliberately. Never use
`--include-all` as a shortcut.

When the user requested deployment and the dry-run is correct:

```bash
npx supabase db push --linked
npx supabase migration list --linked
npx supabase db lint --linked --schema public,private --fail-on none
npx supabase db advisors --linked --type security --level warn --fail-on none
npx supabase db advisors --linked --type performance --level warn --fail-on none
```

Verify changed tables, functions, policies, grants, and behavior after the
push. A local Docker stack is useful supplemental coverage, not a prerequisite
for an already linked deployment.

Local database checks when available:

```bash
npm run test:db
npm run test:db:integration
```

Never edit an already-applied migration to change production behavior; add a
new migration. Search all layered function definitions and grants before
assuming an older migration is still active.

## Edge Functions

Deploy all four functions explicitly after required migrations:

```bash
npx supabase functions deploy create-order
npx supabase functions deploy invite-shop-member
npx supabase functions deploy notify-new-order
npx supabase functions deploy gacha-music-proxy
```

Responsibilities:

- `create-order`: checkout request validation, abuse boundary, privileged RPC.
- `invite-shop-member`: owner-authorized invitations with generic responses.
- `notify-new-order`: token-gated push delivery and deduplication.
- `gacha-music-proxy`: `PUBLIC_SITE_URL`-restricted HSR metadata proxy.

Run `npm run test:functions` whenever a function changes. Do not expose the
service-role key to frontend code; Supabase provides it only to the function
runtime.

## PWA, offline assets, and push

`npm run build` builds the React app, both vendored simulators, and
`offline-assets.json`. Storefront offline save downloads a complete catalog and
artwork; simulator offline save downloads the selected game pack.

Android order alerts require HTTPS, the web-push migration, VAPID secrets, the
public VAPID Vite variable, and the deployed `notify-new-order` function. Staff
then install the PWA, sign in, and enable alerts from admin.

Offline Event Mode must be prepared while online. One allocation belongs to one
designated device; do not clone it across independent devices. Closing the
event returns only unsold stock after idempotent synchronization.

## Frontend and deep links

Build with the public Vite variables and deploy `dist/`:

```bash
npm run build
```

GitHub Pages deep-link generation belongs to `public/404.html`. Runtime restore
belongs only to `restoreRedirect()` and uses `import.meta.env.BASE_URL`. Do not
add a second restoration script to `index.html`.

## Release gate

```bash
npm run check
npm audit --omit=dev --audit-level=moderate
npm run test:functions
git diff --check
```

Also run `npm run test:e2e` for data-path or page-flow changes and the database
workflow above for migrations. Report unavailable local/linked validation
plainly instead of claiming deployment or verification.
