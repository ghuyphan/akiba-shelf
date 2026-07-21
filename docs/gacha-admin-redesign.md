# Gacha admin redesign — simplification plan

Status: proposed. Owner complaint: the gacha screen is "super complex and super
hard to understand". This plan simplifies the admin gacha workspace without
changing any data contract: `publishGachaConfiguration`, `saveGachaDraft`, RPC
validation, the simulator config shape, and featured-item limits all stay
as-is. This is a presentation-layer redesign.

Read together with the "Gacha featured-item limits" section in `AGENTS.md`.

## Diagnosis

Current screen (`GachaManager.tsx`, ~3,100 lines across 8 components) is one
flat scroll containing: game switcher + status chips, quick-setup card, game
setup (availability, copy, 9–11 rate/pity fields behind one `<details>`),
shared 3★ pool editor, banner strip with 5 actions, banner editor, pool
editor, and a sticky bar with 5 buttons (undo, redo, reset, save draft,
publish). Complexity drivers:

1. Gacha jargon everywhere ("pity", "soft pity", "featured guarantee",
   "rate-up slots") instead of merchant language.
2. 40+ controls visible at once; only the rates section is collapsible.
3. Two lookalike pool editors (banner pool vs shared 3★ pool) that behave
   differently — and the shared 3★ editor silently writes to whichever banner
   is currently selected.
4. Unclear primary action: Save draft vs Publish is a critical, unexplained
   distinction.
5. Five nesting levels (game → settings → banners → pool → featured rules) on
   one page.
6. Validation only surfaces as toasts at save/publish time, not inline.

## Guiding principles

1. **Merchant language, not gacha jargon.** "Pity" → "Guaranteed by pull #N".
   "Featured" → "Promoted". Game terms only where flavor matters.
2. **One primary action.** Everything funnels to "Publish". Draft becomes
   invisible autosave, not a decision.
3. **Progressive disclosure.** The screen answers three questions in order:
   *Is it on? What can people win? How lucky are they?* Everything else is
   collapsed by default.
4. **No data-contract changes.** Presentation only; the RPC stays the real
   validation gate.

## Proposed structure: three numbered cards + sticky bar

### Card 1 — "Status & copy" (always visible, ~5 controls)

- Big Open/Closed switch with plain consequence copy: "Customers can play
  right now" vs "Hidden from customers".
- Game switcher becomes a small segmented control (Genshin / HSR pills),
  losing its status-heavy bar treatment.
- Title + intro fields (already simple; keep).
- Live-status chips and the Preview button move here — Preview is the owner's
  "see what customers see" check.

### Card 2 — "Prizes & banners" (the heart of the screen)

- Merge the three stacked editors (banner list + banner editor + pool editor)
  into **one banner at a time**: banner picker strip on top, below it a single
  "Banner N" panel with name, schedule, and the prize list inline.
- Fold the Shared 3★ Souvenir Pool into this card as a third segmented tab
  next to "Included / Add merch", labeled "3★ filler prizes (shared)". This
  removes the lookalike second editor. Its hidden coupling to the selected
  banner (today it silently attaches entries to the selected banner) must
  become explicit UI or be fixed to a banner-agnostic slot.
- Featured selection becomes a "Promote on banner" star toggle per row with
  the counter "2/4 promoted" and the per-game rule hint inline:
  - HSR: "Shows one 5★ primary and up to three 4★ rate-ups."
  - Genshin: "Shows up to N promoted prizes, any mix of 4★ and 5★."
