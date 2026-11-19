# PR 305 lint progress

Locked batch: formation review search, filters, class grouping, and their callers.
Original count: 105 errors in this batch, 218 overall.
Latest measured remaining: 105 in the locked files and 218 overall.
Snapshot: `pnpm lint --continue=dependencies-successful --output-logs=errors-only`,
`/tmp/lazuli-pr305-lint-after-locked.log` and `/tmp/lazuli-pr305-lint-after-locked.json`.
Next gate: zero errors in the locked files, web typecheck and formation review tests,
then compare a full lint run.

- `apps/web/src/features/class-organization/attention-reasons.ts` — 7
- `apps/web/src/features/class-organization/review-class-heading.ts` — 2
- `apps/web/src/features/class-organization/review-class-search.ts` — 24
- `apps/web/src/features/class-organization/review-filters.ts` — 11
- `apps/web/src/features/class-organization/review-group-model.ts` — 3
- `apps/web/src/features/class-organization/review-groups.tsx` — 25
- `apps/web/src/features/class-organization/review-reason-filter.tsx` — 13
- `apps/web/src/features/class-organization/review-toolbar.tsx` — 12
- `apps/web/src/features/class-organization/review.tsx` — 7
- `apps/web/test/features/formation-review.unit.test.ts` — 1

## Closed batch: root scripts, API, database, and domain

The original lock covered 86 of 173 errors. At `f0f0bfe2`, the same paths had 14 errors
and the repository had 233. Targeted lint reached zero on the locked paths. Database and API
typechecks and all 18 formation integration tests passed. Full lint found 218 remaining,
with 15 removed and zero added by file, rule, and message. The formation filter fix
removed the additional error. Duplication passed.

The remaining errors are in `packages/api/src/semester-organization/data.ts` (1),
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
