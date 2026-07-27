# Use PostgreSQL through Prisma

Status: Accepted
Decision date: Unknown
Extraction date: 2026-07-27
Supersedes: None
Superseded by: None
Legacy sources: [accepted legacy stack](../legacy/2026-07-27/MVP/decisions.md#current-stack)
Implementation evidence: [`packages/db/prisma/schema.prisma`](../../packages/db/prisma/schema.prisma), [`packages/db/prisma/migrations/`](../../packages/db/prisma/migrations/), [`packages/db/prisma/migrations/README.md`](../../packages/db/prisma/migrations/README.md)

## Context

The application needs a relational database and a defined ownership path for ordinary schema changes.

## Decision

Use PostgreSQL 16 through Prisma. Prisma owns ordinary tables, columns, relations, enums, indexes,
and migrations. Raw SQL is limited to constraints Prisma cannot express.

## Consequences

The raw-SQL constraint channel is narrow and does not replace ordinary Prisma schema ownership.

## Alternatives

Not recorded; do not reconstruct.

## Unknowns and non-goals

Production hosting and Cloud SQL connectivity are not decided here.
