# P12 — Pontualidade na quitação em dia

## Scope

- Show the contracted on-time amount as a conditional value in Receivables, separate from applied adjustments.
- Permit individual contract payments by effective date. A payment that completes the discounted amount on or before the due date creates one discount adjustment, the payment entry, and allocations in one transaction.
- Keep contract batch reconciliation, manual contract adjustments and waivers unavailable until their respective work items. Do not add a payment page or migrate historical records.

## Decisions and dependencies

- #118 and #121 are closed. The agreed rule in `FINANCIAL_DECISIONS.md` is cumulative on-time payment: nominal R$ 250, conditional R$ 230, R$ 100 + R$ 130 by due date closes the installment; R$ 100 alone does not earn a discount.
- Use the contract snapshot `punctualityDiscountPct`, never current FinanceSettings. The effective payment date controls eligibility; `createdAt` and `createdById` retain recording time and author.
- Preserve existing `finance(db, staffUserId)` and the router transaction. Lock installment rows before checking balance and discounts. An already paid installment cannot receive another allocation or discount. Retry needs an explicit command identity; inspect existing `externalReference` semantics before choosing its use.
- Historical/legacy installments and overdue contract scenarios remain protected according to #129/#130/#131. Dates are business dates in America/Sao_Paulo.

## Expected files

- `packages/domain/src/` for the pure cumulative eligibility calculation and unit tests.
- `packages/api/src/finance/internal/register-payment.ts`, `payment-store.ts`, `installments-query.ts`, and adjacent tests for transaction, persistence and derived read.
- `packages/validators/src/finance.ts`, `packages/api/src/finance/router.ts` and transport tests for input/output and retry.
- `apps/web/src/features/installments/` and view tests for conditional amount, received amount and zero balance.
- Schema/migration only if a durable command identity cannot be represented safely by the existing model.

## Test contract

- Unit: eligibility uses cumulative allocations and the effective date; R$ 100 partial does not discount, R$ 100 + R$ 130 by due date discounts R$ 20, a late effective date does not.
- Integration: discount/payment/allocation commit together, rollback together, concurrent or repeated submissions cannot double apply; query returns received R$ 230 and balance zero.
- Transport: validation, authorization, serialized result and repeat behavior through the real procedure; batch remains blocked for contracts.
- UI: separate nominal and paid columns, each on one line; nominal R$ 250 and received R$ 230 remain separate. Hover/focus shows the conditional amount before payment and the applied percentage after settlement. Partial payment is explicit in the status.

## Validation and visual evidence

- Run focused unit, integration and transport tests, then proportional format/lint/type/build checks, prospective test quality, complete diff review and `git diff --check`.
- Capture genuine before and after Receivables screenshots at 1280 × 800 and a narrow viewport using the running app with real seeded or test data; commit evidence and link it in the PR. The current placeholder e2e command is not visual evidence.

## Presentation revision (user feedback)

- Amount information must not increase row height. Use the available horizontal space for separate **Valor nominal** and **Valor pago** columns in flat and grouped tables.
- Do not stack nominal, discount delta, balance, or received labels. Keep the discount percentage in a hover/focus tooltip next to the relevant amount, with an inline indicator.
- Show partial payment in the status while preserving overdue information. A partial receipt does not claim the conditional discount was applied.
- Keep original screenshots as evidence of the superseded presentation; capture the revised desktop/narrow layout and a real tooltip.
