# Background-work boundary

Status: Accepted
Decision date: Unknown
Extraction date: 2026-07-27
Supersedes: None
Superseded by: None
Legacy sources: [D-0004](../legacy/2026-07-27/MVP/decisions.md#d-0004-hatchet-for-background-work) (Accepted)
Implementation evidence: [`packages/job-contracts/`](../../packages/job-contracts/), [`packages/worker-handlers/`](../../packages/worker-handlers/)

## Context

Long-running and scheduled work must not hold a tRPC request open.

## Decision

Use Hatchet as the workflow control plane and GCP workers for background work. Request handlers
enqueue work and return quickly; workers own later processing and persisted status or artifacts.

## Consequences

Portal submission, reports, or messaging use this boundary if implemented.

## Alternatives

Not recorded; do not reconstruct.

## Unknowns and non-goals

Workflow registration and operational behavior are not established by this record.
