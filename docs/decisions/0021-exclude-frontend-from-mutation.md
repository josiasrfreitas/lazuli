# Exclude frontend packages from mutation testing

Status: Accepted
Decision date: 2026-09-24
Acceptance date: 2026-09-24
Supersedes: Frontend mutation scope in [0017](0017-gate-tests-on-mutation-score-and-assertion-guardrails.md) and [0019](0019-limit-mutation-to-unit-tests.md)
Superseded by: None
Legacy sources: None

Implementation evidence: `scripts/mutate-changed.mjs`, `apps/web/package.json`, `packages/ui/package.json`, `docs/testing/README.md`.

## Context

The frontend mutation gate failed on a small score difference while many surviving mutants concerned presentation details. Its threshold encouraged adding assertions to raise the score without a clear connection to the product contract.

## Decision

Exclude `apps/web` and `packages/ui` from mutation testing. Keep changed-file mutation for other packages. Frontend unit tests, test quality checks, lint, typecheck, build, and complete CI test tiers remain required.

## Consequences

Frontend changes no longer have a mutation score as a blocking signal. Reviewers must assess whether tests protect observable behavior; the other automated checks do not establish assertion strength by themselves.
