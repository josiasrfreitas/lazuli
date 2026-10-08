# Testing guide

This is Lazuli's source of truth for test intent, placement, and gates. Decisions [0017](../decisions/0017-gate-tests-on-mutation-score-and-assertion-guardrails.md)
and [0023](../decisions/0023-remove-mutation-testing.md) record the test quality policy.
Vocabulary comes from [`CONTEXT.md`](../../CONTEXT.md).

Guidance helps an implementer choose evidence; static analysis catches named patterns; coverage
shows execution. None of those alone certifies that a relevant contract is protected.

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
| Unobserved behavior      | code executes without an assertion that detects the wrong result                    | Review the expected result against a plausible defect and the stated contract.                                                                                                   |
| Fragile execution        | swallowed errors, assertions behind optional branches, real sleep used for ordering | Polling Mailpit with a bounded deadline is legitimate integration synchronization. Controlled fake clocks and deterministic retries are preferable elsewhere.                    |

Fixtures are evidence when the application transforms or persists them; inserting and rereading the
same database value may only echo setup. Fixtures must remain isolated from test order and other
files. Repetition is justified when each case adds a relevant condition or identifies an invariant;
there is no universal test or assertion count. Helpers and parametrized loops are allowed when
checks necessarily execute and failures identify the case. Mocks are allowed at dependency seams.

Dedicated `test/` directories allow literal numbers, decimal formatting, repeated scenario strings,
and long files/functions, statement lists, and nested callbacks. They are excluded from jscpd's
5% duplication gate. Production retains the existing rules. Type safety, promises, imports,
architectural boundaries, and prospective assertion quality checks still apply to tests.

## Prospective static gate

`pnpm test:quality:changed --base <ref>` analyzes new test files in full. In existing files, it
analyzes every touched `it`/`test` function as a unit; module-level diagnostics apply only when their
own line changed. Use `--staged` for an optional local review; CI runs the gate automatically.

Blocking rules cover module-load assertions, constant/self comparisons, truthiness comparisons,
errors without matchers, unawaited promise assertions, `.only`, skips without reasons, commented
tests, duplicate titles/assertions, `async` without `await`, and non-strict `assert` imports.
Contextual warnings cover missing inline assertions, `doesNotThrow`/`doesNotReject`, conditional
assertions/flow, real sleeps, and non-null-only checks. Each diagnostic names its rule and this guide.
Warnings remain non-blocking while calibrated. There is deliberately no `max-assertions` rule.

## Executable workflow

- `pnpm test` runs unit tests; `test:integration` and `test:transport` run infrastructure tiers.
- Pre-commit only formats supported staged files and runs `git diff --cached --check`.
- `pnpm check:pre-push --base <ref>` only parses committed JS/TS and JSON and checks the
  650-line limit for changed application/shared components. It reads from HEAD, excluding
  staged, unstaged, and untracked edits. It does not repeat formatting or whitespace checks.
- Local hooks run no lint, typecheck, build, test suite or infrastructure operation.
  CI owns those full gates; run relevant tests explicitly while implementing a change.
- `pnpm test:affected --base <ref>` selects affected workspaces and isolated infrastructure for manual
  test runs. `pnpm test:affected --staged --unit-only` is its infrastructure-free staged variant.
  Unknown executable files fail closed until their impact is classified.
- Integration and transport tests selected locally share a fresh, unseeded PostgreSQL database.
  The orchestrator validates the expected healthy Compose containers before expensive checks,
  deploys migrations, checks drift, passes the temporary `DATABASE_URL` only to subprocesses, runs
  tiers serially, and removes the database even after failure or interruption. It never starts
  Docker, promotes a light worktree, writes `.env`, seeds fixtures, or resets the development
  database. Missing infrastructure reports the minimal `docker compose up -d ...` command.
- CI runs formatting, full lint, duplication, typecheck, prospective test quality, production build,
  every test tier and migration/drift checks. It uses a new Postgres instance.
  Static checks, build, unit/scripts/styles, and infrastructure start independently. Component size
  belongs to static checks. Independent steps and Turbo tasks continue after failures; consumers of
  failed dependencies are prevented. Integration and transport share Postgres and run sequentially,
  with transport still running after integration fails when preparation succeeded.
  `Quality gates` requires static checks, build, unit/scripts/styles, and infrastructure jobs.
  Turbo caches are isolated by job and restored from that job's latest snapshot, so concurrent
  jobs cannot overwrite each other's cache.
- CI runs full tiers and root unit checks without Turbo cache for its reporting pass. JUnit and LCOV are written per
  package/tier, alongside the native `spec` reporter in stdout (case, file, and failure message).
  Artifacts have distinct names per job and are uploaded even on failure when available. Job
  summaries identify preparation failures and incomplete execution; absent reports after blocked
  preparation do not create a second test failure. `pnpm test:durations` prints the ten slowest
  tests plus non-blocking budget warnings.
- `pnpm test:surface-inventory` lists real `appRouter` procedures and workflow constants referenced
  or unreferenced in tests. It is an inventory, not proof of execution, and missing references do
  not block.

## Test quality and duration

Review unit, integration, and transport tests against observable contracts, independent expected
results, meaningful failure cases, and isolated fixtures. Prospective assertion guardrails, full
test tiers, and JUnit/LCOV reporting remain mandatory. These are execution and static evidence;
reviewers must still judge whether a plausible defect would make a test fail. See
[0023](../decisions/0023-remove-mutation-testing.md).

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
