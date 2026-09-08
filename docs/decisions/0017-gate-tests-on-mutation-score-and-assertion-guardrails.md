# Gate tests on mutation score and assertion guardrails

Status: Proposed
Decision date: 2026-09-07
Supersedes: None
Superseded by: None
Legacy sources: None
Implementation evidence: `docs/testing/README.md`, `tooling/stryker/`, `tooling/eslint/base.js`,
`scripts/mutate-changed.mjs`, `.github/workflows/ci.yml`

## Context

Lazuli runs three test tiers on the native `node:test` runner: unit (`test/*.test.ts`), database
integration (`test/db/*.test.ts`), and HTTP behavior (`test/behavior/*.test.ts`). The suite is
large for the product's age (93 files, ~460 tests) and much of it was generated with AI
assistance. Line coverage is not measured, and nothing distinguishes a test that would catch a
regression from one that passes regardless of what the code does: pass-through checks, non-null
checks, status-only HTTP checks, and re-assertions of fixture values all count the same as a real
rule check. Reviewers cannot audit hundreds of tests by hand on every change, and code coverage is
easy to inflate without adding detection power.

The suite is also slow enough that developers avoid running it. Speed is secondary to detection
power, but both come from the same root: tests that do not prove anything still cost time.

## Decision

Test quality is gated on what a test detects, not on how many lines it touches.

1. **Mutation testing is the acceptance test for new tests.** StrykerJS with the `tap` runner
   mutates each package through the tier that covers its code: the unit tier, plus the
   integration tier where code is only reachable through Postgres (one worker, incremental). A change that adds or modifies source under a package
   `src/` must leave no surviving mutant in the changed files that a reasonable test could kill;
   surviving mutants are either killed by a test in the same change or listed in the change
   description with a reason. The gate is incremental and scoped to changed files. Existing code is
   not gated retroactively; its baseline is recorded and raised opportunistically.
2. **Deterministic guardrails live in the linter.** The `eslint-node-test` plugin, on ESLint 10,
   rejects tests without an assertion, assertions with constant outcomes, self-comparisons,
   `doesNotThrow`/`doesNotReject`, truthiness checks over comparisons, `throws`/`rejects` without
   an error expectation, assertions inside conditionals, and `.only`/`.skip` without a reason. The
   repository adds a ban on non-null-only assertions. Lint runs on every commit, so these cannot
   enter the suite.
3. **Judgment rules live in one document.** `docs/testing/README.md` is the single place that
   states what a test must prove, which tier owns which concern, what is forbidden, and the time
   budget per tier. The `ship-with-tests` skill points at it and keeps only the tier table.
4. **Tests are measured.** CI records per-test durations and publishes the slowest tests; the
   testing guide sets a budget per tier, and a test that exceeds it is a defect to fix in the same
   change.
5. **Tests that prove nothing are deleted.** Coverage numbers do not justify keeping a test; the
   audit that accompanies this record removes the current ones.

The HTTP tier is not mutation-tested: it only proves transport. A full integration-tier mutation
run is too slow for a pull request and runs on demand; between runs that tier is governed by the
written rules, the lint guardrails, and review. Issues #60–#63 track the rollout order.

## Consequences

- Every package with unit tests carries a `stryker.config.mjs` extending the shared tooling config
  and a `mutate` script. `pnpm mutate:changed` runs the gate locally; CI runs it on pull requests.
- The database tier registers tests with `it` from `node:test` rather than a local wrapper, so the
  lint rules can see them.
- ESLint moves from 9 to 10 and `eslint-plugin-import` is replaced by `eslint-plugin-import-x`.
- Writing a useful test costs more thought than writing a passing one. That is the intended trade.
