# PR 305 lint progress

Locked batch: formation lifecycle, class labels, and placement.
Original count: 99 errors in this batch, 113 overall.
Latest measured remaining: 99 in the locked files and 113 overall.
Snapshot: `pnpm lint --continue=dependencies-successful --output-logs=errors-only`,
`/tmp/lazuli-pr305-lint-after-review.log` and `/tmp/lazuli-pr305-lint-after-review.json`.
Next gate: zero errors in the locked files, check affected types and behavior, then compare a full lint run.

- `apps/web/src/features/class-organization/action-dialogs.tsx` — 1
- `apps/web/src/features/class-organization/agenda.tsx` — 4
- `apps/web/src/features/class-organization/case-form.tsx` — 3
- `apps/web/src/features/class-organization/case-timeline.tsx` — 2
- `apps/web/src/features/class-organization/composition-sections.tsx` — 2
- `apps/web/src/features/class-organization/confirmation.ts` — 1
- `apps/web/src/features/class-organization/continuity.tsx` — 1
- `apps/web/src/features/class-organization/dialogs.tsx` — 2
- `apps/web/src/features/class-organization/formation-detail-breadcrumb.tsx` — 2
- `apps/web/src/features/class-organization/formation-panel.tsx` — 2
- `apps/web/src/features/class-organization/formation-reason.tsx` — 1
- `apps/web/src/features/class-organization/page-loading.tsx` — 1
- `apps/web/src/features/class-organization/page-view.tsx` — 2
- `apps/web/src/features/class-organization/placement-date-dialog.tsx` — 1
- `apps/web/src/features/class-organization/placement-model.ts` — 4
- `apps/web/src/features/class-organization/plan-roster.tsx` — 6
- `apps/web/src/features/class-organization/reset-formation-dialog.tsx` — 2
- `apps/web/src/features/class-organization/review-context.tsx` — 3
- `apps/web/src/features/class-organization/review-detail.tsx` — 6
- `apps/web/src/features/class-organization/review-model.ts` — 2
- `apps/web/src/features/class-organization/review-navigation.ts` — 4
- `apps/web/src/features/class-organization/review-publish.ts` — 2
- `apps/web/src/features/class-organization/review-row.tsx` — 6
- `apps/web/src/features/class-organization/review-view.tsx` — 1
- `apps/web/src/features/class-organization/use-formation-navigation.ts` — 2
- `apps/web/src/features/students/profile/student-formation-dialog.tsx` — 6
- `apps/web/test/features/formation-review-case.unit.test.ts` — 4
- `packages/api/src/classes/portal-name.ts` — 1
- `packages/api/src/semester-organization/case-events.ts` — 3
- `packages/api/src/semester-organization/case-history.ts` — 2
- `packages/api/src/semester-organization/commands.ts` — 1
- `packages/api/src/semester-organization/dissolve.ts` — 1
- `packages/api/src/semester-organization/prepare.ts` — 2
- `packages/api/src/semester-organization/queries.ts` — 1
- `packages/api/src/semester-organization/write.ts` — 1
- `packages/db/src/attendance-percent.ts` — 1
- `packages/domain/src/class-portal-name.ts` — 2
- `packages/domain/src/formation.ts` — 1
- `packages/worker-handlers/src/enrollment/semester-placements.ts` — 1
- `packages/worker-handlers/test/enrollment/semester-placements.integration.test.ts` — 1
- `scripts/rename-class-labels.ts` — 8

## Closed batch: formation review search, filters, and class grouping

Targeted lint removed all 105 locked errors. Web typecheck and all 20 formation review tests
passed. Orca verified the scope popover at 390 px, risk filtering, and focus restoration
after returning from a student detail. Full lint confirmed 218 → 113 errors, with zero
added by file, rule, and message. Duplication passed.

## Closed batch: root scripts, API, database, and domain

The original lock covered 86 of 173 errors. At `f0f0bfe2`, the same paths had 14 errors
and the repository had 233. Targeted lint reached zero on the locked paths. Database and API
typechecks and all 18 formation integration tests passed. Full lint found 218 remaining,
with 15 removed and zero added by file, rule, and message. The formation filter fix
removed the additional error. Duplication passed.

The last 14 errors were in `packages/api/src/semester-organization/data.ts` (1),
`packages/api/test/semester-organization/organization.integration.test.ts` (12), and
`packages/db/src/formation.ts` (1). Counts below are from the original lock.

- `packages/api/src/addresses/lookup-error.ts` — 2
- `packages/api/src/addresses/router.ts` — 2
- `packages/api/src/finance/internal/contracts.ts` — 2
- `packages/api/src/finance/internal/material-purchases.ts` — 2
- `packages/api/src/semester-organization/data.ts` — 1
- `packages/api/src/semester-organization/future-student-intake.ts` — 3
- `packages/api/src/semester-organization/reset.ts` — 8
- `packages/api/src/semester-organization/router.ts` — 1
- `packages/api/src/semester-organization/student-intake.ts` — 1
- `packages/api/src/students/intake.ts` — 1
- `packages/api/src/trpc/init.ts` — 3
- `packages/api/test/finance/contract-materials.integration.test.ts` — 4
- `packages/api/test/semester-organization/organization.integration.test.ts` — 3
- `packages/db/src/formation.ts` — 1
- `packages/db/src/seed-dev.ts` — 2
- `packages/domain/src/monthly-contract.ts` — 7
- `scripts/seed-status.ts` — 15
- `scripts/seed.mjs` — 3
- `scripts/seed.ts` — 1
- `scripts/seed/contracts.ts` — 3
- `scripts/seed/registration-pdf.ts` — 6
- `scripts/seed/school.ts` — 1
- `scripts/seed/student-media.ts` — 14

The contract validator complexity error from the initial run was fixed before the inventory.
