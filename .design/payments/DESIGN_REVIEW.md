# Payment registration dialog redesign

Date: 2026-09-30. Scope: the existing registration dialog in Recebíveis, including its search,
receipt groups and confirmation summary. Screenshots use local development fixtures.

## Diagnosis

[Before](screenshots/before.png) · [After](screenshots/after.png) ·
[Mobile](screenshots/after-mobile.png) · [Several receipts](screenshots/after-multiple.png)

The initial desktop dialog was 896 px wide, with a 417 px date input and a 260 px received-value
input. Both date and payment method expanded into equal-width columns regardless of their content.
Every installment reserved a separate adjustment column even when it had no interest or discount.
Its identity and amount occupied different rows, leaving a large empty center. The payer appeared
only inside the details menu. Search remained expanded after adding an installment and competed
with the selected items for vertical space.

The visual feedback loop used the running application with the same installment before and after.
Orca navigation and DOM inspection worked, but repeated screenshot requests timed out when its
embedded tab lost visibility. The saved screenshots and behavioral checks use a separate headless
Chrome session against the same local application; no screenshot is a generated mockup.

## Business rules reviewed

- A receipt belongs to one payer and can allocate money across multiple installments/orders.
  Explicitly separated receipts for the same payer must remain separate groups.
- One operation supplies the effective date and payment method. The date drives the existing
  settlement preview; the browser must not calculate its own alternative balance.
- The preview distinguishes the existing balance, new interest, applied punctuality discount,
  received amount and remaining balance. Partial payment does not automatically earn the discount.
- Invalid or missing amounts must not be described as full settlement. Preview failures must stay
  visible. Uncertain confirmation must keep its existing retry/recovery behavior.

Basis: `CONTEXT.md`, decisions 0007 and 0015, the payment draft/preview/operation implementations,
and `packages/domain/src/payment-settlement.ts`. No financial rule or persistence behavior changed.

## Contained implementation plan and result

1. Retain the product's typography, semantic colors, Base UI primitives and dark theme.
2. Limit the desktop dialog to 720 px; date to 144 px, method to 192 px and received amount to
   160 px. On mobile, keep touch-sized controls and allow the form body to scroll independently.
3. Show a named payer header and subtotal for each receipt. Place installment identity, balance,
   conditional adjustments and received value on the same desktop row. Keep details secondary.
4. Place the add action beside the installment count. Collapse search after adding an item;
   retain its search text/page for the next addition. Omit single-page pagination.
5. Keep the total, remaining balance and submit action together in a fixed footer. Disable an empty
   operation. Preserve first-field focus, semantic form submission and pending/uncertain guards.
6. Validate the rendered interface, financial examples and keyboard flow; retain before/after evidence.

Measured after: 720 px dialog width, 144 px date input, 160 px received-value input. The single-item
state is approximately 474 px high (previously 503 px), now also displaying the payer and receipt
subtotal. At 375 × 812, the dialog is 343 px wide with no horizontal overflow and a visible footer.
At 1280 × 800, the default single-item body needs no vertical scrolling.

## Design-system exceptions

The requested density needs unequal tracks sized to a date, method and amount. These local grid
tracks deliberately use fixed rem lengths with flexible identity text; equal FormRow columns
reproduce the diagnosed waste. No new global spacing tokens are warranted by one form.

The existing `sm` primitives are not responsive across Input, SelectTrigger and Button. This dialog
keeps `sm` on desktop and locally uses 44 px targets/16 px input text on mobile, numeric text for
amounts, right-aligned money and an inset search icon. A local footer rule separates confirmation
from editable content. These bounded overrides trigger non-blocking design lint warnings. If this
pattern is reused, the proposed shared contract is an opt-in responsive dense size across those
three primitives, plus an Input leading-icon slot. Introducing global changes is outside this slice.
Existing caption/control typography tokens also trigger the lint color classifier; no rule was disabled.

## Validation

Passed:

- Eight payment form/draft unit tests, including receipt ownership/allocation rendering and invalid
  amount feedback; seven settlement domain tests.
- Web TypeScript; targeted ESLint (zero errors, style/classifier warnings described above); targeted
  Prettier; component line limit; `git diff --check`.
- Prospective test quality gate: zero errors. Contextual loop warnings are expected here: the control
  loop is preceded by an exact input-count assertion, and invalid amounts use a nonempty literal list.
- Live-browser checks: add, search collapse, R$100 partial payment against R$760 (R$660 remaining),
  same-payer grouping, different payers, explicit receipt separation, removal and mobile overflow.
- Live discount example: a R$250 installment receives R$25 discount on full settlement; entering R$100
  removes that discount and leaves R$150. Both states were captured.
- First-field focus, left-to-right desktop Tab order, Enter validation for an invalid date, Escape,
  and fixed-footer/default-body geometry. No browser runtime errors in the interaction checks.

Limitations:

- Final commit validation fixed module-level header initialization and updated table expectations
  for the shared DataTable. All package unit suites and the production build passed.
  Full integration and transport tiers also passed against an isolated migrated database.
- Browser checks exercised the live preview without confirming a financial mutation. No payment was
  persisted during this review. The server's existing confirmation/idempotency logic is unchanged.
