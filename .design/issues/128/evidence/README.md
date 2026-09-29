# P12 Receivables evidence

Captured on 2026-09-29 from the running Next.js app in headless Chrome with the isolated `issue-128` database. The synthetic contract has one installment, nominal R$ 250, an 8% punctuality discount, and a 2026-10-10 due date. The app was filtered to the synthetic payer.

- `before-desktop.png` (1280 × 800) and `before-narrow.png` (390 × 844): unpaid installment shows the conditional R$ 230 on-time amount, while its posted balance remains R$ 250.
- `after-desktop.png` and `after-narrow.png`: after two effective-date payments of R$ 100 and R$ 130 on 2026-10-10 through the individual Finance operation, the same installment shows received R$ 230, nominal R$ 250, discount R$ 20, and paid status. Its derived balance is zero (asserted in the integration test).

The narrow screenshots scroll the existing horizontally scrollable table to the amount column. They are direct browser screenshots; no DOM values were replaced or drawn into the images.

## Revised presentation

The original `before-*` / `after-*` captures above document the superseded stacked presentation.

- After the final user revision, nominal amounts have no condition indicator; only applied discounts appear next to paid amounts.
- `compact-desktop.png` (1280 × 800) and `compact-narrow.png` (390 × 844) show the revised separate **Valor nominal** / **Valor pago** columns. The running app is filtered to P12 synthetic data: a R$ 100 partial receipt, an unpaid installment, and the original R$ 230 discounted settlement. All three desktop rows measure 48 px in the browser, with one-line monetary cells.
- The two additional synthetic contracts use the current local settings snapshot (10% condition). The original settled contract retains its 8% snapshot. The partial receipt was registered through `finance(...).registerPayment`; it does not apply a discount.
- `compact-tooltip-desktop.png` captures a real pointer hover showing **Desconto aplicado: 8%** next to the settled R$ 230 receipt. Keyboard focus was also inspected in the browser.
- The revised narrow capture scrolls to the two monetary columns; situation remains farther to the right in the same scrollable table. No DOM values were replaced or drawn into these screenshots.
