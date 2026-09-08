# Gate tests on mutation score and assertion guardrails

Status: Accepted
Decision date: 2026-09-07
Acceptance date: 2026-09-08
Supersedes: None
Superseded by: None
Legacy sources: None
Implementation evidence: `docs/testing/README.md`, `CONTEXT.md`, `tooling/stryker/`,
`tooling/eslint/base.js`, `scripts/mutate-changed.mjs`, `scripts/changed-source-covered.mjs`,
`.github/workflows/ci.yml`

## Context

Lazuli runs three test tiers on the native `node:test` runner. Until 2026-09 they were named by
what they needed to run (`test/*.test.ts`, `test/db/*.test.ts`, `test/behavior/*.test.ts`), not by
what they proved, and the suite was large for the product's age (93 files, ~460 tests), much of it
generated with AI assistance. Line coverage was not measured, and nothing distinguished a test
that would catch a regression from one that passes regardless of what the code does: pass-through
checks, non-null checks, status-only HTTP checks, and re-assertions of fixture values all counted
the same as a real rule check. The pyramid was inverted: about 220 tests went through Postgres
against about 225 pure ones, and in `packages/api` no procedure had a unit test because the
business rule lived inside the procedure, glued to persistence. Test and source did not meet by
name: finding the tests for a source file meant reading imports.

Mutation cost was measured on 2026-09-07 before deciding where rules should be proven: a mutant
in `packages/domain` costs 0.055 s to test (498 mutants, 28 s, score 83%); a mutant reached only
through the Postgres tier in `packages/api` costs 1.96 s (two sampled files, about 90 mutants per
file). A change touching two or three `api` source files therefore costs about 7 minutes of
mutation through the integration tier, above the 5-minute budget acceptable in a pull request.

## Decision

Test quality is gated on what a test detects, not on how many lines it touches, and the structure
of the suite is chosen to make that gate cheap.

1. **Mutation testing is the acceptance test for new tests.** StrykerJS with the `tap` runner
   mutates each package through the tier that covers its code: `unit`, plus `integration` where
   code is only reachable through Postgres (one worker, incremental). A change that adds or
   modifies source under a package `src/` must leave no surviving mutant in the changed files that
   a reasonable test could kill; surviving mutants are either killed by a test in the same change
   or listed in the change description with a reason. The gate is incremental and scoped to
   changed files. Existing code is not gated retroactively; its baseline is recorded and raised
   opportunistically. The `transport` tier is not mutated; it only proves transport. A full
   integration-tier run is too slow for a pull request and runs on demand.
2. **Rules are born pure.** Because the measured cost per mutant is about forty times higher
   through Postgres, new business logic starts as a pure function in `packages/domain` (or a pure
   service) with a `unit` test, and the procedure orchestrates. This applies feature by feature as
   code is touched, not as a retroactive rewrite. The first extracted batch is enrollment/semester
   intersection and São Paulo calendar calculations, with separate month-bound contracts for
   timestamp instants and `@db.Date` values.
3. **Tiers are named by what they prove and placed to mirror the source.** The tiers are `unit`,
   `integration`, `transport`. A test lives at `test/<area>/<subject>.<tier>.test.ts`, where
   `<area>` is the first-level folder of `src/` it exercises (flat when `src/` is flat, `trpc/` for
   cross-cutting plumbing, `schema/` in `packages/db` for the Prisma schema itself), and the tier
   suffix is written in every package. Runners select by suffix. Support modules live in
   `test/support/`. Vocabulary for areas and subjects comes from `CONTEXT.md`.
4. **Deterministic guardrails live in the linter.** The `eslint-node-test` plugin, on ESLint 10,
   rejects tests without an assertion, assertions with constant outcomes, self-comparisons,
   `doesNotThrow`/`doesNotReject`, truthiness checks over comparisons, `throws`/`rejects` without
   an error expectation, assertions inside conditionals, and `.only`/`.skip` without a reason. The
   repository adds a ban on non-null-only assertions. Tests register with `describe`/`it` from
   `node:test` directly, with at least one inline `assert.*` per test, so the linter can see them.
   Lint runs on every commit, so these cannot enter the suite.
5. **Judgment rules live in one document.** `docs/testing/README.md` is the single place that
   states what a test must prove, which tier owns which concern, where a test lives, what is
   forbidden, and the time budget per tier. `AGENTS.md` and the `ship-with-tests` skill point at
   it and carry no rules of their own.
6. **Tests are measured.** CI records per-test durations and publishes the slowest tests; the
   testing guide sets a budget per tier, and a test that exceeds it is a defect to fix in the same
   change.
7. **Tests that prove nothing are deleted.** Coverage numbers do not justify keeping a test; the
   audit that accompanies this record removes the current ones, using the test-by-mutant matrix as
   evidence.

Issues #62 (structure and names), #60 (mutation rollout), #61 (removal) and #63 (gates, hooks and
local feedback) track the rollout, in that order.

## Consequences

- Every package with tests carries a `stryker.config.mjs` extending the shared tooling config and
  a `mutate` script. `pnpm mutate:changed` runs the gate locally; CI runs it on pull requests.
- The database tier registers tests with `it` from `node:test` rather than a local wrapper, so the
  lint rules can see them (the mechanical swap of `databaseIt` is done under #61).
- Renaming the tiers touched every `package.json` test script, `turbo.json`, the CI workflow, the
  change-gate scripts and the Stryker defaults in one change; from then on a test's path is enough
  to know its tier and its subject, and the gate scripts derive tiers from the suffix.
- ESLint moves from 9 to 10 and `eslint-plugin-import` is replaced by `eslint-plugin-import-x`.
- Writing a useful test costs more thought than writing a passing one. That is the intended trade.

## Alternatives

- **Mutate only the `unit` tier.** Rejected: in `packages/api` almost no rule is reachable from
  `unit` today, so the gate would prove nothing where most bugs live. Mutating `integration` for
  changed files only, with one worker, keeps the cost bounded while rule 2 moves logic to where
  mutation is cheap.
- **Keep the tier directories and only rename them.** Rejected: a parallel tree still hides which
  source a test covers, and the change-gate scripts keep a hand-maintained directory map. A suffix
  plus a mirrored folder makes the relation legible from the path.
- **Place tests next to the source.** Rejected: it mixes test files into build, lint and
  boundary configuration for `src/`, for no gain over a mirrored folder.
- **Line coverage thresholds.** Rejected: easy to inflate without adding detection power.
