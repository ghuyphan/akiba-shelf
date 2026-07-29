# Matsuri design guide

Read this before broad UI work or introducing a visual pattern. Matsuri should
feel like a polished independent artist booth: warm, expressive, compact, and
trustworthy. It should not resemble a generic enterprise dashboard or a game
launcher.

## Visual language

- Warm page backgrounds with white or near-white content surfaces.
- Dark navy typography, booth green primary actions, red destructive actions,
  and restrained amber warnings.
- Light borders and soft shadows; avoid heavy containers nested inside each
  other.
- Pill shapes for compact statuses, filters, badges, and stock labels, not for
  every control.
- Existing variables before hard-coded colors: `--ink`, `--muted`, `--line`,
  `--surface`, `--coral`, `--navy`, `--green`, `--red`, `--page-bg`, and
  `--store-radius`.
- Strong hierarchy and short supporting copy before decorative structure.

## Storefront

The shop owns its storefront identity. `booth_settings` controls palette,
radius, module order, locale, and card/featured/control/product styles. New UI
must work across every variant.

- Let product artwork and shop identity lead without hiding navigation or
  checkout controls.
- Featured copy stays static while the visual deck changes.
- Verify product cards in both grid and list modes.
- On phones, booth information stays in the header modal; do not restore the
  desktop sidebar card.
- Keep stock, payment, and order states calm and unambiguous.

## Platform and admin

Platform/admin pages use Matsuri's base language, not a shop's public theme.
Optimize for scanning, safe actions, and clear consequences. Dense tools may be
compact, but labels and touch targets remain readable and comfortable.

Use green for the primary path, red only for destructive actions, and explicit
confirmation/feedback for fulfilment, payment, membership, and deletion.

## Responsive behavior

- Phone layout begins at 760px and below; dense admin layouts may collapse near
  1100px.
- Text-bearing flex/grid children need `min-width: 0`.
- Do not use fixed heights for content that can wrap or localize.
- Avoid hover-only interactions and horizontal clipping.
- Sheets animate open and closed, clean up their backdrop, restore body
  interaction, and respect safe-area insets.
- Preserve visible `:focus-visible`; the shared reset owns mobile tap-highlight
  behavior.

## Motion and feedback

- Use short motion to explain hierarchy or state change, not constant
  decoration.
- Respect `prefers-reduced-motion`.
- Use `useToast()` for transient feedback and `Alert` for messages attached to
  a form or content region.

## Copy and review

- Storefront/gacha-host copy: `src/lib/i18n/catalogI18n.tsx`.
- Platform/auth/dashboard/admin copy: `src/lib/i18n/platformI18n.tsx`.
- Update English and Vietnamese together and allow longer translations to wrap.
- Prefer direct, friendly language with distinct pending, confirmed, cancelled,
  expired, offline, success, and error states.

## CSS ownership

- `global.css`: tokens, resets, shared buttons, fields, modal, alert, and toast.
- `catalog.css`: storefront, product, cart, checkout, and payment UI.
- `admin.css`: platform, auth, dashboard, and admin workspace.
- `gacha-admin.css`, `gacha-entry.css`, `gacha-host.css`: named surfaces only.
- `legacy.css`: compatibility only. Add no new rules; migrate one slice at a
  time using `docs/legacy-css-migration.md`.

## Storefront designer contract

Persisted `booth_settings` include layout order, corner radius, locale, theme
colors, and `card_style`, `featured_style`, `controls_style`, and
`product_style` variants.

Any new configurable storefront property requires:

1. Migration plus constraint/default when appropriate.
2. Shared type and runtime schema update.
3. Safe default in `src/lib/constants.ts`.
4. Designer control and preview.
5. Storefront consumption.
6. Desktop and phone verification.

## Visual verification

For meaningful UI changes, verify desktop and phone, English and Vietnamese,
loading/empty/error/success states, keyboard focus, and the affected grid/list,
modal, sheet, or admin workflow. After product-card CSS changes, verify both
grid and list modes.
