# Background-work boundary

Status: Accepted
Decision date: Unknown
Extraction date: 2026-07-27
Supersedes: None
Superseded by: None
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
