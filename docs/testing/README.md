# Testing guide

This is Lazuli's source of truth for test intent, placement, and gates. Decision
[0017](../decisions/0017-gate-tests-on-mutation-score-and-assertion-guardrails.md) records why.
Vocabulary comes from [`CONTEXT.md`](../../CONTEXT.md).

Guidance helps an implementer choose evidence; static analysis catches named patterns; coverage
shows execution; mutation measures detection of generated changes. None of those alone certifies
that a relevant contract is protected.

## Start with the contract

Before changing code, identify the contract, a plausible defect, and an independent basis for the
expected result. Inspect existing tests first. A useful test exercises the production code
responsible for the contract and would fail for that defect. Contracts include business behavior,
persistence, authorization, serialization, and external integration.

Apply this guidance prospectively to code and tests in the diff. A partially edited `it`/`test`
function is reviewed as a whole; untouched neighboring tests are not cleanup work. Never weaken an
expectation, skip a test, or change a gate merely to pass. Reconsider one incompatible approach; if
the same conflict remains, ask the owner. Normal red/green iterations are not an escalation count.

## Tiers and placement

| Tier          | Proves                                                                               | Needs                                   |
| ------------- | ------------------------------------------------------------------------------------ | --------------------------------------- |
| `unit`        | Pure rules, calculations, validators, invariants, authorization, controlled services | No infrastructure                       |
| `integration` | Persistence, constraints, transactions, derived reads, and component/database wiring | Postgres; Mailpit for email integration |
| `transport`   | What the real adapter adds: HTTP, serialization, session, and authorization          | Postgres and adapter                    |

Use the cheapest tier that proves the contract. A higher tier is legitimate when it adds evidence
about composition or the adapter; it need not repeat every lower-tier detail. The suffix selects the
runner but does not certify test quality.

```text
packages/<pkg>/test/<area>/<subject>.unit.test.ts
packages/<pkg>/test/<area>/<subject>.integration.test.ts
packages/<pkg>/test/<area>/<subject>.transport.test.ts
packages/<pkg>/test/support/<feature>.ts
```

`<area>` mirrors the first folder under `src/`; flat source stays flat. Cross-cutting tRPC tests use
`test/trpc/`, and Prisma-schema tests use `packages/db/test/schema/`. Support modules may be split
behind one feature entry point. `@lazuli/db/test` is the only cross-package test-support import.

## Quality smells and detection limits

A smell triggers investigation, not automatic deletion. Adding an assertion that cannot observe
the contract does not fix weak evidence.

| Family                   | Rejected example                                                                    | Legitimate evidence / limit                                                                                                                                                      |
| ------------------------ | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Invalid verification     | `assert.equal(value, value)`, `assert.ok(true)`, unawaited async assertion          | The changed value is compared with an independently derived result. Static checks catch only demonstrable syntax/data-flow cases.                                                |
| Superficial verification | only `assert.ok(result)` or `assert.doesNotThrow(action)`                           | Existence/type is enough only when that property is the concrete contract, such as a public export. Non-null may guard a stronger assertion.                                     |
| Circular expectation     | production calculator builds both actual and expected                               | A literal, hand calculation, invariant, protocol spec, or separately owned oracle provides the expectation. Static analysis can only warn on common shapes.                      |
| Artificial target        | testing a mock, placeholder, or copied router map                                   | Mock dependencies while exercising the real responsible unit. Interaction assertions are valid when the interaction itself is the contract, such as the exact workflow enqueued. |
| Implementation coupling  | asserting an incidental call sequence                                               | Assert observable behavior; internal interaction is acceptable only when consumers rely on it.                                                                                   |
| Unobserved behavior      | code executes but mutations survive                                                 | Use Stryker as limited evidence. Equivalent/unreachable mutants and irrelevant generated mutations require judgment.                                                             |
| Fragile execution        | swallowed errors, assertions behind optional branches, real sleep used for ordering | Polling Mailpit with a bounded deadline is legitimate integration synchronization. Controlled fake clocks and deterministic retries are preferable elsewhere.                    |

Fixtures are evidence when the application transforms or persists them; inserting and rereading the
same database value may only echo setup. Fixtures must remain isolated from test order and other
files. Repetition is justified when each case adds a relevant condition or identifies an invariant;
there is no universal test or assertion count. Helpers and parametrized loops are allowed when
checks necessarily execute and failures identify the case. Mocks are allowed at dependency seams.

## Prospective static gate

`pnpm test:quality:changed --base <ref>` analyzes new test files in full. In existing files, it
analyzes every touched `it`/`test` function as a unit; module-level diagnostics apply only when their
own line changed. Use `--staged` in pre-commit.

