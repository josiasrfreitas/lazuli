# PR 305 lint progress

Locked batch: none. The backlog is closed.
Original count: 233 errors on PR head `f0f0bfe2`.
Latest measured remaining: 0 overall.
Snapshot: `pnpm lint --continue=dependencies-successful --output-logs=errors-only`,
`/tmp/lazuli-pr305-lint-final.log` and `/tmp/lazuli-pr305-lint-final.json`.
Next gate: publish the local commits when GitHub authentication is available and verify CI on the pushed head.

## Closed batch: contracts, enrollment, and assessment file polling

Targeted lint removed all 14 locked errors. Web typecheck and all 445 web unit tests
passed. Orca verified the suggested dates in the new contract dialog on desktop and
at 390 px. Full lint confirmed 14 → 0, with zero added by file, rule, and message.
All 17 tasks passed, including duplication. The contract form hook callers and
shared duration model followed their interface changes and had zero baseline errors.

- `apps/web/src/features/assessment-files/queue-provider.tsx` — 2
- `apps/web/src/features/contracts/contract-form-model.ts` — 1
- `apps/web/src/features/contracts/contract-setup.tsx` — 1
- `apps/web/src/features/contracts/new-contract-state.ts` — 3
- `apps/web/src/features/contracts/semester-books.tsx` — 5
- `apps/web/src/features/students/new-student/new-student-dialog.tsx` — 1
- `apps/web/test/features/contract-payer-model.unit.test.ts` — 1

## Closed batch: formation lifecycle, class labels, and placement

Targeted lint closed all 99 locked errors. API, DB, domain, web, and worker-handler
typechecks passed, along with 56 focused unit tests and 24 integration tests against
an isolated database. The class renaming script ran without `--apply`. Orca verified
the class sheet and its actions on desktop and mobile. Full lint confirmed 113 → 14,
with zero added by file, rule, and message. Duplication passed.

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
