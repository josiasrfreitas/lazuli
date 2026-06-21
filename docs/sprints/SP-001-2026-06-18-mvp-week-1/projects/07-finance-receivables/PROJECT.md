# [P07] Finance / receivables

**Increment:** Increment 2 (Receivables)
**Status:** `ready-for-agent`
**Depends on:** P02 (students/beneficiary); P04 soft (enrollment prompts orders)
**Blocks:** P08 receivables dashboard/reports + overdue emails

## Goal

Manual receivables tracking: payers, orders, installments, adjustments, payment entries, and
allocations — all **derive-don't-store** (D-0032). No payment processing, no boleto, no Cora import.
This tracks what is owed and what was paid; it does not move money.

## Spec anchors

- PRD: S-FIN-1, S-FIN-2, S-FIN-3, S-FIN-6, S-FIN-7 (P0); S-FIN-4, S-FIN-5, S-FIN-8 (P1)
- Technical Spec: §4.7, §5.3, §7.1, §7.2, §4.8
- Decisions: D-0011, D-0012, D-0014, D-0017, D-0025, D-0028, D-0032

## Issues

### [P07-01] Finance schema (payer/order/installment/adjustment/payment/allocation)

- **Status:** `ready-for-agent`
- **Depends on:** P02-01
- **Trace:** §4.7, D-0028, D-0032, D-0025
- **Goal:** `Payer` (first-class, separate from `Guardian`), `Order`, `Beneficiary`, `Installment`, `Adjustment`, `PaymentEntry`, `Allocation`. Money in integer `*Cents` (BRL). No stored business status; no `GenerationPreset` (§14).
- **Acceptance:**
  - [ ] Non-negative / overpayment guards; cancelled orders non-collectible.
  - [ ] Waiver + adjustment **backbone** stored (required by D-0032) even though endpoints are P1.

### [P07-02] Create an order + generate installments

- **Status:** `ready-for-agent`
- **Depends on:** P07-01
- **Trace:** §4.7, §5.3, S-FIN-1
- **Goal:** Order creation with payer/beneficiary, commercial schedule inputs, due-day choice, remainder-on-last-installment generation, and edit cutoff. Installment rows ARE the schedule (no preset entity).
- **Acceptance:**
  - [ ] Generated installments sum to order total; remainder lands on the last (domain unit test, §10.1).
  - [ ] Edits blocked after the cutoff.

### [P07-03] Register a payment + allocations

- **Status:** `ready-for-agent`
- **Depends on:** P07-02
- **Trace:** §4.7, §5.3, S-FIN-3
- **Goal:** `PaymentEntry` + `Allocation` to installments; payer-scoped invariants (allocation payer/sum); concurrent-allocation serialization via `SELECT … FOR UPDATE`.
- **Acceptance:**
  - [ ] Allocations cannot cross payers or exceed installment balance.
  - [ ] Concurrent allocations serialize correctly (tRPC integration test, §10.1).

### [P07-04] Derived installment/order status, balances & interest preview

- **Status:** `ready-for-agent`
- **Depends on:** P07-01
- **Trace:** §3.2, §4.7, §7.1, S-FIN-2
- **Goal:** Pure `packages/domain` calculators for installment/order status, balances, 1% monthly interest **preview** (config), and age buckets in `America/Sao_Paulo`. Multa policy stays open (§1.3) — do not invent a rate.
- **Acceptance:**
  - [ ] Status/balance/empty-denominator covered by domain unit tests (§10.1).
  - [ ] Interest is preview-only; multa left configurable/unset pending decision.

### [P07-05] Batch reconcile

- **Status:** `ready-for-agent`
- **Depends on:** P07-03
- **Trace:** §5.3, S-FIN-3
- **Goal:** Batch payment reconcile flow over multiple installments/payers in one operation.
- **Acceptance:**
  - [ ] Batch reconcile applies allocations atomically and reports per-row outcome.

### [P07-06] Waivers / discounts / adjustments (P1)

- **Status:** `ready-for-agent` (P1)
- **Depends on:** P07-01
- **Trace:** §4.7, §5.3, S-FIN-5, S-FIN-8
- **Goal:** Minimal-admin endpoints over the adjustment/waiver backbone from P07-01.
- **Acceptance:**
  - [ ] Waive marks installment waived (non-collectible); discount adjusts via adjustment rows, not stored status.

### [P07-07] Receivables dashboard + per-student statement (extrato)

- **Status:** `ready-for-agent`
- **Depends on:** P07-04, P07-03
- **Trace:** §7.1, §7.2, §4.8, §6.2, S-FIN-6, S-FIN-7, S-DASH-2
- **Goal:** Receivables snapshot (collectible amounts, age buckets); async per-student statement artifact (GCS reference, not signed URL) via worker.
- **Acceptance:**
  - [ ] Dashboard metrics match §7.1; collection-attempt data NOT required (S-FIN-4 is P1).
  - [ ] Statement generated as an artifact with state transitions (worker test, §10.1).

## Definition of done (project)

- [ ] Finance flows + allocation/serialization invariants covered by domain + tRPC integration tests (§10.1).
- [ ] Derive-don't-store holds: no stored installment/order/percent status columns (§14).
