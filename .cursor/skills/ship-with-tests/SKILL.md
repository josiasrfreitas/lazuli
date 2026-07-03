---
name: ship-with-tests
description: >-
  Implements Lazuli features with the three-tier test workflow (unit,
  integration, behavior). Use when building features, fixing production code, or
  when the user mentions tests, testing, TDD, or test coverage.
disable-model-invocation: true
---

# Ship With Tests

## Before Coding

1. Read `docs/agents/testing.md`.
2. Read the Linear issue, PRD acceptance criteria, or user request.
3. Decide which tier(s) apply and name the expected test files before editing.

## Tier Decision

| Change                                                    | Tier                                                        |
| --------------------------------------------------------- | ----------------------------------------------------------- |
| `packages/domain/*` calculator or invariant               | Unit                                                        |
| RBAC or pure procedure middleware                         | Unit                                                        |
| Migration, CHECK, index, schema behavior                  | Integration                                                 |
| tRPC procedure with DB access                             | Integration, plus behavior if HTTP-facing                   |
| Auth flow, HTTP status, session, cookie, request boundary | Behavior                                                    |
| Worker handler                                            | Unit plus integration when it touches DB or local resources |
| External adapter                                          | Unit, plus integration when a local resource exists         |

## While Coding

- Co-locate tests in the changed package.
- Use `test/*.test.ts` for unit, `test/db/*.test.ts` for integration, and `test/behavior/*.test.ts` for backend behavior.
- Reuse `databaseIt`, `packages/api/test/db/student-test-support.ts`, and `fetchRequestHandler` patterns.
- Use prefix-based cleanup for DB-backed integration and behavior tests.
- Keep Playwright under `pnpm test:e2e`; do not treat browser E2E as behavior tests.

## Examples

- Unit: `packages/domain/test/semester.test.ts`
- Unit RBAC: `packages/api/test/rbac.test.ts`
- Integration: `packages/api/test/db/students.test.ts`
- DB schema integration: `packages/db/test/db/student-schema.test.ts`
- Behavior: `packages/api/test/behavior/students-http.test.ts`
- Behavior auth: `packages/auth/test/behavior/auth-flow.test.ts`

## Linear Test Block

```markdown
## Tests

| Tier        | Files                                    | Command              |
| ----------- | ---------------------------------------- | -------------------- |
| Unit        | `packages/.../test/foo.test.ts`          | `pnpm test`          |
| Integration | `packages/.../test/db/bar.test.ts`       | `pnpm test:db`       |
| Behavior    | `packages/.../test/behavior/baz.test.ts` | `pnpm test:behavior` |
```

Use `N/A` only when `docs/agents/testing.md` says the tier is not required.

## Before Done

Run all three commands before reporting complete:

```bash
pnpm test && pnpm test:db && pnpm test:behavior
```

Fix failures before claiming done. If a command cannot run, report the exact blocker and residual risk.
