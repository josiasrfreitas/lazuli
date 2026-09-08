# Expose finance through one module API

Status: Accepted
Decision date: 2026-09-07
Supersedes: [0012](0012-expose-receivables-through-one-module-api.md)
Superseded by: None
Legacy sources: None
Implementation evidence: [`CONTEXT.md`](../../CONTEXT.md), [`packages/api/src/finance/index.ts`](../../packages/api/src/finance/index.ts), [`tooling/eslint/boundaries.js`](../../tooling/eslint/boundaries.js)

## Context

Decision 0012 exposed the deep module as `receivables(db, staffUserId)`. Since then the module has
grown to cover the whole commercial area: payers, orders, installments, adjustments, payments and
finance settings. The tRPC router (`finance`), the domain calculators (`finance-ledger`), the
Prisma model `FinanceSettings` and the tests already called that area "finance", while the source
folder and the factory still said "receivables", which decision 0007 uses for the derived ledger of
what is owed. Two names for one area, and one name for two concepts.

The domain glossary (`CONTEXT.md`, 2026-09-07) fixes the vocabulary: **Finance** is the area;
**Receivables** is the derived ledger inside it. The test tree is being mirrored onto
`packages/api/src/<area>/` (issue #62), so the source folder has to carry the area's name.

## Decision

Expose the finance area through `finance(db, staffUserId)` from `packages/api/src/finance/index.ts`.
The shape decided in 0012 is unchanged: the public surface exports the factory, public result types
and required error constants; internal coordinators under `finance/internal/` remain private and the
ESLint privacy zone enforces it.

`receivables` remains the name of the derived ledger and of nothing else: `receivablesSnapshot`,
`overdueList`, student balances, `ledger-read`, `@lazuli/domain`'s `receivables-dashboard` and the
persisted artifact kind `OVERDUE_RECEIVABLES_CSV`. The tRPC router key `finance` and its procedure
names are a wire contract and do not change.

## Consequences

- `packages/api/src/receivables/` is renamed to `packages/api/src/finance/`; the factory and its
  types (`FinanceModule`, `FinanceDatabase`) follow. Callers inside the API update their imports;
  nothing outside `packages/api` imported the factory.
- New names in this area come from `CONTEXT.md`. A name that exists to compute what is owed says
  `receivables`; anything else in the area says `finance`.
- tRPC remains the RBAC and transaction boundary. Pure calculators remain in `@lazuli/domain`.

## Alternatives

- **Keep `receivables` as the module name.** Rejected: the module covers payers, orders and
  settings, which are not receivables, and the glossary would be born with an exception.
- **Rename the router key to `receivables` instead.** Rejected: it moves the mismatch to the wire
  contract and spreads a ledger term over the whole area.
- **Rename `OVERDUE_RECEIVABLES_CSV` too.** Rejected: it names the overdue ledger export, which is
  a receivables concept, and it is a persisted value that would need a migration.
