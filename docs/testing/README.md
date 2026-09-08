# Testing guide

This is the single source of the rules for writing, placing, keeping, and deleting tests in
Lazuli. Decision [0017](../decisions/0017-gate-tests-on-mutation-score-and-assertion-guardrails.md)
records why the gates exist; the vocabulary for naming things is [`CONTEXT.md`](../../CONTEXT.md).
Everything here is text, and text guarantees nothing by itself: what is deterministic is enforced
by a gate that points back to the section it enforces.

## What a test is for

A test exists to fail when a business rule is broken. Before writing one, name the rule and the
plausible bug that would break it. If no realistic change to the production code would make the
test fail, do not write it. If it already exists, delete it.

The suite is measured by what it detects (mutation score, below), not by which lines it touches.
Line coverage is collected only to answer "does any test execute this changed file"; it is never
an argument to keep a test.

## Tiers and what each one owns

The three tiers are split by what they need to run, because that dictates cost, and named by what
they prove, because that is what the author has to decide.

| Tier          | Needs                | Owns                                                                                                                                                       | Must not                                                                                              |
| ------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `unit`        | Nothing              | Calculators, invariants, reducers, validators, role gates, pure services with stubs. The cheapest tier to mutate.                                          | Touch Postgres, the network, or the clock without control                                             |
| `integration` | Postgres             | Business rules together with persistence: constraints, transactions, soft delete, derived reads, tRPC procedures against the database. The tier of record. | Re-assert a rule already proven in `unit`                                                             |
| `transport`   | Postgres and adapter | Only what the adapter adds: status, body shape after superjson, session, role gate through the real adapter. One happy path per procedure plus the gate.   | Re-assert business value; read persisted state (`db.*.find*`/`count`) when an integration twin exists |

One rule, one tier. When a rule is proven in `unit`, the integration test asserts only what the
database adds, and the transport test asserts only what the adapter adds.

**Rules are born pure.** New business logic in a procedure starts as a pure function in
`packages/domain` (or a pure service) with a `unit` test; the procedure orchestrates. This is not a
retroactive rewrite; it applies feature by feature as code is touched. The reason is cost: a mutant
in `domain` costs about 0.05 s to test, a mutant reached only through Postgres costs about 2 s
(measured 2026-09-07, see [0017](../decisions/0017-gate-tests-on-mutation-score-and-assertion-guardrails.md)).
Date and window logic is the first extracted batch: enrollment/semester intersection and
São Paulo calendar calculations live in `packages/domain`, with explicit clock inputs. Month
bounds for timestamps and calendar dates keep separate contracts: a São Paulo midnight instant
is not the UTC-midnight representation of a database date.

## Where a test lives

The path says the tier and the subject; nobody should have to open a file to learn either.

```
packages/<pkg>/test/<area>/<subject>.<tier>.test.ts
packages/<pkg>/test/support/<feature>.ts
```

- **`<area>` mirrors `src/`.** The first-level folder under `test/` has the same name as the
  first-level folder under `src/` that the test exercises: a test of `src/students/list.ts` lives
  in `test/students/`. A package whose `src/` is flat keeps `test/` flat. Cross-cutting tests of
  the tRPC plumbing (role matrix, context, router composition) live in `test/trpc/`. In
  `packages/db`, tests of the Prisma schema itself live in `test/schema/`.
- **`<subject>`** is the source module when there is one (`list`), the procedure group when the
  test covers a whole router (`router`), or the rule. No area prefix, no `-http` suffix: the folder
  and the tier already say that.
- **`<tier>` is always written**, in every package, including packages that only have `unit`
  tests. The runners select by suffix (`test/**/*.unit.test.ts`), so a file without a suffix does
  not run.
- **Support modules** live in `test/support/`, one module per feature, with `assert*` helpers named
  after what they prove. `@lazuli/db/test` is the only support module imported across packages.
  When a feature exceeds the file-size limit, keep one public entry (`test/support/<feature>.ts`)
  and split its implementation by responsibility under `test/support/<feature>/`. Test files
  import the public entry; do not recreate separate entry points per tier.
- Editing `src/<area>/<module>.ts`? The tests are in `test/<area>/`; the gate
  `pnpm test:changed-covered` tells you if none of them executes the file.

Scripts: `pnpm test` runs `unit`, `pnpm test:integration` and `pnpm test:transport` run the
Postgres tiers, `pnpm test:all` runs the three. Pre-commit runs `unit`; run the Postgres tier of
the package you changed before pushing (about 30 s for `api`).

## Rules for every test

1. **Name the rule.** `it("rejects a payment above the open balance")`, not `it("works")` or
   `it("returns the payment")`. The name states subject, outcome, and condition.
2. **Assert an outcome the code computed.** Compare against a value you derived independently in
   the test, not against a value copied from the fixture or from the code's own output.
3. **Assert values, not existence.** `assert.equal(row.status, "PAID")`, not `assert.ok(row)`.
   A truthiness or non-null check is allowed only as a guard immediately before a stronger
   assertion on the same value.
4. **Transport tests assert three things:** the status, at least one field of the body that the
   procedure computed, and the persisted state, the last one only when no integration twin already
   proves it. Status alone proves nothing.
5. **Error tests name the error.** `assert.rejects(..., /NOT_FOUND/)` or a validator on the error
   code; never a bare `rejects`/`throws`, never `doesNotThrow`/`doesNotReject`.
6. **At most five tests per rule:** the happy path plus the edges that change the outcome
   (boundary value, empty input, forbidden role, out-of-window date). A new test needs a new
   outcome or a new branch; the test-by-mutant matrix from Stryker says whether it adds detection.
