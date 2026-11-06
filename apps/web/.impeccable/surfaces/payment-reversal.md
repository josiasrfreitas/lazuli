---
version: 1
slug: "payment-reversal"
primary_target: "apps/web/src/features/students/profile/payment-reversal-dialog.tsx"
related_targets:
  [
    "apps/web/src/features/students/profile/payment-reversal-form.tsx",
    "apps/web/src/features/students/profile/payment-reversal-history.tsx",
    "apps/web/src/features/students/profile/payment-reversal-loading.tsx",
    "packages/ui/src/components/dialog.tsx",
    "packages/ui/src/styles/components/dialog.css",
    "apps/storybook/src/components/dialog.stories.tsx",
    "packages/ui/src/components/segmented-control.tsx",
    "apps/storybook/src/components/segmented-control.stories.tsx",
    "docs/frontend/forms.md",
  ]
---

# Payment reversal

Mode: Operate. The user confirmed preserving the existing flow and visual identity while
reducing excess space, margins, and distracting dialog animation.

## Direction

The latest user direction widens the naturally sized modal to a maximum of 72 rem within the
viewport, with 16 px minimum horizontal margins. Preserve the shared dialog's horizontal and
vertical centering; the temporary top-offset and translation overrides were removed following
the user's correction. The form determines the desktop dialog height. The 224 px receipt sidebar
matches the form's height and scrolls within that space, removing the empty area below the form
shown in the user's 15.21.37 screenshot. On narrow screens the receipt list takes the full width
above the operation. Refund fields occupy a second
inner column at the large breakpoint; smaller layouts stack them below the allocation fields.
Related fields use the existing FormSection and FormRow primitives. The total to reopen sits
beside one primary confirmation action.

New operations open with Estorno selected and placed first, with a RotateCcw icon. Cancelar
recebimento appears second with a CircleX icon. Both icons are decorative and hidden from assistive
technology. Restoring a persisted attempt preserves its original operation kind. Receipt choices
show installment number and amount, then date and method; the
user requested removing the payer name. The receipt scroller reserves 16 px on the right to
separate choices from its scrollbar.

Loading states use shared InlineSkeleton primitives shaped like the receipt rows and refund
form columns. Screen readers receive a loading announcement, and reduced motion follows the
shared primitive. The loading form has a 352 px desktop minimum height to approximate the refund
form. Its description placeholder fills the available width up to 320 px, avoiding narrow-screen
overflow. Earlier loading geometry measurements predate the final height refinement.

Reuse the incumbent semantic colors, typography, numeric styles, controls, and attachment
components. Refund dates use the Brazilian date mask and inline validation. Initial focus moves
to the selected receipt when asynchronous data arrives. Extracted reversal history retains its
attachment controls and upload behavior.

The shared DialogContent now offers an optional subtle motion variant: a 160 ms opacity fade
without scaling, shortened to 100 ms with reduced motion. The Dialog Storybook exposes this
variant. This is a narrow extension; it establishes no replacement global visual identity.

The user also requested the shared SegmentedControl pill treatment globally. A muted rounded
track contains a raised selected capsule, white in light mode and blue in dark mode, using
existing semantic tokens. The shared 32/40 px sizes, interaction behavior, keyboard focus,
invalid state, disabled state, and reduced-motion support remain part of its contract. Wrapped
choices retain their row height. The authoritative form guidance and component examples are
updated in `docs/frontend/forms.md` and the SegmentedControl Storybook.

## Evidence and disposition — 2026-11-06

Current disposition: **RECAPTURE — visual review pending**. The latest screenshot attempt timed
out; the subsequent browser attempt returned `browser_tab_not_found` after the tab was closed.
The final icons, flex scroller replacement, and mobile skeleton-width correction have no visual
confirmation. Earlier dialog captures cannot establish the current appearance.
The most recent independent review returned **RECAPTURE**, requiring current desktop and mobile
screenshots after the fixes, with no required code correction; it preceded the latest height,
loading, and operation-order corrections.

Latest implementation handoff reports these DOM checks against the actual Orca browser at
`backlog-04-11.lazuli.localhost`:

