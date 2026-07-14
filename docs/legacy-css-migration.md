# Legacy CSS migration plan

`src/styles/legacy.css` is a compatibility layer, not a destination for new
work. At the 2026-07-14 baseline it contains 3,533 lines, including overlapping
generations of catalog, admin, and shared component styling. Removing it in one
rewrite would make cascade regressions hard to isolate, so migration is staged
by ownership and verified after every slice.

## Target ownership

- `global.css`: tokens, resets, typography, buttons, fields, modal, alert, toast,
  and other genuinely cross-screen primitives.
- `catalog.css`: storefront layout, cards, featured deck, category controls,
  booth information, cart, checkout, and payment surfaces.
- `admin.css`: platform/auth/dashboard, admin workspace, editors, order queue,
  settings, and storefront designer.
- `legacy.css`: temporary compatibility rules only; zero lines is the exit goal.

## Migration sequence

### 1. Freeze and map

- Do not add selectors to `legacy.css`.
- Record selector ownership before moving a block. Search every selector in TSX
  and in the three destination stylesheets.
- Capture desktop and phone screenshots for the affected surface, including its
  empty, loading, error, and long/localized-content states where applicable.
- Keep the current import in `src/main.tsx` until the final stage.

Exit gate: every chosen block has one screen owner and a reproducible visual or
end-to-end check.

### 2. Shared primitives

Move only rules used across multiple route families: base typography, form and
button primitives, modal/backdrop behavior, alerts, toasts, and accessibility
states. Consolidate duplicate declarations around existing variables rather
than copying old hard-coded colors. Preserve keyboard focus and reduced-motion
behavior.

Exit gate: auth, dashboard, admin, and storefront smoke checks pass at desktop
and phone widths; no moved selector remains duplicated in `legacy.css`.

### 3. Storefront slices

Migrate in bounded groups:

1. shell/header and booth information;
2. featured deck;
3. browse controls and overflowing categories;
4. product grid and list cards;
5. cart, product detail, checkout, payment, and success sheets.

For every group, verify English and Vietnamese, grid and list modes, sold-out
and long-text products, sheet entrance/exit, and `prefers-reduced-motion`.

Exit gate: the storefront has no selector dependency on `legacy.css`.

### 4. Platform and admin slices

Migrate platform/auth/dashboard first, then the admin header/navigation, orders,
products, settings/staff, and finally the designer preview. Admin work should be
split around roughly 1,100 px as well as the phone breakpoint because its
two-column layouts collapse earlier than the storefront.

Exit gate: all platform and admin routes render correctly without legacy rules,
including the designer's desktop/phone previews.

### 5. Remove the layer

- Confirm that every remaining legacy selector is unused or has an owned
  replacement.
- Remove the `legacy.css` import and file in the same focused change.
- Run the full verification matrix, production build, and CSS/search checks.
- Add a CI guard preventing recreation of the file or import.

Exit gate: `legacy.css` is absent, no compatibility import remains, and the full
test/visual checklist passes.

## Rules for each migration pull request

- One coherent surface or primitive family per change.
- No unrelated redesign mixed into selector relocation.
- Destination rules should be readable and grouped; do not preserve compressed
  or duplicated historical formatting.
- Prefer removing specificity and `!important` only when visual tests prove the
  cascade remains stable.
- Report the legacy line-count change and the surfaces verified.
