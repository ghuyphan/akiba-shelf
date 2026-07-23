# Matsuri operations

This is the production and Supabase runbook. `AGENTS.md` owns coding rules;
this file owns environment, Auth, migration, function, and release procedures.

## Environments and secrets

Public frontend variables:

```bash
VITE_SUPABASE_URL=https://PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=publishable-or-anon-key
VITE_VAPID_PUBLIC_KEY=public-vapid-key
VITE_SENTRY_DSN=https://public-key@o0.ingest.sentry.io/project-id
VITE_APP_ENV=production
VITE_RUM_SAMPLE_RATE=0.1
```

`VITE_SENTRY_DSN` enables browser error reporting and real-user CLS, INP, and
LCP events. The DSN is a public client identifier, not a Sentry API token.
`VITE_APP_ENV` labels those events and defaults to `production` when omitted.
`VITE_RUM_SAMPLE_RATE` is clamped to the range `0` through `1`, defaults to
`0.1`, and has no effect when the DSN is empty. Use `0` to keep error reporting
while disabling Web Vitals sampling.

Every `VITE_*` value is shipped to browsers. Keep these values out of Vite:

- Supabase service-role/secret key
- Google OAuth client secret
- SMTP credentials
- `CHECKOUT_RATE_LIMIT_SALT`
- VAPID private key
- `NOTIFICATION_WORKER_SECRET`

Matsuri creates VietQR payloads and SVG images locally. It does not require a
VietQR API secret.

The public frontend key may be a current publishable key or a legacy anon JWT.
`create-order` and `gacha-music-proxy` use `verify_jwt = false` and enforce
their own request bounds, origin policy, and rate limits. `notify-new-order`
also uses `verify_jwt = false`, but accepts only the Vault-backed worker secret
and a drain action; browsers cannot initiate delivery. `invite-shop-member`
and `push-subscriptions` use `verify_jwt = true` because they require the
caller's signed-in Auth JWT.

Required Edge Function secrets depend on enabled features:

```bash
npx supabase secrets set \
  PUBLIC_SITE_URL=https://matsuri.pro \
  CHECKOUT_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173 \
  CHECKOUT_RATE_LIMIT_SALT=independent-random-value

npx supabase secrets set \
  VAPID_PUBLIC_KEY=... \
  VAPID_PRIVATE_KEY=... \
  VAPID_SUBJECT=mailto:ops@example.com \
  NOTIFICATION_WORKER_SECRET=independent-random-value
```

The push endpoint validator permits the built-in Web Push providers for
Firebase, Mozilla, Apple, and Windows. If another provider is required, add
only its reviewed host or narrowly scoped wildcard to the optional
comma-separated allowlist:

```bash
npx supabase secrets set PUSH_ENDPOINT_HOSTS=push.example.com,*.push.example.net
```

Do not use a broad organizational domain. Registration also requires HTTPS on
port 443, public DNS answers, and valid Web Push key material.

Never commit `.env.local`, secret env files, or service-role credentials.

`CHECKOUT_ALLOWED_ORIGINS` is an optional comma-separated exact allowlist for
frontend origins that call the deployed `create-order` function. Keep
`PUBLIC_SITE_URL` as the production origin and add localhost entries only when
the local frontend intentionally tests against the linked project. Never use a
wildcard origin.

Checkout hashes the first `X-Forwarded-For` value as one supplemental abuse
signal, alongside shop, device, and checkout-identity limits. Supabase's
official Edge Function location example reads this header, but that example is
not a guarantee that every gateway configuration strips spoofed client values.
Until platform normalization is explicitly verified for the production
project, never use this value for authorization or as the only rate limit.

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

Checkout uses an expand/contract rollout. The migration keeps the previous
six-argument checkout RPC while adding the layered eight-argument contract, and
the new `create-order` function accepts requests from the retained frontend
without a device ID. Apply the migration first, deploy functions second, and
deploy the frontend last. Remove the compatibility overload only in a later
migration after the previous Pages and Edge Function rollback window closes.

Deploy all five functions explicitly after required migrations:

```bash
npx supabase functions deploy create-order
npx supabase functions deploy invite-shop-member
npx supabase functions deploy notify-new-order
npx supabase functions deploy push-subscriptions
npx supabase functions deploy gacha-music-proxy
```

Deploy from the repository configuration so each function receives the
intended `verify_jwt` setting. After deployment, smoke-test public checkout and
HSR music with the configured publishable/anon key, then test invitations with
an authenticated owner session.

Responsibilities:

- `create-order`: checkout request validation, abuse boundary, privileged RPC.
- `invite-shop-member`: owner-authorized invitations with generic responses.
- `notify-new-order`: token-gated durable queue drain and Web Push delivery.
- `push-subscriptions`: authenticated registration, status, and removal through
  the protected subscription RPCs.
