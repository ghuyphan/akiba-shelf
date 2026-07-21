# Current technical debt

This is the live backlog for structural work. It intentionally excludes
completed audit history; use Git history when old evidence is needed. Recheck
each item against the current tree before implementing it.

## Priority 1: maintainability

- Continue extracting focused state and loaders from `AdminPage.tsx`. Keep the
  page as route composition rather than moving Supabase access into components.
- Continue splitting `GachaManager.tsx` only where a section has clear state and
  test boundaries. Preserve the three-card editor described in
  `gacha-admin-redesign.md`.
- Keep `src/lib/api.ts` as a compatibility barrel. New implementations belong
  in the existing domain modules under `src/lib/api/`.
- Document intentional patches and dependency ownership for both vendored
  simulators. Their upstream README files are not Matsuri architecture docs.

## Priority 1: accessibility

Several jsx-a11y interaction rules remain disabled in `eslint.config.js`.
Regenerate the warning inventory before work; old line-number lists are stale.

Re-enable one category at a time:

1. labels and control names;
2. click/keyboard parity;
3. interactive roles and tab order;
4. autofocus decisions.

Move a rule to error only after its warning count reaches zero. Preserve
keyboard focus while changing touch behavior.

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
- Resolve simulator build reproducibility issues instead of relying on existing
  `.gacha-dist` or `.hsr-gacha-dist` output.

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
