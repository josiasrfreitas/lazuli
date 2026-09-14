# Gate tests on mutation score and assertion guardrails

Status: Accepted

Decision date: 2026-09-07

Acceptance date: 2026-09-08

Supersedes: None
Superseded by: [0019](0019-limit-mutation-to-unit-tests.md) (mutation tier scope, score denominator, and infrastructure only)
Legacy sources: None

Implementation evidence: `docs/testing/README.md`, `tooling/eslint/`, `tooling/stryker/`,
`tooling/eslint/quality-changed.mjs`, `scripts/test-affected.mjs`,
`scripts/changed-source-covered.mjs`, `scripts/mutate-changed.mjs`, `.github/workflows/ci.yml`.

## Context

Lazuli's suite had grown without executable evidence that assertions could detect regressions.
Line coverage was absent, test names did not expose tiers, and much business logic was reachable
only through expensive Postgres tests. Measurements on 2026-09-07 found about 0.055 s per mutant in
`packages/domain` and about 1.96 s through integration code in `packages/api`. This motivated pure
rules and incremental gates, without retroactively reforming untouched tests.

## Decision

Guidance participates from the beginning of a code change. The implementer identifies the contract,
a plausible defect, and an independent foundation for the expectation, then inspects existing tests
and chooses the cheapest tier that supplies the evidence. `docs/testing/README.md` owns detailed
guidance, smells, exceptions, tiers, and escalation. There is no universal cap on tests or
assertions; helpers, parametrization, fixtures, and mocks are judged by whether they preserve
evidence.

Automation enforces only specific claims:

1. A prospective ESLint gate blocks high-confidence patterns in new files and touched test
   functions, while contextual patterns begin as warnings. It does not certify overall quality.
2. Changed-source LCOV proves that each changed source file executed (`LH > 0`), not that its
   expectations are strong.
3. Stryker measures detection of generated changes in changed files. The blocking threshold is 70,
   not zero survivors; mutation does not establish contract relevance or independence.
4. Unit, integration, and transport runners are centralized for local `spec` output and CI
   JUnit/LCOV artifacts. Duration budgets emit investigation warnings and do not fail one slow run.
5. A non-blocking surface inventory reports procedure/workflow names found in tests without
   claiming execution. A local Stryker matrix report identifies files with no exclusive kills
   without claiming they are redundant.

The tiers remain `unit`, `integration`, and `transport`, selected by filename suffix and placed at
`test/<area>/<subject>.<tier>.test.ts`. Each higher tier must justify the protection it adds; wiring
and composition can be legitimate integration contracts. Transport remains outside mutation.

## Consequences

Pre-commit preserves format, repository lint, typecheck, and unit tests and adds the staged
prospective gate. Pre-push runs affected workspaces and transitive consumers against `origin/main`;
missing infrastructure fails with actionable bootstrap/migration guidance. CI checks out full
history, runs quality/build, runs all test tiers with Postgres and Mailpit while publishing JUnit and
LCOV, then checks changed-file execution and pull-request mutation at threshold 70.

The rollout is prospective. A touched test function is the review unit; unrelated legacy tests are
not cleanup scope. Surviving mutants, slow tests, weak-looking interaction assertions, and missing
surface-name references are evidence to investigate, not standalone proof that a test is bad.
