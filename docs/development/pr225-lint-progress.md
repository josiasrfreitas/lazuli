# PR #225 — lint progress

> **LOCKED BATCH 2: Home and student profile UI.** Original and latest remaining: 102 errors across the 16 files below. Exact targeted command: `pnpm -F @lazuli/web exec lazuli-lint src/features/admin-home/{home-arrival-motion.ts,home-arrival.tsx,home-audience.tsx,home-default.tsx,home-pending-coverage.tsx,home-pending-model.ts,home-pending.tsx,home-summary-charts.tsx,home-summary-loading.tsx,home-summary.tsx,home.tsx,use-chart-entrance.ts} src/features/students/profile/{student-agenda-dialog.tsx,student-health.tsx,student-overview.tsx,student-page.tsx}`. Source snapshot: `/tmp/lazuli-pr225-web-after-batch1.json`. **Next completion gate:** zero errors across all 16 files, relevant typecheck/tests, then full `pnpm lint` and per-file/rule/message comparison before choosing batch 3.

This PR is already published. Lint fixes are in scope for the PR and will be pushed after checks. The full root run after batch 1 stopped at `packages/ui`; separate machine-readable inventories captured all remaining failing workspaces. Logs are supporting snapshots; this document is the durable lock.

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

Batch 1 is closed: API and domain full-package lint each report zero errors. API typecheck, API and web unit tests, and the renegotiation integration tests against a fresh migrated database pass. `pnpm test:affected --base origin/main` stopped at its concurrent unit tier due to timeouts and canceled processes; transient probe files were removed. Root `pnpm lint` stopped at UI. Machine-readable inventories captured 178 web, 1 UI, and 3 root errors in `/tmp/lazuli-pr225-{web,ui,root}-after-batch1.json`. Comparing file, rule, and message with CI snapshot `/tmp/lazuli-pr225-static-baba.log` found no new errors in those workspaces; API/domain errors were removed.

Batch 1 is closed: API and domain full package lint each report zero errors, API typecheck and unit tests pass, and the renegotiation integration tests pass against a fresh migrated temporary database. `pnpm test:affected --base origin/main` stopped at its unit tier after launching many packages at once; timeouts and canceled test processes left temporary guardrail probes, which were removed. The independently run API and web unit suites passed. The full root lint snapshot `/tmp/lazuli-pr225-root-after-batch1.log` stopped at UI, so failing workspaces were inventoried with `lintFiles({cwd,files})` from `tooling/eslint/run-oxlint.mjs` into `/tmp/lazuli-pr225-{web,ui,root}-after-batch1.json`. They contain 178 web, 1 UI, and 3 root errors, 182 total. Comparing file, rule, and message against CI snapshot `/tmp/lazuli-pr225-static-baba.log` found zero new errors and zero removed errors in those workspaces; batch 1 removed the API/domain errors.

## Batch 2 files and original errors

| File                                                               | Errors |
| ------------------------------------------------------------------ | -----: |
| `apps/web/src/features/admin-home/home-arrival-motion.ts`          |      3 |
| `apps/web/src/features/admin-home/home-arrival.tsx`                |      1 |
| `apps/web/src/features/admin-home/home-audience.tsx`               |      2 |
| `apps/web/src/features/admin-home/home-default.tsx`                |      6 |
| `apps/web/src/features/admin-home/home-pending-coverage.tsx`       |      1 |
| `apps/web/src/features/admin-home/home-pending-model.ts`           |     17 |
| `apps/web/src/features/admin-home/home-pending.tsx`                |      2 |
| `apps/web/src/features/admin-home/home-summary-charts.tsx`         |     11 |
| `apps/web/src/features/admin-home/home-summary-loading.tsx`        |      2 |
| `apps/web/src/features/admin-home/home-summary.tsx`                |      3 |
| `apps/web/src/features/admin-home/home.tsx`                        |      1 |
| `apps/web/src/features/admin-home/use-chart-entrance.ts`           |      5 |
| `apps/web/src/features/students/profile/student-agenda-dialog.tsx` |     17 |
| `apps/web/src/features/students/profile/student-health.tsx`        |     11 |
| `apps/web/src/features/students/profile/student-overview.tsx`      |     12 |
| `apps/web/src/features/students/profile/student-page.tsx`          |      8 |
