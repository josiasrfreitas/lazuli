# Remove changed-source coverage gate

Status: Accepted
Decision date: 2026-09-15
Acceptance date: 2026-09-15
Supersedes: Changed-source execution requirements in [0017](0017-gate-tests-on-mutation-score-and-assertion-guardrails.md) and [0019](0019-limit-mutation-to-unit-tests.md)
Superseded by: None
Legacy sources: None

Implementation evidence: `.github/workflows/ci.yml`, `package.json`, `docs/testing/README.md`.

## Context

Changed-source LCOV used runtime line maps as a blocking proxy for whether changed TypeScript was
executed. Its mapping can classify erased type annotations as uncovered executable lines, which
creates failures unrelated to a missing behavioral test.

## Decision

Remove the blocking changed-source coverage command, its CI step, and its dedicated implementation
and tests. CI continues to run the complete test tiers, prospective test-quality checks, mutation,
and publish JUnit and LCOV reports for diagnosis.

## Consequences

Coverage reports remain available as evidence during review but do not independently block a pull
request. Tests must continue to be selected from a concrete contract and regression risk under the
testing guide.
