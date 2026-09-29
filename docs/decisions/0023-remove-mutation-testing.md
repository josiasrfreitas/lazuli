# Remove mutation testing from the test suite

Status: Accepted
Decision date: 2026-09-29
Acceptance date: 2026-09-29
Supersedes: Mutation testing requirements in [0017](0017-gate-tests-on-mutation-score-and-assertion-guardrails.md), [0019](0019-limit-mutation-to-unit-tests.md), and [0021](0021-exclude-frontend-from-mutation.md)
Superseded by: None
Legacy sources: None

Implementation evidence: `.github/workflows/ci.yml`, `package.json`, `docs/testing/README.md`.

## Context

Mutation testing added a separate toolchain, package configurations, cache logic, CI job, and score gate. Earlier decisions narrowed its scope because runtime and score-driven assertions imposed costs that did not reliably track protection of observable product contracts.

## Decision

Remove automated mutation testing from the local suite and CI, including Stryker, mutation scripts, reports, and the score gate. Keep unit, integration, and transport tests, prospective assertion guardrails, JUnit/LCOV reports, static checks, and build gates. Reviewers assess whether tests would detect plausible defects using expectations grounded independently of the implementation.

## Consequences

CI loses the mutation score as a signal of unobserved behavior. Passing test tiers or coverage does not prove assertion strength; reviewers must examine the contract and likely regressions directly. The suite has fewer dependencies and less CI work.
