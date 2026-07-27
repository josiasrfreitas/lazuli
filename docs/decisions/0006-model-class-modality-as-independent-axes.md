# Model class modality as independent axes

Status: Accepted
Decision date: Unknown
Extraction date: 2026-07-27
Supersedes: None
Superseded by: None
Legacy sources: [D-0021](../legacy/2026-07-27/MVP/decisions.md#d-0021-class-modality-as-two-axes) (Accepted)
Implementation evidence: [`packages/db/prisma/schema.prisma`](../../packages/db/prisma/schema.prisma), [`packages/api/test/db/classes.test.ts`](../../packages/api/test/db/classes.test.ts)

## Context

Class scheduling and delivery format are distinct properties.

## Decision

Model class modality with independent `scheduleType` and `format` axes. Regular classes require a
shared stage; personalized classes do not carry that shared-stage requirement.

## Consequences

The conditional stage invariant is enforced at the data boundary.

## Alternatives

Not recorded; do not reconstruct.

## Unknowns and non-goals

Portal naming conventions remain unresolved and are not decided here.
