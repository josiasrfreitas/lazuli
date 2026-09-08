# Expose receivables through one module API

Status: Superseded
Decision date: 2026-07-08
Extraction date: 2026-07-27
Supersedes: None
Superseded by: [0018](0018-expose-finance-through-one-module-api.md)
Legacy sources: [D-0037](../legacy/2026-07-27/MVP/decisions.md#d-0037-receivables-as-a-deep-module) (Accepted)
Implementation evidence: [`packages/api/src/finance/index.ts`](../../packages/api/src/finance/index.ts), [`tooling/eslint/boundaries.js`](../../tooling/eslint/boundaries.js), [`packages/api/test/finance/module.integration.test.ts`](../../packages/api/test/finance/module.integration.test.ts)

## Context

Receivables persistence orchestration needs one public module boundary rather than externally imported
coordinators.

## Decision

Expose receivables through `receivables(db, staffUserId)`. The public surface exports the factory,
public result types, and required error constants; internal coordinators remain private.

## Consequences

tRPC remains the RBAC and transaction boundary. Pure calculators remain in `@lazuli/domain`.

## Alternatives

Not recorded; do not reconstruct.

## Unknowns and non-goals

This is an API-shape decision, separate from receivables ledger semantics.