- `gacha-music-proxy`: `PUBLIC_SITE_URL`-restricted HSR metadata proxy.

Run `npm run test:functions` whenever a function changes. Do not expose the
service-role key to frontend code; Supabase provides it only to the function
runtime.

### Notification worker setup

The durable notification migration schedules a one-minute `pg_cron` job only
when `pg_cron` and both Vault entries are already available. It uses `pg_net`
to call the `notify-new-order` drain endpoint and reads the URL and shared
worker secret from Supabase Vault. Generate an independent secret, set the Edge
Function secret, and then create the two named Vault entries from the SQL
editor:

```bash
openssl rand -hex 32
npx supabase secrets set NOTIFICATION_WORKER_SECRET=generated-value
```

```sql
select vault.create_secret(
  'https://PROJECT_REF.supabase.co/functions/v1/notify-new-order',
  'notification_worker_url',
  'Durable order notification drain endpoint'
);
select vault.create_secret(
  'generated-value',
  'notification_worker_secret',
  'Shared secret for the durable notification worker'
);
```

Immediately after both Vault entries exist, run the checked, idempotent
configuration operation against the linked project:

```bash
npx --yes supabase@2.109.1 db query --linked \
  --file scripts/configure-notification-cron.sql
```

The operation fails and rolls back unless it leaves exactly one active
one-minute drain job. Re-run it after creating or rotating the Vault entries,
or after restoring a project. If either named Vault entry already exists,
update it instead of creating a duplicate.

Do not query or log `vault.decrypted_secrets` during routine verification. To
rotate the worker credential, set the new Edge Function secret first, then use
the Vault secret UUID with `vault.update_secret`, and trigger a drain. A brief
401 during propagation delays delivery but does not lose queued jobs:

```sql
select vault.update_secret(
  (select id from vault.secrets where name = 'notification_worker_secret'),
  'new-generated-value',
  'notification_worker_secret',
  'Shared secret for the durable notification worker'
);

select public.request_order_notification_drain() as request_id;
```

`request_order_notification_drain()` returning an ID confirms only that
`pg_net` accepted an asynchronous request. After the transaction commits, use
that ID to verify the HTTP response; success requires a non-timeout 2xx result.
The response may take a moment to appear and `pg_net` retains responses only
temporarily, so external monitoring must capture failures promptly:

```sql
select id, status_code, timed_out, error_msg, created
from net._http_response
where id = REQUEST_ID;
```

Rotate `notification_worker_url` with the same `vault.update_secret` procedure
when the Supabase project reference changes. Re-run the drain verification
after every function deployment, Vault rotation, or project restore.

## PWA, offline assets, and push

`npm run build` builds the React app, both vendored simulators, and
`offline-assets.json`. Storefront offline save downloads a complete catalog and
artwork; simulator offline save downloads the selected game pack.

Android order alerts require HTTPS, the web-push migration, VAPID secrets, the
public VAPID Vite variable, and deployed `notify-new-order` and
`push-subscriptions` functions. Staff then install the PWA, sign in, and enable
alerts from admin.

Offline Event Mode must be prepared while online. One allocation belongs to one
designated device; do not clone it across independent devices. Closing the
event returns only unsold stock after idempotent synchronization.

## Frontend and deep links

Build with the public Vite variables and deploy `dist/`:

```bash
npm run build
```

The frontend is hosted on Cloudflare Pages as a Direct Upload project named
`matsuri`. There must be no top-level `404.html` in `dist/`: Cloudflare then
serves `index.html` with HTTP 200 for application routes such as `/admin` and
`/s/:shopSlug`. `restoreRedirect()` remains only for compatibility with links
created by the former GitHub Pages deployment.

The Pages project uses Direct Upload intentionally: GitHub Actions is the build
platform and Wrangler uploads the verified `dist/` artifact. Do not create a
second Git-integrated Pages project or enable another production deployer. The
deployment workflow requires the `cloudflare-pages` GitHub environment to
provide `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`,
`VITE_SUPABASE_URL`, and `VITE_SUPABASE_ANON_KEY`. Scope the Cloudflare token to
Account > Cloudflare Pages > Edit for the account that owns the `matsuri`
project. Every `VITE_*` value is public in the built application.

To enable production observability, also configure `VITE_SENTRY_DSN`,
`VITE_APP_ENV`, and `VITE_RUM_SAMPLE_RATE` in that protected environment and
explicitly map them into the build job. GitHub Pages, Cloudflare Pages, local
Vite files, and GitHub Actions do not transfer environment values between one
another automatically.

