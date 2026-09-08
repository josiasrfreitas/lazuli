# Testing guide

This is the single source of the rules for writing, keeping, and deleting tests in Lazuli. The
tier table for choosing where a test goes lives in the `ship-with-tests` skill; the reasoning and
the constraints live here. Decision [0017](../decisions/0017-gate-tests-on-mutation-score-and-assertion-guardrails.md)
records why these gates exist.

## What a test is for

A test exists to fail when a business rule is broken. Before writing one, name the rule and the
plausible bug that would break it. If no realistic change to the production code would make the
test fail, do not write it. If it already exists, delete it.

The suite is measured by what it detects (mutation score, see below), not by which lines it
touches. Line coverage is not collected and must not be used as an argument to keep a test.

## Tiers and what each one owns

| Tier        | Location                  | Owns                                                                                              | Must not                                                            |
| ----------- | ------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Unit        | `test/*.test.ts`          | Calculators, invariants, reducers, validators, RBAC gates, pure service logic with stubs          | Touch Postgres, the network, or the clock without control           |
| Integration | `test/db/*.test.ts`       | Persistence rules: constraints, transactions, soft delete, derived reads, tRPC procedures with DB | Re-assert a rule already proven in the unit tier                    |
| Behavior    | `test/behavior/*.test.ts` | The HTTP boundary: auth, session, status, serialization, one happy path per procedure             | Re-test business rules; one happy path plus the auth gate is enough |

One rule, one tier. When a rule is proven in the unit tier, the integration test asserts only what
the database adds (it was stored, the constraint held, the transaction rolled back), and the
behavior test asserts only what HTTP adds (status, body shape, cookie, role gate).

## Rules for every test

1. **Name the rule.** `it("rejects a payment above the open balance")`, not `it("works")` or
   `it("returns the payment")`. The name states subject, outcome, and condition.
2. **Assert an outcome the code computed.** Compare against a value you derived independently in
   the test, not against a value copied from the fixture or from the code's own output.
3. **Assert values, not existence.** `assert.equal(row.status, "PAID")`, not `assert.ok(row)`.
   A truthiness or non-null check is allowed only as a guard immediately before a stronger
   assertion on the same value.
4. **HTTP tests assert three things:** the status, at least one field of the body that the
   procedure computed, and the persisted state that resulted. Status alone proves nothing.
5. **Error tests name the error.** `assert.rejects(..., /NOT_FOUND/)` or a validator on the error
   code; never a bare `rejects`/`throws`, never `doesNotThrow`/`doesNotReject`.
6. **At most five tests per rule:** the happy path plus the edges that change the outcome
   (boundary value, empty input, forbidden role, out-of-window date). A test that walks the same
   path to the same outcome as another is a duplicate; delete one.
7. **No pass-throughs, stubs, or placeholders.** Do not test that a handler returns its input,
   that a stub resolves, that a column exists, or that a library behaves as documented.
8. **No control flow in the test body.** No `if`, no `try/catch`, no assertions inside loops
   without a preceding count assertion. Branches belong in separate tests.
9. **Fixtures are owned by the file.** Use a per-file namespace prefix, seed in `before`, clean in
   `after`, and never depend on another file's data or on test order.
10. **Register with `node:test` directly.** Use `describe`/`it` imported from `node:test` and
    `assert` from `node:assert/strict`. Wrappers hide tests from the lint guardrails.

## Mutation testing

StrykerJS (`@stryker-mutator/core` with the `tap` runner) mutates each package through the tier
that covers its code: unit, plus integration where the code is only reachable through Postgres
(one worker, since fixtures are isolated per file, not per worker).
A mutant survives when no test fails after the change; a surviving mutant is a bug the suite would
not catch.

- **Gate:** every change to a package's `src/` must leave no surviving mutant in the changed files,
  except mutants that are equivalent or unreachable, which are listed in the pull request with a
  reason. The threshold is enforced on changed files only; existing code is not gated
  retroactively.
- **Run locally:** `pnpm mutate:changed` mutates the files changed against `main` in every package
  that has unit tests; `pnpm mutate --filter @lazuli/<package>` runs a full package. Reports land
  in `<package>/reports/mutation/index.html`.
- **Read the report:** a survived mutant in a branch you wrote means the test for that branch
  either does not exist or asserts too little. Fix the test, not the mutant.
- **Scope:** the HTTP tier is not mutated; it only proves transport. Full integration-tier runs are
  on demand, never in a pull request.

## Lint guardrails

The `eslint-node-test` plugin runs on every commit and rejects, deterministically:

- a test without an assertion, and an assertion outside a test;
- an assertion whose outcome is constant or compares a value with itself;
- `doesNotThrow` / `doesNotReject`;
- `throws` / `rejects` without an error expectation;
- `assert.ok(a === b)` and other truthiness checks over comparisons;
- assertions inside `if`, `catch`, or callbacks that may never run;
- `.only`, `.skip` without a reason, commented-out tests, duplicate titles;
- non-null-only assertions such as `assert.notEqual(value, null)` (repository rule).

Inline disables are not allowed anywhere in the repository. If a rule is wrong for a file, change
the shared config in `tooling/eslint/base.js` with a comment that states why.

## Time budget

<!-- TODO(timings): fill from the timing report -->

| Tier        | Budget per test | Budget per file |
| ----------- | --------------- | --------------- |
| Unit        | TBD             | TBD             |
| Integration | TBD             | TBD             |
| Behavior    | TBD             | TBD             |

CI publishes per-test durations (`--test-reporter=junit`). A test over budget is fixed in the same
change: narrower fixture, fewer round trips, or a move to a cheaper tier.

## Examples

<!-- TODO(audit): replace with real examples from the audit -->

Good and bad examples from this repository will be listed here after the suite audit.
