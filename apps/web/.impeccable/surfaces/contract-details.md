---
version: 1
slug: "contract-details"
primary_target: "apps/web/src/features/students/profile/finance-details-dialog.tsx"
related_targets:
  [
    "apps/web/src/features/students/profile/finance-details-dialog.module.css",
    "apps/web/src/features/students/profile/contract-invoice.tsx",
    "apps/web/src/features/students/profile/contract-invoice.module.css",
    "apps/web/src/features/students/profile/contract-invoice-totals.tsx",
    "apps/web/src/features/students/profile/contract-installments.tsx",
    "apps/web/src/features/students/profile/contract-installments.module.css",
    "apps/web/src/features/students/profile/finance-payment-history.tsx",
    "apps/web/src/features/students/profile/student-payments.tsx",
    "apps/web/src/features/students/profile/student-payments.module.css",
  ]
---

# Contract details

Mode: Operate. Ordinary extension of the incumbent Lazuli system.

## Direction contract

THESIS: a compact invoice whose item prices, scholarships, ledger adjustments, receipts, and
closing balance reconcile.

OWN-WORLD: existing semantic surfaces, borders, status badges, and standard controls. Cambria
serif body and headings accompany Calibri numeric values. The built invoice uses caption text
(13 px), control headings (13.5 px), item amounts (16 px), and the closing balance (24 px),
through existing typography tokens. Restrained disclosure motion respects reduced motion.

STORY: title and student, items with expandable tuition installments, scholarship
conditions and ledger adjustments, then the balance. Actual receipts have a separate view only
when data exists; punctuality analysis remains secondary and requires settlement history.

FIRST VIEWPORT: a single desktop header row aligned with the close button, followed by the
invoice with its restored vertical rhythm. Five installment rows remain visible inside their
own scroll area when expanded; taller content may use the outer modal-body scroll.

FORM: the user explicitly pinned an invoice composition. This refinement follows the built code;
no concept seed, visual comp, or replacement global design specification is needed. The user
rejected vertical compression and then requested “10% mais alto, 10% menos largo” relative to
the restored collapsed desktop baseline of 768 × 533 px.

## Surface contract

- At desktop widths of at least 48 rem, the modal's maximum width is the smaller of 43.2 rem
  and the viewport minus 2 rem. Its minimum height is the smaller of 36.625 rem and the dynamic
  viewport height minus 4 rem. These local CSS dimensions implement the user's 10% narrower,
  10% taller proportions; they are not shared system tokens. The prior arbitrary Tailwind width
  expression has been removed. Consider a shared dialog-size contract only if this behavior is
  reused elsewhere.
- Preserve the restored vertical spacing: column headings use 8 px block padding and items use 12 px. The closing
  section starts after 16 px, totals have 8 px gaps, and the balance has 4 px top margin plus
  12 px top padding. Do not compress these groups to force expanded content into one viewport.
- The user removed the Vigência, Pagador, and Vencimento section; the contract now leads directly
  into its items. Item status uses `A receber` where appropriate. Material's original price is struck through
  above its discounted amount, including a zero final charge for a full scholarship.
- Mensalidades expands through native details/summary. Its chevron follows the title so item
  names stay aligned with material rows; hover changes only the title and chevron color.
  Installment rows show sequence, due date, status, amount, and an accessible icon-only proof
  action. The table retains five visible rows and a sticky header while further rows scroll.
- Totals show Subtotal before tuition and material scholarships, then separate Bolsas e
  descontos, card fees, ledger adjustments, school receipts, and Saldo a receber. Conditional
  lines appear only when applicable; the closing balance comes from the receivable ledger.
- Receipts appear latest first, with expandable proof details. No receipt navigation or empty
  history area is reserved when the student has no actual receipts. Existing proof attachment
  and download controls remain available under their existing conditions.
- Narrow layouts wrap the header, move payment terms beneath each item, stack conditions and
  totals, and allow the modal body to scroll. Numeric alignment and semantic status meanings
  remain consistent with desktop.

## Completed evidence and review — 2026-11-06

The user subsequently removed the Vigência, Pagador, and Vencimento block and requested no further
subagents. The primary agent inspected the updated desktop and mobile captures at
`.impeccable/review/invoice-without-meta-desktop.png` and
`.impeccable/review/invoice-without-meta-mobile.png`; the removed block has no placeholder space.
The desktop modal retains its requested size, and the mobile layout remains within the viewport.

Proportions review: **SHIP**, scoped to the size correction before removal of the contract facts. Its captures are
`.impeccable/review/invoice-proportions-desktop.png` and
`.impeccable/review/invoice-proportions-mobile.png`. At 1026 × 755, the collapsed desktop modal
measures 691.195 × 586 px, centered, with no horizontal overflow. At 390 × 844, the mobile modal
measures 358 × 780 px with no horizontal overflow and all totals visible. Current style and
whitespace checks passed; invoice logic is unchanged.

Prior revision's independent finish review: **SHIP**, with no material fixes. It accepted six
captures in `.impeccable/review/`: `invoice-desktop.png`, `invoice-mobile.png`,
`invoice-expanded-desktop.png`, `invoice-expanded-mobile.png`, `invoice-receipts-desktop.png`,
and `invoice-receipts-mobile.png`.

That prior revision's desktop validation at 1026 × 755 recorded modal width 768 px, expanded
height 689 px, body height 599 px, and no outer overflow. The installment viewport is 212 px
(32 px header plus five 36 px rows). All 12 rows remain reachable through its own scroll area;
the parent body stayed at scroll position zero. This no-outer-overflow measurement is historical.
The five-row installment scroller is unchanged; restored spacing and the shared maximum dialog
height now permit outer body scrolling for expanded content in shorter viewports.

The prior mobile validation at 390 × 844 recorded a modal 358 px wide without horizontal overflow.
The installment viewport is
312 px (52 px header plus five 52 px rows); the outer body scrolls to the remaining invoice.
An actual fixture without receipts confirmed that receipt navigation and blank history space
are absent. Native summary clicks and focus were verified. Orca keyboard activation was
unreliable and is not claimed as verified. The existing proof attachment dialog opened correctly;
no payment or upload was submitted in the browser.

Earlier validation: five invoice-total unit tests and one isolated ledger/proof integration test
with rollback passed.
Scoped API lint reported zero errors and warnings. Scoped web lint reported zero errors and ten
warnings: nine incumbent findings and the former Tailwind width exception. Style,
component-line, owned-file formatting, and whitespace checks passed. An earlier full web
typecheck remained blocked by the preexisting nullable-string error in
`packages/api/src/finance/internal/payment-reversals.ts:201` and concurrent student-filter and
unused-style errors outside this slice. Full suite and build remain for integration or CI.

Documentation checked the implementation, stylesheets, shared typography tokens, frontend guide,
root PRODUCT.md, and the sibling finance surface brief. PRODUCT.md's stale Cloud SQL statement
is outside this UI scope and was not repaired or adopted as authority. No global design documents
were created or changed for this ordinary extension.
