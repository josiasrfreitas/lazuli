# Model receivables as a payer-scoped derived ledger

Status: Accepted
Decision date: Unknown
Extraction date: 2026-07-27
Supersedes: None
Superseded by: None
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
