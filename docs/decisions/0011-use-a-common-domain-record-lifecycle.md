# Use a common domain-record lifecycle

Status: Accepted
Decision date: Unknown
Extraction date: 2026-07-27
Supersedes: None
Superseded by: None
Legacy sources: [D-0034](../legacy/2026-07-27/MVP/decisions.md#d-0034-uuidentity-base-for-all-domain-tables) (Accepted)
Implementation evidence: [`packages/db/src/index.ts`](../../packages/db/src/index.ts), [`packages/db/src/soft-delete.ts`](../../packages/db/src/soft-delete.ts)

## Context

Domain records need consistent identity, timestamps, and deletion behavior.

## Decision

Domain tables use UUID identity plus created, updated, and soft-delete timestamps. Product flows set
the soft-delete timestamp rather than hard-deleting these records.

## Consequences

Domain-specific operational timestamps remain separate from lifecycle timestamps.

## Alternatives

Not recorded; do not reconstruct.

## Unknowns and non-goals

Better Auth adapter tables and the `FinanceSettings` singleton are explicit exceptions.
