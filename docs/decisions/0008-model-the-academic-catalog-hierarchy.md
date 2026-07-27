# Model the academic catalog hierarchy

Status: Accepted
Decision date: Unknown
Extraction date: 2026-07-27
Supersedes: None
Superseded by: None
Legacy sources: [D-0030](../legacy/2026-07-27/MVP/decisions.md#d-0030-course-catalog--track-and-stage) (Accepted)
Implementation evidence: [`packages/db/prisma/schema.prisma`](../../packages/db/prisma/schema.prisma), [`packages/db/src/seed-course-catalog.ts`](../../packages/db/src/seed-course-catalog.ts)

## Context

The course catalog needs a durable hierarchy without cross-track equivalence.

## Decision

Model the catalog as ProductLine → Track → Stage. Tracks are independent; only `Stage.sequence`
orders stages within a track.

## Consequences

Product-line labels are data rather than hardcoded enum values.

## Alternatives

Not recorded; do not reconstruct.

## Unknowns and non-goals

Seed contents, CRUD scope, and Portal naming are not decided here.
