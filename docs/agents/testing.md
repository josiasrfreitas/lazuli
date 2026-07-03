# Testing Workflow

This is the agent-facing source of truth for choosing and running tests in Lazuli. Use Node.js built-in `node:test`; do not introduce Vitest, Jest, or browser E2E into these tiers.

## Tiers

| Tier        | What it proves                                                                                         | Layout                               | Command              | Needs Docker?    |
| ----------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------ | -------------------- | ---------------- |
| Unit        | One function or module with mocked I/O                                                                 | `packages/*/test/*.test.ts`          | `pnpm test`          | No               |
| Integration | Real Postgres, schema constraints, tRPC caller plus DB, Mailpit or other local resources               | `packages/*/test/db/*.test.ts`       | `pnpm test:db`       | Yes for Postgres |
| Behavior    | Backend scenario through the HTTP/tRPC boundary, asserting status, response shape, and DB side effects | `packages/*/test/behavior/*.test.ts` | `pnpm test:behavior` | Yes              |

Browser E2E is separate. `pnpm test:e2e` is the Playwright track for real browser flows and can remain manual/nightly until UI stabilizes. Behavior tests are backend scenario tests, not Playwright.

## When Each Tier Is Required

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
| Future GCS artifact behavior                                 | Integration once a local emulator or test double is standardized             |

If a feature crosses tiers, test the narrow logic at the lowest tier and add only the scenario coverage needed at the boundary.

## File Layout

- Unit tests live directly under the package test directory: `packages/domain/test/semester.test.ts`, `packages/api/test/rbac.test.ts`, `packages/auth/test/staff-access.test.ts`.
- Integration tests live under `test/db/`: `packages/db/test/db/student-schema.test.ts`, `packages/api/test/db/students.test.ts`.
- Behavior tests live under `test/behavior/`: `packages/api/test/behavior/students-http.test.ts`, `packages/api/test/behavior/rbac-http.test.ts`, `packages/auth/test/behavior/auth-flow.test.ts`.
- Keep shared DB fixtures near the tier that owns them. Existing helpers include `packages/db/test/support.ts` and `packages/api/test/db/student-test-support.ts`.
- Do not move pure DB/caller tests into `test/behavior/` unless they exercise the HTTP boundary with production-style handlers.

## Patterns

Unit:

- Use `describe` and `it` from `node:test`, plus `node:assert/strict`.
- Mock I/O with typed stand-ins when the behavior does not need a real resource. `packages/api/test/rbac.test.ts` uses an empty typed DB stand-in for RBAC.
- Keep unit tests deterministic and independent from `.env`.

Integration:

- Use `databaseIt` from `@lazuli/db/test` for tests that need Postgres.
- Connect and disconnect `db` in `before`/`after` hooks.
- Use prefix-based cleanup for rows created by the test, as in `packages/api/test/db/students.test.ts`.
- Keep real DB/caller coverage in `test/db/` when it does not cross the HTTP boundary.

Behavior:

- Use `fetchRequestHandler` for tRPC HTTP behavior so tests exercise the same adapter shape as production.
- Assert HTTP status codes and response body shape before treating the scenario as covered.
- Assert DB side effects when the scenario writes state.
- Use prefix-based cleanup just like integration tests. Keep PII out of logs and use synthetic test data only.
- Auth behavior can call the Better Auth handler directly when that handler is the production HTTP boundary, as in `packages/auth/test/behavior/auth-flow.test.ts`.

## Local Prerequisites

For `pnpm test:db` and `pnpm test:behavior`:

```bash
docker compose up -d
pnpm prisma:deploy
```

Ensure `.env` contains a valid `DATABASE_URL` for the local Postgres service. Mailpit and future local resources should be started through Docker Compose when a test depends on them.

## Done Checklist

Before finishing feature work, run:

```bash
pnpm test
pnpm test:db
pnpm test:behavior
```

Fix failures before reporting complete. If a command cannot be run locally, state the blocker and the risk explicitly.

## Linear Issue Test Block

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

## Technical Spec Mapping

`docs/MVP/TECHNICAL_SPEC.md` uses layer names that map to this workflow:

| Technical spec layer   | Canonical tier here                                               |
| ---------------------- | ----------------------------------------------------------------- |
| Domain unit tests      | Unit                                                              |
| DB integration tests   | Integration                                                       |
| tRPC integration tests | Integration for caller + DB; behavior for HTTP boundary scenarios |
| Worker tests           | Unit and integration, depending on resource usage                 |
| E2E smoke tests        | Playwright browser E2E, separate from behavior                    |

Coverage gates are planned in `TECHNICAL_SPEC.md` section 3.4 but are not enforced in CI yet. Do not add coverage enforcement unless that work is explicitly requested and trivial.
