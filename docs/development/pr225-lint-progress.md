# PR #225 — lint progress

> **BATCH 4: remaining lint backlog.** Original: 50 errors across the 18 files below; latest remaining: 0. Source snapshots: `/tmp/lazuli-pr225-{web,ui,root}-after-batch3.json`; final snapshots: `/tmp/lazuli-pr225-{web,ui,root}-after-batch4.json`.

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

Batch 3 is closed: the 23-file targeted lint reports zero errors, web typecheck, 328 web unit tests, web build, styles, and the changed-file quality gate pass. The full root lint still stops at the pre-existing UI table-filter error. Machine-readable inventories in `/tmp/lazuli-pr225-{web,ui,root}-after-batch3.json` contain 46 web, 1 UI, and 3 root errors. Compared by file, rule, and message with the post-batch-2 inventory, exactly 50 errors were removed and zero were added. The changed tracked files pass formatting; the repository-wide format command also sees seven pre-existing untracked `.scratch/` files with formatting issues, which are not part of this PR.

## Batch 4 files and original errors

> **LOCKED BATCH 4: remaining lint backlog.** Exactly 50 errors across the 18 files below. Source snapshots: `/tmp/lazuli-pr225-{web,ui,root}-after-batch3.json`. Close only after targeted and full lint, proportionate tests, and a machine-readable comparison with zero new errors.

| File                                                                        | Errors |
| --------------------------------------------------------------------------- | -----: |
| `apps/web/src/app/api/payment-proofs/[id]/route.ts`                         |      1 |
| `apps/web/src/app/login/login-entrance.tsx`                                 |      4 |
| `apps/web/src/features/admin-home/home-default.tsx`                         |      6 |
| `apps/web/src/features/admin-home/home-pending-coverage.tsx`                |      1 |
| `apps/web/src/features/admin-home/home-pending.tsx`                         |      2 |
| `apps/web/src/features/admin-home/home-summary-charts.tsx`                  |     11 |
| `apps/web/src/features/appointments/class-meeting-step.tsx`                 |      1 |
| `apps/web/src/features/class-records/class-record-dialog.tsx`               |      1 |
| `apps/web/src/features/classes/class-teacher.tsx`                           |      1 |
| `apps/web/src/features/financial-treatments/financial-dialog-loading.tsx`   |      1 |
| `apps/web/src/features/installments/payment/logic.ts`                       |      2 |
| `apps/web/src/features/installments/payment/use-payment-confirmation.ts`    |      2 |
| `apps/web/src/features/shared/task-form.tsx`                                |      2 |
| `apps/web/src/lib/animation-preview.ts`                                     |      7 |
| `apps/web/test/features/contract-renegotiation-form-contract.unit.test.tsx` |      4 |
| `packages/ui/src/components/table-filters.tsx`                              |      1 |
| `scripts/lib/workspace-full.mjs`                                            |      2 |
| `scripts/seed/student-attendance.ts`                                        |      1 |

Batch 4 is closed: targeted lint and full `pnpm lint` report zero errors. Machine-readable inventories show web 46→0, UI 1→0, and root scripts 3→0, with zero added errors. Web typecheck, all 328 web unit tests, web build, styles, and changed-file quality gate pass. All changed tracked files pass formatting and `git diff --check`. The repository-wide `pnpm format:check` still finds seven pre-existing untracked `.scratch/` files; it also observed a transient lint probe because that command ran concurrently with lint. Browser validation remains blocked by the worktree hostname's 404 and the fixture login's 403, as recorded under Batch 2.
