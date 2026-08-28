# Matsuri agent contract

Read this file before changing code. Preserve unrelated work in a dirty tree
and use focused patches.

## Context routing

Load only guidance relevant to the current task. Do not preload every linked
document.

- Unfamiliar ownership or architecture: read `CODEBASE.md`.
- UI, CSS, copy, responsive behavior, or storefront designer work: read
  `DESIGN.md`.
- Supabase, auth, API data, Edge Functions, migrations, SQL, RLS, or database
  work: read `docs/supabase-agent-guidance.md` and the Supabase skill. Also use
  the Postgres best-practices skill for SQL, queries, or schema design.
- Deployment, Cloudflare Pages, DNS, secrets, release, rollback, or production
  verification: read `docs/operations.md`.
- Gacha limits, publishing, rolling, fixtures, or simulators: read
  `docs/gacha-invariants.md`. For admin editor work also read
  `docs/gacha-admin-redesign.md`.
- Legacy CSS migration: read `docs/legacy-css-migration.md`.

## Communication

Use terse technical English.

- No greetings, filler, repetition, or generic explanations.
- Prefer fragments, bullets, symbols, and short field names.
- Report: result, changed files, tests, blockers.
- Do not omit information needed for correctness.

## Product invariants

- Supabase is the source of truth. Realtime updates catalog and order screens;
  stock, price, promotion, membership, and payment decisions remain
  server-authoritative.
- Checkout uses the `create-order` Edge Function and existing order RPC. Never
  restore anonymous direct inserts into `orders` or `order_items`.
- Pending order creation reserves inventory. Confirmation finalizes that
  reservation; cancellation and expiry restore it exactly once. Terminal
  actions remain idempotent.
- Normal offline support covers browsing, saved assets, cart persistence, and a
  queued checkout identity. It never invents an order, payment, or reservation.
- Offline Event Mode is the only offline-sale exception. Allocate stock online
  to one staff device before local sales; sync idempotently; keep payment
  staff-verified; return only unsold allocation when closing.
- Owners manage team and catalog access; admins manage catalog/settings; staff
  process orders. Hidden controls are not authorization.

## Code ownership

- Route fetching/composition: `src/pages/`.
- Reusable sections: `src/components/admin/`, `src/components/catalog/`.
- Cross-screen primitives: `src/components/ui/`.
- Supabase reads, writes, RPCs, Storage, and Edge Function calls:
  `src/lib/api/`; `src/lib/api.ts` exports only.
- Shared domain types: `src/types/catalog.ts`, `src/types/gacha.ts`.
- Runtime validation: `src/lib/schemas.ts`.
- Stateful async forms: `useAsyncAction`; transient feedback: `useToast()`;
  persistent form/content messages: `Alert`.
- Changes under `src/lib/api/` require matching review of `e2e/fixtures.ts`,
  API contract tests, schemas, and response types.

## Documentation maintenance

Keep documentation synchronized with code changes.

- Major or minor updates that modify architecture, schemas, API contracts,
  invariants, UI rules, operations, or workflows MUST update corresponding docs
  (`CODEBASE.md`, `DESIGN.md`, `AGENTS.md`, `docs/*`, ADRs) in the same change.
- Never leave docs outdated, conflicting, or drifting after refactors,
  deprecations, or feature additions.
- If existing documentation is discovered to be outdated during a task, update
  or flag it within the focused patch.

## Verification

Always finish with:

```bash
npm run check
git diff --check
```

Also run:

- `npm run test:e2e` for API data paths or page-level flows.
- `npm run test:functions` for Edge Functions.
- `npm audit --omit=dev` for dependency changes.
- Database tests plus linked history/dry-run/advisors for migration work.
- Relevant desktop/phone, English/Vietnamese, state, focus, and layout checks
  defined in `DESIGN.md` for meaningful UI changes.
