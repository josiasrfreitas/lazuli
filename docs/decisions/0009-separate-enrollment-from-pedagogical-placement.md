# Separate enrollment from pedagogical placement

Status: Accepted
Decision date: Unknown
Extraction date: 2026-07-27
Supersedes: D-0022's durable structural portion
Superseded by: None
Legacy sources: [D-0022](../legacy/2026-07-27/MVP/decisions.md#d-0022-class--enrollment--bones-now-brain-later), [D-0031](../legacy/2026-07-27/MVP/decisions.md#d-0031-enrollment-is-operational-stage-placement-lives-on-pedagogicalprogress) (Accepted)
Implementation evidence: [`packages/db/prisma/schema.prisma`](../../packages/db/prisma/schema.prisma), [`packages/api/src/enrollment/advance.ts`](../../packages/api/src/enrollment/advance.ts)

## Context

Operational class membership and a student's pedagogical stage are separate facts.

## Decision

Keep operational class membership on Enrollment and per-student stage placement on
PedagogicalProgress. An active PedagogicalProgress has no end date.

## Consequences

Changing pedagogical placement does not redefine enrollment's operational role.

## Alternatives

Not recorded; do not reconstruct.

## Unknowns and non-goals

Assessment behavior and interface acceptance are not decided here.
