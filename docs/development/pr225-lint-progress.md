# PR #225 — lint progress

> **LOCKED BATCH 3: Student operations.** Original and latest remaining: 50 errors across the 23 files below. Exact targeted command: `pnpm -F @lazuli/web exec lazuli-lint src/features/students/profile src/features/students/filter-options.ts src/features/students/students-page.tsx src/features/students/students-table.tsx src/features/assessments/progress-chart.tsx src/features/assessments/student-progress-loading.tsx src/features/appointments/appointment-dialog-context.tsx src/features/appointments/student-appointment-dialog.tsx`. Source snapshot: `/tmp/lazuli-pr225-web-after-profile.json`. **Next completion gate:** zero errors across the 23 files, relevant typecheck/tests, full `pnpm lint`, machine-readable comparison, then lock another batch of about 50.

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

Batch 1 is closed: API and domain full package lint each report zero errors, API typecheck and unit tests pass, and the renegotiation integration tests pass against a fresh migrated temporary database. `pnpm test:affected --base origin/main` stopped at its unit tier after launching many packages at once; timeouts and canceled test processes left temporary guardrail probes, which were removed. The independently run API and web unit suites passed. The full root lint snapshot `/tmp/lazuli-pr225-root-after-batch1.log` stopped at UI, so failing workspaces were inventoried with `lintFiles({cwd,files})` from `tooling/eslint/run-oxlint.mjs` into `/tmp/lazuli-pr225-{web,ui,root}-after-batch1.json`. They contain 178 web, 1 UI, and 3 root errors, 182 total. Comparing file, rule, and message against CI snapshot `/tmp/lazuli-pr225-static-baba.log` found zero new errors and zero removed errors in those workspaces; batch 1 removed the API/domain errors.

The initially locked UI set contained 102 errors. Before the owner set a 50-error batch size, Home edits resolved 34 errors and web typecheck passed; 20 Home errors remain. Those edits are retained but Home is parked until a later batch. The current 68-error snapshot divides into the 48-error student-profile batch below and 20 Home errors. The remaining 76 web errors outside that initial set, 1 UI error, and 3 root-script errors are also parked.

## Batch 2 files and original errors

| File                                                               | Errors |
| ------------------------------------------------------------------ | -----: |
| `apps/web/src/features/students/profile/student-agenda-dialog.tsx` |     17 |
| `apps/web/src/features/students/profile/student-health.tsx`        |     11 |
| `apps/web/src/features/students/profile/student-overview.tsx`      |     12 |
| `apps/web/src/features/students/profile/student-page.tsx`          |      8 |

Batch 2 is closed: the four profile files report zero errors. Web typecheck, web unit tests, and web build pass. The root lint run stopped at the existing UI error; separate machine-readable inventories show web 96, UI 1, and root scripts 3 errors. Compared with the post-batch-1 snapshot by file, rule, and message, 82 web errors were removed (34 Home, 48 profile), and zero errors were added in web, UI, or root. Browser inspection remains blocked: the worktree hostname returns 404, while the running Next.js server on localhost:3002 redirects to login and rejects a local fixture login with HTTP 403. Web build and styles checks pass, but this is not browser validation.

## Batch 3 files and original errors

| File                                                                       | Errors |
| -------------------------------------------------------------------------- | -----: |
| `apps/web/src/features/appointments/appointment-dialog-context.tsx`        |      2 |
| `apps/web/src/features/appointments/student-appointment-dialog.tsx`        |      1 |
| `apps/web/src/features/assessments/progress-chart.tsx`                     |      1 |
| `apps/web/src/features/assessments/student-progress-loading.tsx`           |      3 |
| `apps/web/src/features/students/filter-options.ts`                         |      1 |
| `apps/web/src/features/students/profile/attendance-history-dialog.tsx`     |      1 |
| `apps/web/src/features/students/profile/attendance-history-list.tsx`       |      1 |
| `apps/web/src/features/students/profile/attendance-history-loading.tsx`    |      1 |
| `apps/web/src/features/students/profile/contract-renegotiation-dialog.tsx` |      4 |
| `apps/web/src/features/students/profile/contract-renegotiation-fields.tsx` |      2 |
| `apps/web/src/features/students/profile/contract-termination-dialog.tsx`   |      1 |
| `apps/web/src/features/students/profile/finance-history-dialog.tsx`        |      5 |
| `apps/web/src/features/students/profile/finance-overview.tsx`              |      1 |
| `apps/web/src/features/students/profile/registration-edit-dialog.tsx`      |      1 |
| `apps/web/src/features/students/profile/student-agenda-scheduling.tsx`     |      7 |
| `apps/web/src/features/students/profile/student-finance.tsx`               |      1 |
| `apps/web/src/features/students/profile/student-loading.tsx`               |      1 |
| `apps/web/src/features/students/profile/student-payments.tsx`              |      5 |
| `apps/web/src/features/students/profile/student-pedagogy.tsx`              |      1 |
| `apps/web/src/features/students/profile/student-registration.tsx`          |      2 |
| `apps/web/src/features/students/profile/use-section-carousel.ts`           |      3 |
| `apps/web/src/features/students/students-page.tsx`                         |      2 |
| `apps/web/src/features/students/students-table.tsx`                        |      3 |