7. **No pass-throughs, stubs, or placeholders.** Do not test that a handler returns its input,
   that a stub resolves, that a column exists, or that a library (Prisma, Zod, tRPC, Better Auth)
   behaves as documented.
8. **No control flow in the test body.** No `if`, no `try/catch`, no assertions inside loops
   without a preceding count assertion. Branches belong in separate tests.
9. **Fixtures are owned by the file.** Use a per-file namespace prefix, seed in `before`, clean in
   `after`, and never depend on another file's data or on test order.
10. **Drift guards run against the real subject.** A test that checks the role matrix or the router
    surface consumes `appRouter` and `ROLE_MATRIX` themselves, never a synthetic copy.
11. **Schema tests assert something the database computed:** a default, a transition, a rejected
    write, a migration diff. Reading back what was just written proves nothing.
12. **A declared stub ships without a test.** A placeholder handler or procedure is allowed to
    exist untested; a test of the placeholder is not.

**Registering tests.** Import `describe`/`it` from `node:test` and `assert` from
`node:assert/strict`; do not wrap them. Every test has at least one `assert.*` call inline;
`assert*`/`expect*` helpers from `test/support/` complement it, they do not replace it. The lint
guardrails only see tests registered this way.

## Mutation testing

StrykerJS (`@stryker-mutator/core` with the `tap` runner over `node --test`) mutates each package
through the tier that covers its code: `unit`, plus `integration` where the code is only reachable
through Postgres (one worker, since fixtures are isolated per file, not per worker). A mutant
survives when no test fails after the change. Investigate each survivor: it can expose a behavior
the suite does not detect, or it can be equivalent or unreachable.

The official TAP runner identifies a test file as one test. Its `coveredBy` and `killedBy` data
therefore name files, even though `node:test` reports individual cases inside them. Use that report
to locate the detecting file; do not use it to claim that an individual case is redundant.

- **Gate:** every change to a package's `src/` must leave no surviving mutant in the changed files,
  except mutants that are equivalent or unreachable, which are listed in the pull request with a
  reason. The gate is incremental and scoped to changed files; existing code is not gated
  retroactively.
- **Run locally:** `pnpm --filter @lazuli/<package> mutate` runs a full package. Append
  `--mutate 'src/file.ts:startLine-endLine'` for a bounded sample; add `--force` and point
  `--incrementalFile` at a fresh temporary path when the sample must exclude stored results.
  Reports land in `<package>/reports/mutation/index.html`. `pnpm mutate:changed` does not yet load
  the package mutation script's test environment, so it is not the supported path for
  integration-tier packages.
- **Read the report:** a survived mutant in a branch you wrote means the test for that branch
  may not exist or may assert too little. Reproduce the changed behavior before deciding whether
  to strengthen the test or record an equivalent or unreachable mutant.
- **Cost (measured 2026-09-07):** `domain`, whole package, 498 mutants in 28 s (0.055 s per
  mutant). `api` through `integration`, two sampled files, about 90 mutants per file at 1.96 s per
  mutant: a change touching two or three files costs about 7 minutes. That is above the 5-minute
  budget for a pull request, which is why rules are born pure (above). Full integration-tier runs
  are on demand, never in a pull request.
- **Scope:** the `transport` tier is not mutated; it only proves transport.

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

Measured floor without the artificial delay: about 200 ms per `node --test` process, plus about
600 ms for each file that loads Prisma. Budgets start here and are revised after two weeks of CI
durations.

| Tier          | Budget per test | Budget per file |
| ------------- | --------------- | --------------- |
| `unit`        | 50 ms           | 5 s             |
| `integration` | 500 ms          | 5 s             |
| `transport`   | 1 s             | 5 s             |

CI publishes per-test durations. A test over budget is fixed in the same change: narrower fixture,
fewer round trips, or a move to a cheaper tier.

## Examples

Good, from this repository (paths after the 2026-09 layout):

- `packages/domain/test/finance-ledger.unit.test.ts` :: "gives waived installments precedence over
  payments" — one rule, one computed outcome, boundary named in the title.
- `packages/domain/test/session-time.unit.test.ts` :: "uses the SP current day, not the UTC day"
  — the bug it catches is in the title.
- `packages/domain/test/installment-generation.unit.test.ts` :: "always sums generated amounts to
  the principal" — an invariant, asserted on a value the test derives.
- `packages/db/test/schema/finance.integration.test.ts` :: "rejects invalid adjustment signs by
  type" — the database computes the rejection (rule 11).
- `packages/api/test/attendance/confirm.integration.test.ts` :: "persists nothing before confirm,
  then commits every row atomically" — a transaction rule that only this tier can prove.
- `packages/api/test/attendance/makeup-outcome.integration.test.ts` :: "never writes an Attendance
  row" — a negative invariant with a counted assertion.
- `packages/api/test/trpc/rbac.transport.test.ts` :: "admin gets 200, teacher gets 403, anonymous
  gets 401" — exactly what the adapter adds, nothing else.
- `apps/web/test/features/new-student-reducer.unit.test.ts` :: "flips exactly on the 18th
  birthday" — a boundary, at the boundary.

Bad, and why (removed or rewritten under issue #61): tests that assert only `assert.ok(result)`;
transport tests that re-read the database to re-prove a rule the integration twin already covers;
tests of a placeholder handler; tests whose only assertion lives inside a helper; tests that copy
the fixture value into the expectation.