The `CI and Deploy` workflow runs checks, database tests, e2e tests, and
performance tests before building. Production deployments are serialized so
overlapping pushes cannot race, while superseded pull-request validation may be
cancelled. A manual run is allowed only from `main` through
`workflow_dispatch`.

The workflow stores the clean `dist/` build for each production run and retains
one generation of hashed Vite assets and simulator `internal/immutable` assets
from the exact build artifact for the active production deployment. If that
artifact is unavailable, retention is skipped instead of rebuilding with
potentially different public environment values.
This keeps old tabs working without carrying removed HTML, manifests, or stable
media into the next release. The allowlist lives in
`scripts/retain-previous-assets.mjs`; do not broaden it or remove the retention
without an equivalent stale-client compatibility strategy.

Cloudflare Pages reads `public/_headers` for browser security and cache policy.
Do not attach immutable wildcard headers to asset paths while Cloudflare's SPA
fallback can serve HTML for a missing file; that can poison-cache a stale chunk
as HTML. `sw.js`, `offline-assets.json`, and `release.json` must always
revalidate. Keep HTML and other assets on Cloudflare's default behavior unless
a content-type-aware Cache Rule is deployed and verified separately.

After Wrangler uploads the artifact, the workflow verifies the deployment URL
and a deep application route, waits for `matsuri.pro` to serve the same entry
asset, and confirms that `www.matsuri.pro` preserves path and query parameters
while redirecting permanently to the apex. A failed verification or smoke check
rolls production back to the deployment that was active before the upload and
then fails the release job.

Apply and verify any required linked Supabase migration before merging the
frontend release to `main`. The production smoke calls the read-only storefront
bootstrap RPC, so a missing backend contract fails the release and triggers the
Cloudflare rollback instead of shipping a storefront that only serves HTML.

The apex custom domain `matsuri.pro` must be an active zone in the same
Cloudflare account as the Pages project. Associate the domain with the project
before changing nameservers. After cutover, verify the apex route, a storefront
deep link, Auth callbacks, the service worker, and the current/previous hashed
asset generations.

Keep `matsuri.pro` as the only application origin. Cloudflare Pages
`_redirects` files cannot match hostnames, so configure a zone-level Single
Redirect for `www.matsuri.pro`: match that hostname, redirect permanently to
the equivalent `https://matsuri.pro` path, and preserve the query string. Both
hostnames must remain proxied for the Redirect Rule to run.

To roll back, open Cloudflare Pages > `matsuri` > Deployments, use the actions
menu for a previous production deployment, and select **Rollback to this
deployment**. The database and `create-order` function must keep the retained
frontend contract compatible for the full rollback window. Then verify the
apex, a deep link, Auth, checkout creation, and checkout recovery.

## Release identity and uptime checks

Every production build receives `MATSURI_RELEASE=${GITHUB_SHA}`. Vite exposes
the same value through `src/lib/release.ts`, while the build writes
`release.json` with the release, entry asset, and both simulator pack IDs.
`release.json` must remain `no-store`; error and RUM events should attach
`getReleaseContext()` so an incident maps to one immutable release.

Run the read-only production smoke locally or from an external monitor:

```bash
VITE_SUPABASE_URL=https://PROJECT_REF.supabase.co \
VITE_SUPABASE_ANON_KEY=publishable-or-anon-key \
  npm run smoke:production -- --base-url https://matsuri.pro
```

The smoke checks the SPA shell at the homepage, a storefront route, and Auth
callback; verifies static bank/payment branding; calls the read-only storefront
bootstrap RPC for `MATSURI_SMOKE_SHOP_SLUG` (default `demo-booth`); and sends a
CORS `OPTIONS` request to `create-order`. It never submits a cart or creates an
order. Run it every five minutes from one region and from a second region after
DNS, TLS, or Cloudflare changes.

## Retention and recovery

Production data has different retention owners:

- Orders, order items, inventory movements, and membership audit information
  are retained until the business owner approves a legal/accounting retention
  schedule. Do not add automated deletion before that decision is documented.
- Invalid push endpoints should be removed during delivery cleanup; push
  delivery logs and provider logs are operational data, not the order record.
- Device-local carts, snapshots, and Offline Event ledgers remain on the device
  until the user clears them or the owning workflow safely closes them.
- Cloudflare keeps deploy history for rollback; Matsuri additionally carries
  only one previous immutable asset generation in each release artifact.

Supabase database backups do not include Storage objects. Verify the active
plan's backup window under Database > Backups and maintain a separate Storage
inventory/export procedure for product and payment images. Before a high-risk
release, record the latest provider restore point and, when a portable logical
copy is required, write it to encrypted off-repository storage:

