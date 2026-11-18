# PR 305 lint progress

Locked batch: root scripts, API, database, and domain.
Original count: 86 errors in this batch, 173 overall.
Latest measured remaining: 86 in this batch before the contract and database fixes were rechecked.
Snapshot: `pnpm lint --continue`, `/tmp/lazuli-pr305-local-lint2.log`.
Next gate: zero errors in this batch, then compare a full lint run and select the web batch.

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