- At 1280 × 800, the height-refined dialog measured 1152 × 471.6953 px at x=64, y=164.1523,
  centered vertically and approximately 58 px shorter than the previous layout. The sidebar
  and form both measured 351 px high, with their bottom edges aligned at y=610.8477. This
  measurement preceded the equivalent flex scroller replacement and is not a measurement of
  the final source revision.

Historical loading checks, before the final height refinement:

- With paymentReversalOptions delayed by 1.8 seconds, the dialog remained at x=16, y=138.2148,
  width=994, height=529.5703 px before, during, and after loading. The receipt sidebar likewise
  remained at x=41, y=233.9102, width=224, height=408.875 px throughout.
- The form showed 19 skeleton elements while loading and zero after completion. Estorno was
  selected by default and payer names were absent from receipt choices.
- The receipt choice's right edge was 249 px and the list's was 265 px, confirming the requested
  16 px scrollbar clearance.

Earlier layout and shared-control checks, before the loading and receipt-copy corrections:

- At 1280 × 800, the dialog measured 1152 × 529.5703 px at x=64, y=135.2148, centered
  vertically at 400 px, with no overflow.
- At 390 × 844, the dialog measured 358 × 780 px at x=16, y=32, centered vertically at
  422 px, with no overflow.
- Storybook's dark wrapped choices occupied two rows with 24 px item heights and no overflow;
  arrow-key focus was verified. `segmented-states-light.png` is a current control-state capture,
  not evidence for the final dialog layout.

Earlier interaction checks, before the latest layout revision:

- Enter with `31/02/2026` displayed the inline date error and focused the date field.
  Typing `06112026` produced `06/11/2026` and cleared the error. Tab moved from date to
  method to reference.
- Orca's Escape keypress did not reach the DOM; a synthetic Escape event closed the dialog.
  Native key delivery therefore remains unverified.

Three focused reversal tests passed after the default-operation change. Latest scoped web lint
reported zero errors; warnings cover existing semantic-token false positives and the intentional
responsive dialog-width expression. Earlier checks passed shared
UI and Storybook typechecks and style checks; scoped UI and Storybook lint reported zero errors
and zero warnings. Earlier validation passed three
focused reversal tests, seven existing payment tests, component line limits, formatting, and
whitespace checks; the design detector returned no findings. Earlier scoped web lint reported
zero errors and eleven false positives for existing semantic
`text-caption`, `text-control`, and `shadow-focus` tokens, whose definitions were confirmed in
`packages/ui/src/styles/tokens/tailwind-bridge.css`. Web typecheck remains blocked by the
preexisting `string | null` to `string` error in
`packages/api/src/finance/internal/payment-reversals.ts:201`.

No financial mutation or upload was submitted during browser validation. Fresh captures and
visual approval remain outstanding; browser measurements and code review do not supply that
approval. Full repository delivery checks remain for the PR gate or CI.

Documentation checked the repository-root PRODUCT.md, frontend guide, existing finance surface
brief, changed components, shared semantic token definitions, and updated form guidance. No
separate global design specification is needed for these existing shared primitives.

## Receipt sequence hierarchy — 2026-11-06

The user requested sequence numbers in the receipt list. Each choice now leads with its actual
installment number beside the amount; payment date and method share the secondary line. The
latest user correction removes the payer name. Multiple installment numbers are sorted and
deduplicated; material charges retain
their own label. The API returns sequence numbers from active allocations belonging to the
current student, using the same filter as receipt membership.

Earlier Orca validation confirmed labels from Parcela 7 through Parcela 1 and that selecting
Parcela 6 opens its matching allocation. The historical desktop capture is
`.impeccable/review/reversal-sequences-desktop.png`; it predates the latest layout and centering.
At 390 × 844, receipt choices and the dialog body have no horizontal overflow. The narrow capture
still timed out, so this evidence does not complete visual signoff for both viewports. Typecheck
continues to report only the preexisting API error recorded above.

Earlier independent review: **SHIP**, scoped to that incremental receipt hierarchy and its
captured desktop cancellation state. It does not approve the latest dialog geometry or shared
control revision. Current visual signoff remains pending as recorded above.