- Add disabled-reason tooltips on the promoted toggle ("The 5★ primary slot is
  taken", "All 4★ rate-up slots are full", "This banner already shows N
  promoted prizes").
- Demote element, weapon type/path, and weight behind one "Advanced options"
  disclosure per item row; keep safe defaults from the game descriptor.

### Card 3 — "Luck & guarantees" (collapsed by default)

- Presets promoted to the top as two big radio cards: "Booth mode — fast &
  generous" vs "Official replica". Summary line under the selection:
  "5★ guaranteed by pull #50".
- The 9–11 raw rate/pity fields move behind "Customize odds". Auto-clamping of
  soft pity stays.

### Sticky bar — reduce to 3 elements

- "Unsaved changes" badge (draft autosaves on debounce via the existing
  `saveGachaDraft` RPC; no Save draft button).
- "Discard changes" text button, with confirmation.
- **Publish** as the single obvious primary action.
- Undo/redo stays keyboard-only (Ctrl/Cmd+Z already wired); drop the buttons.

### Copy renames (update en + vi together in `catalogI18n.tsx`)

| Today | Proposed |
| --- | --- |
| Featured item | Promoted prize |
| Featured-item rate | Promoted-prize chance |
| Featured guarantee | Guarantee promoted prize after a miss |
| 4-star pity | 4★ guaranteed within N pulls |
| Soft pity | Luck improves after pull #N |
| Shared 3★ souvenir pool | 3★ filler prizes (shared by all banners) |
| Save draft | (removed — autosave) |

### Validation

Move the ~8 toast-only checks in `validateBasics` to inline field errors using
the existing `Alert` component attached to the offending field. Keep
publish-time toasts only as a final backstop; the RPC remains the real gate.

## Responsive layout

Breakpoints follow the app contract: phone ≤ 760px, complex two-column admin
layouts collapse by ~1100px, existing gacha CSS also uses 480px for small
phones. Every grid child that may contain text gets `min-width: 0`; never set
fixed heights to align cards; touch targets ≥ 44px with centered icons;
sheets animate both directions and restore body interaction; preserve
`:focus-visible` and `prefers-reduced-motion`.

### Desktop (≥ 1100px)

- Cards 1–3 stack full-width inside the admin content column (no side-by-side
  card grid — reading order must stay 1 → 2 → 3).
- Card 1: two-column inner grid — Open/Closed switch + status chips left,
  title/intro right.
- Card 2: banner picker strip horizontal; below it the "Banner N" panel uses
  the existing two-column pattern (banner fields left, prize list right) only
  while ≥ 1100px.
- Card 3: preset radio cards side by side (2-up).
- Sticky bar: badge left, Discard + Publish right, all on one row.

### Tablet / narrow desktop (760–1100px)

- Card 1 inner grid collapses to one column (switch row, then copy fields).
- Card 2: banner fields stack above the prize list — no two-column panel.
- Prize list rows keep the full row layout (name + controls inline) but wrap
  control groups onto a second line instead of shrinking text.
- Preset cards stay 2-up only if labels fit; otherwise stack.

### Phone (≤ 760px)

- Everything single column; game switcher segmented control goes full-width
  with two equal pills.
- Banner picker strip becomes horizontal scroll-snap cards (no wrap into
  tiny columns); add/duplicate/move/delete actions collapse into one overflow
  menu per selected banner instead of 4–5 always-visible icon buttons.
- Prize rows become two-line rows: line 1 = product name + rarity stars,
  line 2 = controls (promote star, weight, remove) with ≥ 44px targets.
- "Advanced options" per row opens the existing sheet/modal pattern rather
  than expanding inline (sheets must animate entrance and exit, remove the
  backdrop after closing, and restore body interaction).
- Sticky bar: "Unsaved changes" badge shrinks to a dot + short label; Discard
  becomes an icon-with-label or moves into an overflow menu; Publish stays a
  full-height primary button, minimum 48px tall.
- 480px and below: prize-row controls may wrap to a third line; never let
  the promote star or remove button shrink below 44px.

## Design language mapping

Stay inside `src/styles/gacha-admin.css` (screen-specific) and shared
primitives from `src/styles/global.css`; do not add broad global selectors,
do not add rules to `legacy.css`, prefer existing CSS variables:

- Cards: existing `AdminCard` primitive — white/near-white on the warm soft
  background, `1px solid var(--soft-line, #eee9e1)`, soft shadow, no stacked
  heavy borders.
- Typography: `var(--ink, #20304a)` headings, `var(--muted, #677284)`
  supporting copy, strong hierarchy, short copy.
- Primary action (Publish, promote toggle when active): booth green
  `var(--accent, #5f8d55)` with the existing color-mix tints for hover/focus.
- Destructive (Discard, remove, delete banner): `var(--danger, #b42318)` as
  text/outline buttons, never filled red next to Publish.
- Warnings (validation hints): restrained amber, inline `Alert`, not toasts.
- Chips/badges ("2/4 promoted", "Live now", "Unsaved changes"): pill-shaped,
  following the existing `gacha-chip` pattern.
- Numbered card headings (1 · 2 · 3): pill number badge in booth green tint +
  short sentence of supporting copy under each title.
- Motion: card sections expand/collapse with short (≤ 250ms) transitions;
  honor `prefers-reduced-motion` (the stylesheet already has the query).

## Phasing (each phase shippable independently)

1. **Phase 1 — copy & disclosure** (low risk, ~2 days): renames (en + vi),
   rates behind "Customize odds", Genshin rule hint, disabled-reason tooltips,
   3★ tab merged into the pool editor. Touches `GachaGeneralSection`,
   `GachaPoolEditor`, `GachaBannerEditor`, `catalogI18n.tsx`.
2. **Phase 2 — sticky bar & autosave** (~1–2 days): debounced draft autosave,
   single Publish button, inline validation, responsive sticky bar. Touches
   `GachaManager`, `GachaStatusBar`.
3. **Phase 3 — unified banner panel** (~3 days): merge banner list/editor/pool
   into the one-banner-at-a-time panel, resolve the shared-3★ banner coupling,
   banner picker scroll-snap on phone, overflow menus for banner actions.
   Update `e2e/fixtures.ts` selectors in the same change.

## Verification per phase

- `npm run check` and `git diff --check`.
- `npm run test:e2e` (gacha flows live in `e2e/storefront.spec.ts`; update
  `e2e/fixtures.ts` whenever admin DOM structure changes).
- Visual pass: desktop and phone admin gacha screen, en + vi copy, empty /
  unsaved / published-live / validation-error states, sheet open/close on
  phone, keyboard focus visible throughout.
- Confirm publish still rejects invalid configs via the RPC (limits from
  `AGENTS.md` → "Gacha featured-item limits" unchanged).
