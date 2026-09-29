# P12 Receivables evidence

Captured on 2026-09-29 from the running Next.js app in headless Chrome with the isolated `issue-128` database. The synthetic contract has one installment, nominal R$ 250, an 8% punctuality discount, and a 2026-10-10 due date. The app was filtered to the synthetic payer.

- `before-desktop.png` (1280 × 800) and `before-narrow.png` (390 × 844): unpaid installment shows the conditional R$ 230 on-time amount, while its posted balance remains R$ 250.
- `after-desktop.png` and `after-narrow.png`: after two effective-date payments of R$ 100 and R$ 130 on 2026-10-10 through the individual Finance operation, the same installment shows received R$ 230, nominal R$ 250, discount R$ 20, and paid status. Its derived balance is zero (asserted in the integration test).

The narrow screenshots scroll the existing horizontally scrollable table to the amount column. They are direct browser screenshots; no DOM values were replaced or drawn into the images.
