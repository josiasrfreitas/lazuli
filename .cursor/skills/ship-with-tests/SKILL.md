---
name: ship-with-tests
description: >-
  Pointer to the testing guide: tiers, placement, rules and gates for every
  code change. Execution is automated via lefthook pre-commit and CI.
disable-model-invocation: true
---

# Ship With Tests

The rules live in one place: [`docs/testing/README.md`](../../../docs/testing/README.md). Read
"Tiers and what each one owns" to pick the tier, "Where a test lives" to name the file, and
"Rules for every test" before writing it. Vocabulary for areas and subjects is in
[`CONTEXT.md`](../../../CONTEXT.md).

Pre-commit runs format, lint, typecheck and `pnpm test` (unit). Before pushing, run the Postgres
tier of the package you changed (`pnpm test:integration`, `pnpm test:transport`). CI runs all
three tiers and the change gates.
