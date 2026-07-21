# Matsuri design guide

This document records the durable visual and interaction direction for Matsuri. It is not a special Codex instruction file by itself; `AGENTS.md` tells coding agents to read it before broad UI work or introducing a new visual pattern.

## Product character

Matsuri should feel like a polished independent artist booth: warm, expressive, compact, and trustworthy. It should not feel like a generic enterprise dashboard or a themed game launcher. Shop branding can be playful, but checkout, stock, payment, and fulfilment states must remain calm and legible.

## Visual foundation

- Use warm page backgrounds with white or near-white content surfaces.
- Use dark navy for primary typography, booth green for primary actions, red for destructive actions, and restrained amber for warnings.
- Prefer existing CSS variables such as `--ink`, `--muted`, `--line`, `--surface`, `--coral`, `--navy`, `--green`, `--red`, `--page-bg`, and `--store-radius` over hard-coded colors.
- Keep borders light and shadows soft. Avoid stacking several bordered cards inside another heavy bordered card.
- Use pill shapes for compact statuses, filters, badges, and stock labels. Do not turn every control or container into a pill.
- Keep supporting copy short. Use hierarchy, spacing, and alignment before adding decorative containers.

## Storefront

The storefront belongs to the individual shop. `booth_settings` controls its palette, corner radius, module order, locale, and card/featured/control/product styles. New storefront UI must work across those variants rather than assuming the default theme.

- Product imagery and shop identity lead; controls should remain easy to find without dominating the page.
- Featured banner copy stays static while slides change. Animate the visual deck, not the surrounding text.
- Verify product cards in both grid and list modes after changing their structure or CSS.
- On phone layouts, booth information lives in the header modal; do not restore the desktop booth-info sidebar card.
- Payment and order states should prioritize clarity over visual novelty.

## Platform and admin

Platform pages and the admin workspace share Matsuri's visual language but are not recolored by an individual storefront theme.

- Admin screens should optimize for scanning, quick actions, and safe confirmation of consequential operations.
- Dense tools may use compact spacing, but touch targets and readable labels still take priority.
- Destructive and fulfilment actions need distinct states and explicit feedback.
- Collapse complex two-column admin layouts when their content becomes cramped, usually before the 760px phone breakpoint and around 1100px where needed.

## Responsive behavior

- Treat 760px and below as phone layout.
- Give grid and flex children that contain text `min-width: 0`.
- Do not use fixed heights to align content that can wrap or localize.
- Avoid horizontal clipping and interactions that depend on hover.
- Keep mobile controls comfortably tappable with centered icons and labels.
- Sheets must animate entrance and exit, remove their backdrop after closing, restore body interaction, and account for safe-area insets.

## Motion and feedback

- Use short, purposeful motion to explain a state change, reveal hierarchy, or preserve spatial context.
- Prefer a few meaningful transitions over constant micro-animation.
- Respect `prefers-reduced-motion` where practical.
- Use the shared toast system for transient feedback and inline alerts for messages that must remain attached to a form or content region.
- Preserve visible keyboard `:focus-visible` feedback. The shared reset owns removal of native mobile tap highlights.

## Content and localization

- Storefront and gacha strings belong in `src/lib/i18n/catalogI18n.tsx`.
- Platform, auth, dashboard, and admin strings belong in `src/lib/i18n/platformI18n.tsx`.
- Update English and Vietnamese together. Layouts must tolerate longer translated copy without clipping or fixed-height failures.
- Prefer direct, friendly language. Clearly distinguish pending, confirmed, cancelled, expired, offline, and error states.

## Ownership and review

Screen-specific styles belong in their owning stylesheet as documented in `AGENTS.md`; do not solve local layout problems with broad global selectors. When introducing a new visual pattern, first check for an existing component, token, or pattern that can be extended.

For meaningful UI changes, visually verify desktop and phone layouts, English and Vietnamese copy, loading/empty/error/success states, keyboard focus, and the affected storefront card modes or admin workflows.