Blocking rules cover module-load assertions, constant/self comparisons, truthiness comparisons,
errors without matchers, unawaited promise assertions, `.only`, skips without reasons, commented
tests, duplicate titles/assertions, `async` without `await`, and non-strict `assert` imports.
Contextual warnings cover missing inline assertions, `doesNotThrow`/`doesNotReject`, conditional
assertions/flow, real sleeps, and non-null-only checks. Each diagnostic names its rule and this guide.
Warnings remain non-blocking while calibrated. There is deliberately no `max-assertions` rule.

## Executable workflow

- `pnpm test` runs unit tests; `test:integration` and `test:transport` run infrastructure tiers.
- Pre-commit formats first, runs lint, the staged prospective gate and typecheck in parallel,
  then runs unit tests. Guardrail tests create temporary source fixtures, so they run after readers.
  Root lint, duplication and unit checks are Turbo tasks with repository-wide inputs; cached passes
  are reused locally, including by affected checks.
- `pnpm test:affected --base <ref>` runs changed workspaces and transitive consumers. Root config
  selects all workspaces; documentation-only changes select none. Report-tool/script-test changes
  run root checks without application infrastructure; Pullfrog workflow changes select no test tier.
  Integration and transport tasks share one serial Turbo invocation. Infrastructure preflight fails
  with bootstrap/migration instructions instead of skipping a tier.
- CI runs production build alongside static checks. `Quality gates` requires both to pass;
  complete tests and mutation wait only for static checks. Turbo caches are isolated by job and
  restored from that job's latest snapshot, so concurrent jobs cannot overwrite each other's cache.
- CI runs full tiers and root unit checks without Turbo cache for its reporting pass. JUnit and LCOV are written per
  package/tier, JUnit is uploaded even on failure, and `pnpm test:durations` prints the ten slowest
  tests plus non-blocking budget warnings.
- `pnpm test:changed-covered --base <ref> --reports` reads CI LCOV. Locally, omit `--reports` to run
  tiers. Missing/malformed reports, failed tests/environment, or a changed source with `LH=0` fail.
- `pnpm test:surface-inventory` lists real `appRouter` procedures and workflow constants referenced
  or unreferenced in tests. It is an inventory, not proof of execution, and missing references do
  not block.

## Mutation and duration

`pnpm mutate:changed --base <ref>` builds affected packages/dependencies before invoking package
Stryker configs. Changed-file mutation score must be at least 70; transport is excluded. Survivors
are investigation evidence but do not independently fail a score of 70 or more. CI runs mutation on
pull requests with full Git history, Postgres, Mailpit, and applied migrations. A scope preflight
skips the mutation runner only when there are no eligible changed source files; packages without
mutation configuration still reach the fail-closed gate. Migration drift is checked in the complete
test job; mutation applies migrations to its own isolated database.

CI restores incremental reports only within the same PR and fingerprint, and saves reports even
when the score fails. The fingerprint includes the mutation scope, resolved Node version and all non-ignored
repository files except dedicated documentation (`docs/`, `.design/`, root Markdown). Source,
tests, helpers, fixtures, dependencies and configuration changes invalidate it conservatively.
Thus code changes currently rerun all mutants in scope; documentation-only pushes and retries can
reuse results. This avoids Stryker's inability to detect changes in imported helpers/dependencies.
The dry run and threshold of 70 remain mandatory. Cache behavior and timing must be verified in
GitHub Actions; local cache-key tests establish invalidation, not remote restore/save behavior.

Review every new surviving mutant, even when the score passes. Add or strengthen tests when a
survivor exposes a gap in relevant observable behavior, especially financial calculations,
authorization, or data integrity. For equivalent or unreachable mutants, or behavior outside the
contract, document the reason in the review or completion report. Investigate unexplained survivors
before considering the work complete. Do not create implementation-coupled tests merely to reach
100 percent; a mutation score does not establish that the chosen approach serves the user's goal.

`pnpm mutation:redundancy-report` reads the local Stryker JSON matrix and lists test files that kill
no mutant exclusively. Shared kills do not prove redundancy. A missing or invalid report is a tool
error; the informational finding itself does not block.

Duration budgets are investigation triggers, not a flaky pass/fail threshold: unit 50 ms/test,
integration 500 ms/test, transport 1 s/test, and 5 s/file. A single slow run emits a warning only.

## Examples

Rejected: a status-only transport test; a bare `assert.rejects(operation)`; a helper whose assertion
may never run; copying a production result into the expected value; sleeping a fixed second to wait
for Mailpit; rereading a directly inserted value without observing database behavior.

Legitimate: a transport test checks status and serialized adapter output; a validator checks the
error code; a parameterized invariant asserts every named case; a bounded Mailpit poll checks the
captured message; a mock verifies a contractual enqueue payload; an integration test creates
through the application and checks the persisted mapping.
