---
version: 1
slug: "student-finance-materials"
primary_target: "apps/web/src/features/students/profile/student-finance.tsx"
related_targets:
  [
    "apps/web/src/features/students/profile/student-materials.tsx",
    "apps/web/src/features/students/profile/finance-overview.tsx",
    "apps/web/src/features/installments/payment/payment-dialog.tsx",
  ]
---

# Student finance and materials

Mode: Operate. Extend the existing Lazuli visual system. Desktop is the user's priority.
Implement directly in the application; the user explicitly declined prototypes.

## Direction contract

THESIS: keep the student's charges together and make tuition and material recognizable at a glance.

OWN-WORLD: existing semantic tokens, serif interface typography, numeric values, compact controls,
and shared Dialog and DataTable primitives. The finance summary uses the same accent surface and
border as the pedagogical summary. No global visual-system change.

STORY: scan balances, identify the charge, inspect material coverage when needed, and record receipt.
Material acquisition creates one school receivable; the buyer's bank installments are payment terms.

FIRST VIEWPORT: compact finance summary with secondary Material didático and Contrato e detalhes
buttons; the unified charge table below identifies material by type and book names. The material
dialog shows current coverage, next acquisition, and a compact purchase history, with one primary action.

FORM: the user's confirmed composition: general material information in a modal and material rows
in the existing unified list. No concept seed or comp is needed for this specified extension.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Confirmed behavior

- Keep the existing automatic card fee and existing gross/net amounts; add no duplicate amount fields.
- Payment methods declare whether bank installments are allowed; the receipt stores their count.
- Bank installments do not create additional school receivables or school payment entries.
- Preserve existing styles and development data; no full seed, lint, typecheck, or build for this task.
- Design documentation preserves the incumbent system; no DESIGN.md replacement for this extension.

## Completed evidence and review — 2026-10-29

Finish review: **SHIP**, with no material findings. The independent reviewer examined the four
real Orca captures at 1026 × 755 in `.impeccable/review/`: `finance-material-desktop.png`,
`material-modal-desktop.png`, `material-acquire-desktop.png`, and `material-receipt-desktop.png`.
Browser evidence confirms Crédito with six bank installments, no viewport overflow, and the full
receipt visible. No payment was submitted, preserving the development fixture.

Supplemental review: **SHIP** for `.impeccable/review/finance-all-charges-desktop.png`; the Situação
column now uses the standard width, keeping every visible status badge complete on one line.

The finance summary retains the incumbent accent background and border; material details open
in a modal, and the unified charge list distinguishes material from tuition. One material charge
and one school receipt retain the existing gross/net amounts and automatic 10% fee. The payment
method declares installment capability and the receipt records the buyer's installment count.

Validation reported by the implementation handoff: 12 web payment tests and 10 material API
integration tests passed; feature whitespace checks passed. Full lint, typecheck, and build were
deferred per the user. Unrelated existing whitespace failures remain in
`packages/api/test/students/intake.integration.test.ts` and `scripts/seed/admissions.ts`.

Documentation examined the incumbent summary styles, this contract, and the repository-root
`PRODUCT.md` (`apps/web/PRODUCT.md` is absent). Its preexisting Cloud SQL reference remains stale;
global design and product documents were not changed for this ordinary extension.
