# PR 253 lint progress

> **Closed batch 2:** 50 original errors in the 15 files below; latest remaining: 0 in targeted lint; web types, six focused tests and the styles gate passed. Full lint confirmed 768 remaining errors: exactly 50 removed, zero added.
> **Baseline:** 818 full-repository errors, `/tmp/lazuli253-lint-after-batch1.json`; batch snapshot `/tmp/lazuli253-batch2-baseline.json`.
> **Command:** `pnpm -F @lazuli/web exec lazuli-lint` + all batch-2 paths below, relative to `apps/web`.
> **Next gate:** zero targeted errors, types and focused teacher tests, then `pnpm lint --concurrency=1 --continue=dependencies-successful` and complete diagnostic comparison before batch 3.

> **Closed batch 1:** 50 original errors across the nine files below; latest remaining: 0 (`/tmp/lazuli253-batch1-final.log`); web types and five focused teacher tests passed. Full lint confirmed 818 remaining errors; exactly 50 removed and no new diagnostics.
> **Baseline:** 868 errors from CI on `ac9f381c`, local full refresh confirmed 868 errors, normalized snapshot `/tmp/lazuli253-lint-baseline.json`; batch snapshot `/tmp/lazuli253-batch1-baseline.json`.
> **Full command:** `pnpm lint --concurrency=1 --continue=dependencies-successful`; local refresh log `/tmp/lazuli253-lint-baseline.log`.
> **Targeted command:** `pnpm -F @lazuli/web exec lazuli-lint` followed by the nine paths below (relative to `apps/web`).
> **Next gate:** zero errors across the complete locked area (including extracted helpers), web types and focused tests, then full lint and diagnostic comparison before selecting another batch.
> **User constraint:** batches of 50 errors. Never weaken rules, tests, or add suppressions. No `--fix` authorized.

| File                                                             | Original errors |
| ---------------------------------------------------------------- | --------------: |
| `apps/web/src/components/student-avatar.tsx`                     |               6 |
| `apps/web/src/features/teachers/teacher-health-distribution.tsx` |               2 |
| `apps/web/src/features/teachers/teacher-class-indicators.tsx`    |              11 |
| `apps/web/src/features/teachers/teacher-metric-details.tsx`      |              11 |
| `apps/web/src/features/teachers/teacher-students.tsx`            |               6 |
| `apps/web/src/features/teachers/teacher-health-student.tsx`      |               1 |
| `apps/web/src/features/teachers/teacher-metrics.tsx`             |               2 |
| `apps/web/src/features/teachers/teacher-health-context.tsx`      |              10 |
| `apps/web/src/features/teachers/teacher-health-info.tsx`         |               1 |

## Prerequisite CI repair (outside lint batch)

The router-import regression removes `DATABASE_URL` to ensure public health does not initialize the database. Teacher metrics imported the eager `@lazuli/db` barrel. Added a narrow export for the existing batch health reader and changed that import to avoid loading the singleton. Removed the ineffective unit-job database URL workaround. Focused verification: `NODE_ENV=test pnpm -F @lazuli/api exec tsx --test test/trpc/router.unit.test.ts` passed all four tests.

## Monitoring

PR #253, branch `staging/professor-planejamento`; publication checkout `/tmp/lazuli-teacher-pr`. Baseline head `ac9f381c631a9be3773dbf9ece73a84836d5d5d5`. Staging deploy succeeded at `93a41653`; no merge. Existing review feedback resolved. Watcher event pending handling: `0af4d1931e8d451ab555c7b08ee15e94` (static lint, unit router-import, aggregate quality gate). Resume with the exact ack after fixing those events.

## Batch 1 validation

- Targeted lint: zero errors, four existing object-injection warnings; final log `/tmp/lazuli253-batch1-final.log`.
- Web types: passed, `/tmp/lazuli253-batch1-types-final.log`.
- Teacher form and week-layout tests: 5/5 passed with repository CSS setup and NODE_ENV=test, `/tmp/lazuli253-batch1-tests.log`.
- Complete lint finished (remaining errors outside the locked area): `/tmp/lazuli253-lint-after-batch1.log`, tool session 31539.
- Refactoring retained the rendered groups, labels and navigation; extracted header/body/calculation subcomponents and avatar presentation hooks rather than changing UI layout or rules.

Full comparison: 868 → 818; 50 removed, zero added by file/rule/message. Snapshot `/tmp/lazuli253-lint-after-batch1.json`.

## Batch 2 lock

| File                                                               | Original errors |
| ------------------------------------------------------------------ | --------------: |
| `apps/web/src/features/teachers/teacher-class-metrics-loading.tsx` |               2 |
| `apps/web/src/features/teachers/teacher-employment-fields.tsx`     |               1 |
| `apps/web/src/features/teachers/teacher-form.ts`                   |               3 |
| `apps/web/src/features/teachers/teacher-occurrence-preview.tsx`    |               6 |
| `apps/web/src/features/teachers/teacher-occurrences-dialog.tsx`    |               5 |
| `apps/web/src/features/teachers/teacher-students-loading.tsx`      |               1 |
| `apps/web/src/features/teachers/teacher-section-loading.tsx`       |               1 |
| `apps/web/src/features/teachers/teacher-dated-agenda.tsx`          |               7 |
| `apps/web/src/features/teachers/teacher-class-order.ts`            |               4 |
| `apps/web/src/features/teachers/teacher-class-metrics.tsx`         |               6 |
| `apps/web/src/features/teachers/teacher-dialog.tsx`                |               6 |
| `apps/web/src/features/teachers/teacher-sections.tsx`              |               3 |
| `apps/web/src/features/teachers/teacher-header.tsx`                |               1 |
| `apps/web/src/features/teachers/teacher-photo.tsx`                 |               3 |
| `apps/web/src/features/teachers/teacher-table.tsx`                 |               1 |

## Batch 2 validation in progress

- Targeted lint: zero errors, ten pre-existing warnings; `/tmp/lazuli253-batch2-final.log`.
- Web types passed: `/tmp/lazuli253-batch2-types-final.log`.
- Six teacher/occurrence tests passed: `/tmp/lazuli253-batch2-tests.log`.
- Styles gate passed: `/tmp/lazuli253-batch2-styles.log`.
- Dependent CSS change: `teacher-form.module.css` now addresses the same dialog via its dedicated data attribute; dimensions and spacing remain the same. Attachment loading keeps the shimmer in a native surrounding layer instead of passing a dynamic class to the shared primitive.
- Full lint finished: `/tmp/lazuli253-lint-after-batch2.log`; normalized snapshot `/tmp/lazuli253-lint-after-batch2.json` (818 → 768, 50 removed, zero added by file/rule/message).
