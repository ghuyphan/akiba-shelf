# Gacha admin workspace

This is the UI contract for the admin gacha editor. It simplifies merchant
workflows without changing draft/publish RPCs, simulator config, or featured
composition rules. Read the gacha invariants in `AGENTS.md` first.

## Current structure

The editor follows three numbered cards and one sticky action bar:

1. **Status & copy**: open/closed state, title, introduction.
2. **Prizes & banners**: one selected banner, its settings, included merch,
   promoted prizes, and shared 3-star filler pool.
3. **Luck & guarantees**: simple presets first; custom rates behind disclosure.
4. **Sticky actions**: autosave status, discard changes, and one primary
   Publish action.

Game switching and customer Preview stay in the compact status bar. Avoid
returning to one flat page with every field visible.

Main ownership:

- `GachaManager.tsx`: orchestration, validation, persistence, publish.
- `components/admin/gacha/`: focused editor sections and history state.
- `gacha-admin.css`: all screen-specific layout and responsive behavior.
- `api/gacha.ts`: Supabase draft/published/publish contracts.
- `gachaGames.ts` and `gachaLimits.ts`: game rules and host normalization.

## Language

Use merchant language before game jargon:

| Prefer                      | Avoid as primary label      |
| --------------------------- | --------------------------- |
| Promoted prize              | Featured item               |
| Promoted-prize chance       | Featured-item rate          |
| Guaranteed by pull #N       | Pity                        |
| Luck improves after pull #N | Soft pity                   |
| 3-star filler prizes        | Shared 3-star souvenir pool |

Game-native terms may appear in supporting copy where they help customers or
experienced staff. Admin strings belong in `platformI18n.tsx`; update English
and Vietnamese together.

## Prize editor rules

- Edit one banner at a time. Keep banner selection, banner fields, and its prize
  list in the same card.
- Show promoted counters and the exact composition hint next to the control.
- Explain disabled promotion controls, for example when a rarity slot is full
  or an item kind does not match the banner.
- Keep element, path/weapon type, and weight secondary to product selection and
  promotion. Put specialist controls behind Advanced options where practical.
- Make the shared 3-star pool visibly shared; never imply it belongs only to the
  currently selected banner.
- Keep safe defaults from the game descriptor and leave the RPC as the final
  validation authority.

## Validation and actions

- Show field/section errors inline with `Alert` near the cause. Toasts are the
  final publish/save backstop, not the only explanation.
- Draft saving remains automatic. Do not reintroduce a competing Save draft
  primary button.
- Publish is the only primary action. Discard is secondary/destructive text or
  outline treatment.
- Keep undo/redo keyboard support; visible controls are optional only when they
  do not crowd the main workflow.

## Responsive behavior

- At 1100px and wider, cards remain stacked in reading order. The banner panel
  may use fields left and prizes right.
- Between 760px and 1100px, stack banner fields above prizes and let control
  groups wrap without shrinking product text.
- At 760px and below, use one column, a full-width game switcher, horizontal
  banner selection, and at least 44px action targets.
- On small phones, move secondary banner actions into an overflow menu and
  advanced item options into the shared modal/sheet pattern.
- No fixed card heights. Add `min-width: 0` to text-bearing grid/flex children.
- Preserve sheet cleanup, `:focus-visible`, and `prefers-reduced-motion`.

## Remaining simplification work

- Convert remaining toast-only validation to inline section errors.
- Reduce secondary controls visible in each prize row, especially on phones.
- Confirm the shared 3-star editor has no hidden selected-banner coupling.
- Keep splitting orchestration only when tests can cover the extracted boundary.

## Verification

- `npm run check`, `npm run test:e2e`, and `git diff --check`.
- Verify desktop and phone admin, English and Vietnamese, empty/unsaved/live/
  validation-error states, keyboard focus, and mobile sheet open/close.
- Confirm invalid compositions still fail at the publish RPC and valid Genshin
  and HSR configurations still reach both simulators.
