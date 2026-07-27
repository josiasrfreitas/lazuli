# Runtime topology

Status: Accepted
Decision date: Unknown
Extraction date: 2026-07-27
Supersedes: None
Superseded by: None
Legacy sources: [D-0001](../legacy/2026-07-27/MVP/decisions.md#d-0001-monolith-first) (Accepted)
Implementation evidence: [`apps/`](../../apps/), [`packages/`](../../packages/)

## Context

Lazuli needs one primary application codebase while some work requires a separate runtime.

## Decision

Use a monolith-first topology: the web application, business logic, and shared Postgres data model
live in one repository. Workers are separate processes only where runtime requirements require them.

## Consequences

Services may be extracted only when later scaling, security, or integration needs justify that cost.

## Alternatives

Not recorded; do not reconstruct.

## Unknowns and non-goals

This record does not claim that any worker workflow is implemented.
