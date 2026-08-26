# Use Kysely for complex relational reads

Status: Accepted
Decision date: 2026-08-26
Supersedes: None
Superseded by: None
Legacy sources: None
Implementation evidence: None

## Context

Some read paths need relational aggregation, derived values, grouping, ordering, and pagination in
one database operation. The receivables installment display is the first case: overdue balances
must be derived from installments, adjustments, and payment allocations before payer groups can be
ordered and paginated. Prisma's ordinary query API would require materializing every candidate in
the application before pagination, while `$queryRaw` would give up schema-aware query composition
and result inference.

Prisma already owns the PostgreSQL schema, migrations, writes, and ordinary reads under
[0014](0014-use-postgresql-through-prisma.md). Receivables balances remain derived rather than
stored under [0007](0007-model-receivables-as-a-payer-scoped-derived-ledger.md), and their public
surface remains the module defined by [0012](0012-expose-receivables-through-one-module-api.md).

## Decision

Use Kysely for complex relational read queries that Prisma's ordinary query API cannot express
without unbounded application-side materialization or untyped raw SQL. Generate Kysely database
types from `schema.prisma` with `prisma-kysely`, and execute Kysely through the Prisma driver and
interactive transaction boundary with `prisma-extension-kysely`.

Prisma remains the only owner of schema, migrations, writes, and ordinary CRUD. Kysely does not
open an independent connection pool, own migrations, or become a general replacement for Prisma.
Each Kysely query stays inside the private data-access implementation of its owning deep module;
the first consumer is the receivables module's installment listing.

Kysely reads must:

- explicitly enforce the repository's soft-delete predicates because they bypass the Prisma
  soft-delete extension;
- receive business dates as parameters rather than depend on the database session timezone;
- derive, not persist, balances and display statuses;
- return bounded, paginated results from PostgreSQL;
- have database tests for grouping, pagination, search, and soft-delete behavior; and
- have parity tests against the corresponding pure domain calculators whenever SQL reproduces a
  domain formula.

## Consequences

Complex reads retain compile-time table and column awareness while PostgreSQL performs aggregation
and pagination close to the data. Application memory and transfer size stay bounded, and tRPC and
module boundaries do not change.

The repository gains a second database query API and generated Kysely types. Dependency versions,
Prisma extension composition, generated output, transaction behavior, and soft-delete filters need
explicit tests and maintenance. Kysely type safety does not prove financial correctness; parity
with the pure ledger remains mandatory.

## Alternatives

- **Prisma queries plus service-side grouping:** rejected for complex paginated reads because the
  service must materialize every candidate before it can form correct payer groups and counts.
- **`$queryRaw`:** remains available for small, isolated SQL seams, but was rejected as the default
  for this class of evolving read query because table, column, and result composition is not
  schema-aware.
- **Persisted balance or materialized read model:** rejected for this slice because it introduces
  synchronization and conflicts with the derived-ledger decision. It may be reconsidered only by a
  future decision if measured scale requires it.
- **Replace Prisma with Kysely:** rejected; schema ownership, migrations, writes, and ordinary CRUD
  remain with Prisma.

## Unknowns and non-goals

This record does not standardize Kysely for simple reads, authorize direct database access from
`apps/web`, or choose a persisted analytics/read-model architecture. It does not define the
installment display's product behavior, which belongs to its work item and design artifacts.
