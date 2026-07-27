# Separate academic and commercial calendars

Status: Accepted
Decision date: Unknown
Extraction date: 2026-07-27
Supersedes: None
Superseded by: None
Legacy sources: [D-0008](../legacy/2026-07-27/MVP/decisions.md#d-0008-rolling-enrollment-and-contract-periods), [D-0011](../legacy/2026-07-27/MVP/decisions.md#d-0011-installment-defaults) (Accepted)
Implementation evidence: [`packages/db/prisma/schema.prisma`](../../packages/db/prisma/schema.prisma), [`packages/domain/src/installment-generation.ts`](../../packages/domain/src/installment-generation.ts)

## Context

Enrollment and academic windows do not determine commercial installment timing.

## Decision

Model academic/enrollment windows and commercial installment schedules as separate concepts.

## Consequences

Rolling enrollment remains operationally independent of session-generation windows.

## Alternatives

Not recorded; do not reconstruct.

## Unknowns and non-goals

Installment defaults and interface behavior are not decided here.
