# Model student contacts and shared addresses

Status: Accepted
Decision date: Unknown
Extraction date: 2026-07-27
Supersedes: None
Superseded by: None
Legacy sources: [D-0033](../legacy/2026-07-27/MVP/decisions.md#d-0033-structured-guardian-and-address-entities) (Accepted)
Implementation evidence: [`packages/db/prisma/schema.prisma`](../../packages/db/prisma/schema.prisma), [`packages/db/prisma/migrations/20260629005043_gre_18_student_guardian_address/migration.sql`](../../packages/db/prisma/migrations/20260629005043_gre_18_student_guardian_address/migration.sql), [`packages/api/test/db/students.test.ts`](../../packages/api/test/db/students.test.ts)

## Context

Student contact data needs structured guardians, documents, and shareable addresses.

## Decision

Model Guardian and Address as structured entities. An address may be shared, and Guardian and Payer
remain intentionally separate without a foreign-key relationship. A minor Student must have a
Guardian; a document number requires a document type.

## Consequences

The accepted data invariant is independent of the mechanism used to enforce it.

## Alternatives

Not recorded; do not reconstruct.

## Unknowns and non-goals

D-0033 specified a trigger. The current applied migration uses a `CHECK` constraint. No owner decision
resolving trigger versus `CHECK` was found; neither mechanism is the extracted decision.
