# Model receivables as a payer-scoped derived ledger

Status: Accepted
Decision date: Unknown
Extraction date: 2026-07-27
Supersedes: None
Superseded by: None
Legacy sources: [D-0025](../legacy/2026-07-27/MVP/decisions.md#d-0025-payer-as-a-first-class-entity), [D-0028](../legacy/2026-07-27/MVP/decisions.md#d-0028-finance-core-model--order), [D-0032](../legacy/2026-07-27/MVP/decisions.md#d-0032-finance-ledger--derive-dont-store-adjustments-payer-scoped-payments) (Accepted)
Implementation evidence: [`packages/domain/src/finance-ledger.ts`](../../packages/domain/src/finance-ledger.ts), [`packages/db/prisma/schema.prisma`](../../packages/db/prisma/schema.prisma)

## Context

Receivables need explicit payer ownership and balances that remain consistent with their entries.

## Decision

Model a payer as a first-class entity. Orders, beneficiaries, installments, adjustments, payments,
and payment allocations form the receivables ledger; statuses and balances are derived rather than stored.

## Consequences

Payments are payer-scoped and may span orders. Guardian and Payer are intentionally separate models.

## Alternatives

Not recorded; do not reconstruct.

## Unknowns and non-goals

Cora reconciliation, interest or multa policy, screens, and delivery status are not decided here.
