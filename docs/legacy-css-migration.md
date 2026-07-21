# Legacy CSS migration

`src/styles/legacy.css` is a compatibility layer, not an ownership target. Do
not add new rules. Remove it gradually so cascade regressions stay attributable
to one surface.

## Destination ownership

- `global.css`: tokens, reset, typography, shared buttons/fields/modal/alert/
  toast, accessibility states.
- `catalog.css`: storefront, featured deck, products, booth, cart, checkout,
  and payment.
- `admin.css`: platform, auth, dashboard, admin navigation/workspaces, settings,
  and designer.
- `gacha-*.css`: named gacha admin, entry, and host surfaces.

## Process for one slice

1. Choose one primitive family or screen surface.
2. Search every selector in TSX and all destination stylesheets.
3. Record current desktop/phone behavior and relevant states.
4. Move the final rule to its owner; consolidate with existing variables.
5. Remove only the superseded legacy declarations.
6. Verify behavior before selecting another slice.

Do not combine selector movement with a redesign. Reduce specificity or
`!important` only when coverage proves the cascade remains correct.

## Suggested order

1. Shared primitives and accessibility states.
2. Platform/auth/dashboard.
3. Storefront shell, header, and booth information.
4. Featured deck and browsing controls.
5. Product grid and list cards.
6. Cart, product detail, checkout, payment, and sheets.
7. Admin header/orders/products/settings/team.
8. Storefront designer and preview.

Keep the `legacy.css` import in `src/main.tsx` until no route depends on it.

## Verification per slice

- Desktop and phone for the affected route.
- English and Vietnamese when copy can wrap.
- Loading, empty, error, success, sold-out, and long-content states as relevant.
- Product grid and list modes for product/card work.
- Sheet entrance/exit, backdrop cleanup, body interaction, focus, and reduced
  motion for overlay work.
- Focused tests, then `npm run check` and `git diff --check`.

Report the selectors moved, legacy declarations removed, and surfaces checked.

## Final removal

When searches and visual coverage show no dependency:

1. remove the import and file in one focused change;
2. run the full test and visual matrix;
3. add a CI guard preventing recreation of the file/import.
