# PR #225 — lint progress

> **LOCKED BATCH 1: API and domain.** Original 80 errors: 66 in `packages/api` and 14 in `packages/domain`. Domain is now at zero errors; API fixes have not yet had a full recount. Exact baseline inventories: `pnpm -F @lazuli/api lint > /tmp/lazuli-api-lint.log 2>&1` and `pnpm lint > /tmp/lazuli-pr225-root-lint-baseline.log 2>&1` (the root run stopped at domain). Web inventory: `pnpm -F @lazuli/web lint > /tmp/lazuli-pr225-web-lint-baseline.log 2>&1`, 177 errors. **Next completion gate:** zero errors from API and domain targeted lint, then relevant typechecks/tests and full `pnpm lint` with per-file/rule comparison before choosing batch 2.

This PR is already published. Lint fixes are in scope for the PR and will be pushed after checks. The initial full root run stopped at the domain package, so other workspace errors remain to be inventoried by the next full run. Logs are supporting snapshots; this document is the durable lock.

## Batch 1 files and original errors

| File                                                                   | Errors |
| ---------------------------------------------------------------------- | -----: |
| `packages/api/src/class-records/read.ts`                               |      1 |
| `packages/api/src/dashboard/home-audience.ts`                          |      5 |
| `packages/api/src/dashboard/home-coverage.ts`                          |      6 |
| `packages/api/src/dashboard/home-insights.ts`                          |      3 |
| `packages/api/src/dashboard/home-schedule.ts`                          |      2 |
| `packages/api/src/dashboard/home.ts`                                   |      2 |
| `packages/api/src/dashboard/router.ts`                                 |      2 |
| `packages/api/src/finance/internal/contract-renegotiation.ts`          |      9 |
| `packages/api/src/finance/internal/overdue-contracts.ts`               |      2 |
| `packages/api/src/finance/internal/payment-store.ts`                   |      1 |
| `packages/api/src/finance/payment-proof-transport.ts`                  |      6 |
| `packages/api/src/finance/payment-proofs.ts`                           |      5 |
| `packages/api/src/students/agenda.ts`                                  |      7 |
| `packages/api/src/students/health.ts`                                  |      6 |
| `packages/api/src/students/router.ts`                                  |      2 |
| `packages/api/test/finance/contract-renegotiation.integration.test.ts` |      6 |
| `packages/api/test/finance/payment-methods.integration.test.ts`        |      1 |
| `packages/domain/src/student-health.ts`                                |     10 |
| `packages/domain/test/contract-reduction.unit.test.ts`                 |      4 |

Batch 1 contains API and domain rules for the new dashboard, student, and finance contracts. Web files are held for the next batch. No lint rules or required assertions may be weakened.

Domain targeted lint reached zero errors (6 existing/new warnings) after extracting the health policy constants/level rule and marking synchronous test registrations explicitly. Snapshot: `/tmp/lazuli-pr225-domain-after1.log`.