```bash
npx supabase db dump --linked --file "$SECURE_BACKUP_DIR/schema.sql"
npx supabase db dump --linked --data-only --use-copy \
  --file "$SECURE_BACKUP_DIR/data.sql"
```

Never commit dumps. A backup is not accepted until a restore rehearsal succeeds
against a disposable project: apply migrations, restore the logical data using
the approved PostgreSQL restore procedure, verify row counts and checkout
invariants, verify Auth/Storage separately, run database tests and advisors, and
destroy the rehearsal project. Restoring the production project causes
downtime; declare an incident, choose the closest restore point before the
fault, communicate the recovery point, pause writes, restore through Supabase,
then verify Realtime, Auth, checkout recovery, inventory totals, and smoke tests.

## Advisors, monitoring, and alerts

Run both advisor classes before and after linked migration releases and at least
weekly when no migration ships:

```bash
npx supabase db advisors --linked --type security --level warn --fail-on none
npx supabase db advisors --linked --type performance --level warn --fail-on none
```

Record each accepted warning with an owner and review date. New security errors
block release. New performance warnings require a query/index review or a
written deferral. Also review migration history and dry-run output; advisors do
not detect deployment drift.

Configure alerts for:

- failed GitHub release gates, failed Pages uploads, and post-deploy smoke
  failures: page the release owner immediately;
- apex TLS/DNS failure or two consecutive external smoke failures: treat as a
  customer-facing incident and evaluate Pages rollback;
- database disk, CPU, connection, or replication pressure: alert before the
  provider limit and pause nonessential admin writes while investigating;
- elevated Edge Function 5xx/timeout rates or checkout outcome-unknown errors:
  inspect function/database logs and recovery lookups before retrying writes;
- Realtime disconnects: degrade to polling/manual refresh while checkout stays
  server-authoritative;
- notification backlog: warn when the oldest due job is more than five minutes
  old, page when it exceeds fifteen minutes, and page on any new dead letter;
- notification drain transport: alert on two consecutive `pg_net` timeouts,
  errors, or non-2xx responses. A returned request ID is not delivery proof;
- skipped notifications: distinguish expected `order_not_pending` or
  `no_valid_subscriptions` outcomes from provider and worker failures. The live
  order queue remains the operational fallback even though delivery is durable.

The staff notification status RPC reports due, retryable-failed, dead-letter,
and oldest-due values for each shop. During an incident, confirm those values
against the underlying queue and inspect recent asynchronous drain responses:

```sql
select
  count(*) filter (
    where (status in ('queued', 'retryable_failed') and next_attempt_at <= now())
       or (status = 'sending' and lease_expires_at <= now())
  ) as due_count,
  count(*) filter (where status = 'dead_letter') as dead_letter_count,
  min(case
    when status in ('queued', 'retryable_failed') and next_attempt_at <= now()
      then next_attempt_at
    when status = 'sending' and lease_expires_at <= now()
      then lease_expires_at
  end) as oldest_due_at
from public.order_notification_events;

select id, status_code, timed_out, error_msg, created
from net._http_response
order by created desc
limit 20;
```

For every incident, capture start/end time, release ID, affected shop/route,
provider status, mitigations, customer impact, and follow-up owner. Never repair
order or inventory state with ad-hoc Dashboard SQL; use reviewed migrations or
the existing idempotent terminal contracts.

## Production readiness checklist

- [ ] Canonical apex and `www` redirect have valid TLS; DNS records are proxied.
- [ ] GitHub protected environment contains Cloudflare and public Vite values;
      a main-branch deployment and rollback rehearsal have passed.
- [ ] `release.json`, immutable headers, deep routes, service worker, simulator
      cache versions, and both current/previous immutable assets are verified.
- [ ] Supabase migration history matches; dry-run is empty or reviewed; database
      tests, function tests, security advisors, and performance advisors pass.
- [ ] Auth Site URL, callback allowlist, SMTP, OAuth, rate limits, and leaked
      password protection are configured for the chosen plan.
- [ ] Checkout preflight, a controlled real checkout, recovery, confirmation,
      cancellation, expiry, and inventory restoration are verified.
- [ ] Backup window, Storage backup procedure, restore rehearsal, RPO, RTO, and
      incident owners are documented and current.
- [ ] External uptime, provider capacity, Edge Function, CI, and TLS alerts reach
      an on-call owner; queue age, dead letters, and `pg_net` drain responses are
      monitored during events.
- [ ] Offline Event allocation/sync/close has a trained designated device and a
      documented lost-device recovery procedure.
- [ ] Known advisor warnings, notification delivery incidents, performance/RUM
      gaps, and technical debt have owners and target review dates.

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
