# Limit mutation execution to unit tests

Status: Accepted
Decision date: 2026-09-14
Acceptance date: 2026-09-14
Supersedes: Mutation test-tier scope, score denominator, and infrastructure requirements in 0017
Superseded by: [0020](0020-remove-changed-source-coverage-gate.md) (changed-source execution gate only); [0021](0021-exclude-frontend-from-mutation.md) (frontend mutation scope)
Legacy sources: None

Implementation evidence: `tooling/stryker/base.mjs`, package Stryker configurations,
`.github/workflows/ci.yml`, `docs/testing/README.md`.

## Context

A product PR's mutation runner estimated roughly 40 minutes, making repeated feedback too costly.
The owner chose to run mutation through unit tests only and assess integration-test quality through
guidance and the other checks. This changes policy without claiming that integration tests alone
caused all of the observed runtime or that unit-only mutation has a measured time bound.

## Decision

Stryker selects only `test/**/*.unit.test.ts`. Integration and transport continue to execute in the
complete test tiers, with their infrastructure, JUnit/LCOV reports, and prospective assertion
guardrails. Reviews must assess meaningful observable contracts,
failure cases, and fixture isolation; those checks do not certify assertion quality on their own.

The mutation job no longer provisions Postgres or Mailpit or applies migrations. The infrastructure
worker restriction is removed. Changed production-source selection, incremental cache safety,
and mandatory dry run remain. The score threshold is 70 on unit-covered mutants only:
`100 * (Killed + Timeout) / (Killed + Timeout + Survived)`. Uncovered mutants remain visible but
do not contribute to the score. An empty denominator is N/A; execution errors still fail.
The package wrapper enforces this threshold instead of Stryker's built-in total-score gate.

## Consequences

Integration suites are no longer repeated for mutants. This does not promise a particular runtime.
Source exercised only by integration can yield uncovered mutants, which are reported but do not
fail the unit-covered score. Avoid implementation-mirroring mocks written solely to satisfy the
mutation score. All other
provisions of decision 0017 remain in force.
