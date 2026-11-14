# PR 253 lint progress

> **Locked batch 6:** 50 original errors across calendar capacity/import/schema and reconciliation: `packages/api/src/calendar/change-schema.ts` (10), `capacity.ts` (10), `holidays.ts` (9), `follow-up.ts` (1); `packages/worker-handlers/src/calendar/process.ts` (13), `appointments.ts` (2); `apps/worker/src/periodic-tasks.ts` (2), `test/periodic-tasks.unit.test.ts` (3). No batch-6 edits yet; latest remaining: 50.
> **Baseline:** 618 errors, `/workspace/scratch/e19b55f99412/pr253-after-batch5.json`.
> **Command:** per-workspace `pnpm -F <workspace> exec lazuli-lint` over the recorded files and extracted helpers/callers, serially.
> **Next gate:** zero targeted errors, types and focused calendar/worker tests, then full serial lint and diagnostic comparison. Keep batches at 50; no rule weakening, suppressions, or lint `--fix`.

> **Closed batch 5:** 50 removed from calendar impact, change application, state and academic endpoints. Full lint 668 → 618, zero added by file/rule/message. Types passed across all 15 workspaces, with API types rerun after tests. Eight focused projection/router tests passed. Database integration deferred to CI; no local PostgreSQL/Docker infrastructure is installed.

> **Closed batch 4:** all 50 original errors removed from the six teacher API files below, with zero errors/warnings across their extracted helpers. Full comparison: 718 → 668, exactly 50 removed and zero added by file/rule/message.
> **Cloud authorization:** resumed local work and push to this PR branch were authorized on 2026-11-14. No merge or PR comments authorized.

> **Closed batch 3:** 50 original errors across the twelve planning/programming files below; latest remaining: 0 across all three targeted workspaces; all types and 22 focused tests passed. Full lint confirmed 718 remaining errors: exactly 50 removed, zero added.
> **Baseline:** 768 errors, `/tmp/lazuli253-lint-after-batch2.json`; batch snapshot `/tmp/lazuli253-batch3-baseline.json`.
> **Command:** per-workspace `pnpm -F <workspace> exec lazuli-lint` over the complete recorded area, sequentially; dependent call sites stay in scope.
> **Next gate:** zero targeted errors, API/Web/domain/validator types and focused planning tests, then full `pnpm lint --concurrency=1 --continue=dependencies-successful` and diagnostic comparison before batch 4.

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

## Batch 3 lock

| File                                                  | Original errors |
| ----------------------------------------------------- | --------------: |
| `packages/validators/src/class-records.ts`            |               1 |
| `packages/validators/src/class.ts`                    |               1 |
| `packages/domain/test/program-labels.unit.test.ts`    |               4 |
| `packages/domain/src/program-labels.ts`               |              16 |
| `packages/api/src/stage-planning/router.ts`           |               2 |
| `packages/api/src/teaching-programs/read.ts`          |               3 |
| `packages/api/src/calendar/academic-day.ts`           |               1 |
| `packages/api/src/stage-planning/write.ts`            |               1 |
| `packages/api/src/stage-planning/read.ts`             |               6 |
| `packages/api/src/class-records/planning-links.ts`    |               4 |
| `packages/api/src/teaching-programs/labels.ts`        |               4 |
| `packages/api/src/stage-planning/program-schedule.ts` |               7 |

## Batch 3 validation in progress

- Validators, domain, API: zero errors and zero warnings in targeted checks (`/tmp/lazuli253-batch3-*-final.log`).
- Full typecheck passed in all 15 packages: `/tmp/lazuli253-batch3-types-final.log`.
- Focused tests: domain 7/7, validators 13/13, planning records 2/2; logs `/tmp/lazuli253-batch3-{domain,validator,api}-tests.log`.
- Full lint finished: `/tmp/lazuli253-lint-after-batch3.log`; normalized snapshot `/tmp/lazuli253-lint-after-batch3.json` (768 → 718; 50 removed, zero added by file/rule/message).
- No identifiers or applied migrations changed. Fixture factory call shapes changed, retaining every original fixture identifier and value.

## Resumption status — 2026-11-14

The third full lint completed across the overnight interruption. Its diagnostics match the locked batch: 50 removed, no new errors. Total resolved: 150 of 868; 718 remain. No fourth batch selected yet. The previous two-hour monitoring window has elapsed; resume the watcher with its persisted event state before claiming current CI status. Original source checkout remains preserved; publication changes are in `/tmp/lazuli-teacher-pr`.

## Batch 4 lock

| File                                              | Original errors |
| ------------------------------------------------- | --------------: |
| `packages/api/src/teachers/files.ts`              |              10 |
| `packages/api/src/teachers/appointment-hours.ts`  |               3 |
| `packages/api/src/teachers/metrics.ts`            |              18 |
| `packages/api/src/teachers/commands.ts`           |               1 |
| `packages/api/src/teachers/metric-rules.ts`       |               6 |
| `packages/api/src/teachers/metrics-attendance.ts` |              12 |

## Batch 4 cloud validation

- Environment: cloud-only checkout at `a0c5b22a63640cda7ccb577f4fc3c6dd3bcad62a`; Python 3.12.14, Node 24.22.1, pnpm 11.25.0 (repository pins pnpm 11.6.0 and CI Node 22). Frozen dependency installation completed; Prisma/Kysely clients generated locally.
- Refactoring: extracted typed metric queries, grade evidence and summary helpers; preserved attendance/substitution resolution, file-access checks, response statuses and profile vacation rules. Updated the file-resource route to object arguments.
- Targeted teacher source lint: zero errors/warnings. Full serial lint: 668 errors; 50 removed, zero added by file/rule/message. API 170 → 120; other workspace totals unchanged.
- Types passed across all 15 workspaces. API types rerun after adding tests.
- Focused tests: 12/12 passed (metric rules, attendance/substitutions, grade enrollment boundaries/cross-class ambiguity, router import/public health/auth seam). Used `node --import tsx --test` because this executor disallows the tsx CLI IPC socket.
- No tracked generated files, fixture identifiers, migrations, rule settings, or suppressions changed.
- Baseline CI: all builds, unit/scripts/styles, integration/transport and Pullfrog passed; lint and the aggregate Quality gates failed. CI cannot become green until the remaining backlog is resolved. Original Pullfrog attendance finding was addressed before this batch.
- Evidence in the cloud workspace: `pr253-lint-prepared.log`, `pr253-lint-after-batch4.log`, `pr253-baseline.json`, `pr253-after-batch4.json`, `pr253-batch4-types-final.log`.

## Batch 5 validation

- Split date helpers, optimistic-version/period validation, closed-day projection, impact reads/selection/evidence, and change application without changing the fingerprint field order or the transaction/advisory-lock boundaries.
- Preserved manual closure precedence, overlap unions, period placement guards, recorded-activity protection and holiday-source deduplication. Added four focused projection/version regression tests; existing router seam tests remained green (8 total).
- Targeted lint over all 11 source files: zero errors/warnings. Full lint comparison: 668 → 618, exactly 50 removed and no new diagnostics. Evidence: `pr253-batch5-target.log`, `pr253-batch5-types.log`, `pr253-lint-after-batch5.log`, `pr253-after-batch5.json` in the cloud workspace.
- Remote head was rechecked at `72131883f559b98d646028b25215809c0dd7aa9c` before this work; no concurrent changes observed. This batch is held locally for a grouped publication.
