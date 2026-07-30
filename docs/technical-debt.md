# Current technical debt

This is the live backlog for structural work. It intentionally excludes
completed audit history; use Git history when old evidence is needed. Recheck
each item against the current tree before implementing it.

## Priority 1: maintainability

- Continue splitting `GachaManager.tsx` only where a section has clear state and
  test boundaries. Preserve the three-card editor described in
  `gacha-admin-redesign.md`.
- Keep `src/lib/api.ts` as a compatibility barrel. New implementations belong
  in the existing domain modules under `src/lib/api/`.

## Priority 2: CSS ownership

`src/styles/legacy.css` remains large. Follow `legacy-css-migration.md` one
surface at a time with desktop/phone and product grid/list coverage. Do not mix
selector relocation with a redesign.

After legacy work, consider route-splitting more admin CSS only if behavior and
load order remain stable.

## Priority 2: verification and tooling

- Add WebKit coverage for the iPad-oriented target when CI capacity allows.
- Broaden automated source formatting only after agreeing on the churn; current
  formatting checks intentionally cover configuration and selected files.
- Keep coverage thresholds as a ratchet rather than imposing an unrealistic
  one-time target.
- Run pgTAP when a local Supabase stack is available and keep linked database
  lint/advisors in deployment verification.

## Post-stabilization: retire compatibility RPCs

Do not perform this cleanup during production stabilization. Both signatures
remain intentionally available for rollback compatibility and must be removed
through new migrations, never by editing their historical definitions.

### Offline Event immediate-start RPC

- Legacy signature:
  `public.start_offline_event_session(uuid, uuid, text, jsonb, jsonb, jsonb)`.
- Current grant: `EXECUTE` to `authenticated`; the function still performs its
  own owner/admin authorization.
- Current supported callers: none. The TypeScript wrapper and HTTP fixture have
  been removed, and lifecycle coverage now uses `save_offline_event_draft`
  followed by `activate_offline_event_session`. The signature remains granted
  only for retained production rollback artifacts.

Retirement sequence:

1. Completed: move the API contract, fixture, and database lifecycle coverage
   to the draft-then-activate flow; remove the unused TypeScript wrapper.
2. Deploy and observe at least one full frontend rollback window. The previous
   retained Pages artifact must no longer call the signature, and production
   PostgREST/function logs must show zero calls from supported clients.
3. Add a migration revoking `EXECUTE` from `authenticated`; deploy and observe
   one further release window for authorization errors or support reports.
4. Add a later migration dropping the exact six-argument signature. Remove
   only compatibility tests that assert its presence.

### Checkout rate-limit overload

- Legacy signature:
  `public.create_order_rate_limited(text, text, jsonb, uuid, text, text)`.
- Current grant: `EXECUTE` to `service_role` only. Browser roles cannot call it.
- Current callers: rollback-contract assertions in
  `supabase/tests/database/backend_hardening.test.sql` and release guidance in
  `docs/operations.md`. The deployed `create-order` Edge Function uses the
  eight-argument overload with separate fingerprint, device, and IP hashes.

Retirement sequence:

1. Confirm every deployable and rollback `create-order` artifact uses the
   eight-argument overload; update compatibility assertions to treat the
   six-argument overload as absent only after that artifact inventory is
   complete.
2. Observe at least one full Edge Function and frontend rollback window, with
   production database/API logs showing zero six-argument calls.
3. Add a migration revoking `EXECUTE` from `service_role`; deploy and observe
   one further release window for checkout RPC resolution failures.
4. Add a later migration dropping the exact six-argument signature, then
   remove the rollback note from `docs/operations.md`.

For both removals, keep the move, observe, revoke, and drop phases in separate
releases. A successful test suite is not a substitute for production call
telemetry or an expired rollback window.

## Optional product/performance work

- Lazy-load QR generation where it materially improves initial storefront cost.
- Compress bank-logo assets for their rendered sizes.
- Show snapshot age and storage/quota feedback for saved offline shops.
- Replace remaining `window.confirm` flows with accessible in-app dialogs.

## Exit discipline

For every debt item:

- verify it is still present;
- keep behavior changes separate from file movement;
- add or update focused tests;
- run the gates required by `AGENTS.md`;
- remove the item from this file when completed.
