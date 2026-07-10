# Testing Workflow

Agent-facing source of truth for choosing and writing tests in Lazuli. Use Node.js built-in `node:test`; do not introduce Vitest, Jest, or browser E2E into these tiers.

Workflow automation changed in [PR #35](https://github.com/josiasrfreitas/lazuli/pull/35) (Lefthook pre-commit), [PR #36](https://github.com/josiasrfreitas/lazuli/pull/36) (worktree bootstrap + isolated Postgres), and [PR #37](https://github.com/josiasrfreitas/lazuli/pull/37) (fake-gcs-server + per-worktree GCS buckets).

## Automation overview

Regression coverage is largely automated. Your job is to **choose the right tier(s), write tests for new/changed behavior, and fill the Linear test block** — not to manually re-run the full suite on every change unless you are debugging a failure.

| Layer                | When                    | What runs                                                                          |
| -------------------- | ----------------------- | ---------------------------------------------------------------------------------- |
| Pre-commit (local)   | Every `git commit`      | Prettier on staged files, `pnpm lint`, `pnpm typecheck`, `pnpm test` (unit only)   |
| CI — Quality gates   | Every PR/push to `main` | `pnpm format:check`, lint, typecheck, unit tests, build                            |
| CI — Database gates  | Every PR/push to `main` | Postgres 16, `prisma:deploy`, `prisma:drift`, `pnpm test:db`, `pnpm test:behavior` |
| Agent responsibility | During feature work     | Add/update tests for every required tier                                           |

Pre-commit mirrors the CI Quality gates job (`lefthook.yml` ↔ `.github/workflows/ci.yml`). DB and behavior tiers stay in CI because they need Docker. See `docs/MVP/TECHNICAL_SPEC.md` §10 for the spec-layer vocabulary; this doc is the canonical command/tier mapping.

## Tiers

| Tier        | What it proves                                                                                         | Layout                               | Command              | Needs Docker?    |
| ----------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------ | -------------------- | ---------------- |
| Unit        | One function or module with mocked I/O                                                                 | `packages/*/test/*.test.ts`          | `pnpm test`          | No               |
| Integration | Real Postgres, schema constraints, tRPC caller + DB, Mailpit or other local resources                  | `packages/*/test/db/*.test.ts`       | `pnpm test:db`       | Yes for Postgres |
| Behavior    | Backend scenario through the HTTP/tRPC boundary, asserting status, response shape, and DB side effects | `packages/*/test/behavior/*.test.ts` | `pnpm test:behavior` | Yes              |

Browser E2E is separate. `pnpm test:e2e` is the Playwright track for real browser flows and can remain manual/nightly until UI stabilizes. Behavior tests are backend scenario tests, not Playwright.

## When each tier is required

| Change type                                                  | Required tier(s)                                                             |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| Domain calculator, pure invariant, parser, formatter         | Unit                                                                         |
| RBAC helper or procedure middleware with mocked I/O          | Unit                                                                         |
| Prisma migration, CHECK constraint, index, schema behavior   | Integration                                                                  |
| tRPC procedure that reads or writes DB state                 | Integration                                                                  |
| User-visible tRPC procedure exposed over HTTP                | Integration and behavior                                                     |
| Auth flow, HTTP status, session, cookie, or request boundary | Behavior                                                                     |
| Worker handler                                               | Unit for branching logic; integration when it touches DB or local resources  |
| External adapter                                             | Unit for mapping logic; integration when a local resource or emulator exists |
| GCS artifact behavior                                        | Integration against local fake-gcs-server (`pnpm seed:gcs` for fixtures)     |

If a feature crosses tiers, test the narrow logic at the lowest tier and add only the scenario coverage needed at the boundary.

## File layout

- Unit: `packages/domain/test/semester.test.ts`, `packages/api/test/rbac.test.ts`
- Integration: `packages/db/test/db/student-schema.test.ts`, `packages/api/test/db/students.test.ts`
- Behavior: `packages/api/test/behavior/students-http.test.ts`, `packages/auth/test/behavior/auth-flow.test.ts`
- Shared helpers: `packages/db/test/support.ts`, `packages/api/test/db/student-test-support.ts`
- Do not move pure DB/caller tests into `test/behavior/` unless they exercise the HTTP boundary.

**Patterns (quick reference):** unit tests use `node:test` + mocks; integration uses `databaseIt` from `@lazuli/db/test` with prefix-based cleanup; behavior uses `fetchRequestHandler` (or the Better Auth handler when that is the boundary), asserts HTTP status/body, and checks DB side effects. Keep PII out of logs.

## Local prerequisites

Worktree bootstrap sets `DATABASE_URL` (and, after PR #37, GCS env) per checkout — see [`docs/agents/worktrees.md`](worktrees.md).

For `pnpm test:db` and `pnpm test:behavior` when running locally:

```bash
docker compose up -d
pnpm prisma:deploy
```

Agents rarely need to run db/behavior locally unless iterating on those tiers or debugging CI. Pre-commit already runs unit tests on every commit.

## Done checklist

1. Add or update tests for **every tier** the decision table requires.
2. Pre-commit runs unit tests automatically on commit — fix hook failures before pushing.
3. CI runs `test:db` and `test:behavior` on PR — fix CI failures if reported.
4. Run `pnpm test:db` / `pnpm test:behavior` locally only when touching those tiers or debugging a CI failure.
5. Fill the Linear test block (below).

If a command cannot run locally, state the blocker and residual risk explicitly.

## Linear issue test block

Add or update this block on feature issues and PR notes:

```markdown
## Tests

| Tier        | Files                                    | Command              |
| ----------- | ---------------------------------------- | -------------------- |
| Unit        | `packages/.../test/foo.test.ts`          | `pnpm test`          |
| Integration | `packages/.../test/db/bar.test.ts`       | `pnpm test:db`       |
| Behavior    | `packages/.../test/behavior/baz.test.ts` | `pnpm test:behavior` |
```

Use `N/A` only when the decision table above clearly does not require that tier.

## Technical spec mapping

| Technical spec layer   | Canonical tier here                                               |
| ---------------------- | ----------------------------------------------------------------- |
| Domain unit tests      | Unit                                                              |
| DB integration tests   | Integration                                                       |
| tRPC integration tests | Integration for caller + DB; behavior for HTTP boundary scenarios |
| Worker tests           | Unit and integration, depending on resource usage                 |
| E2E smoke tests        | Playwright browser E2E, separate from behavior                    |

Coverage gates are planned in `TECHNICAL_SPEC.md` §3.4 but are not enforced in CI yet.
