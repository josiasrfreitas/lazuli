---
name: ship-with-tests
description: >-
  Ensure new/changed behavior has tests at the right tier; execution is
  automated via lefthook pre-commit and CI.
disable-model-invocation: true
---

# Ship With Tests

Full workflow: `docs/agents/testing.md`. Local dev setup: `docs/agents/worktrees.md`.

## Your job

1. Read the Linear issue, PRD acceptance criteria, or user request.
2. Pick tier(s) from the table below and name test files before editing.
3. Add or update tests for every required tier.
4. Fill the Linear test block.

**Execution is automated:** pre-commit runs format, lint, typecheck, and `pnpm test` on every commit. CI runs integration + behavior on PR. Fix hook/CI failures; don't manually re-run the full suite unless debugging.

## Tier decision

| Change                                                    | Tier                                                        |
| --------------------------------------------------------- | ----------------------------------------------------------- |
| `packages/domain/*` calculator or invariant               | Unit                                                        |
| RBAC or pure procedure middleware                         | Unit                                                        |
| Migration, CHECK, index, schema behavior                  | Integration                                                 |
| tRPC procedure with DB access                             | Integration, plus behavior if HTTP-facing                   |
| Auth flow, HTTP status, session, cookie, request boundary | Behavior                                                    |
| Worker handler                                            | Unit plus integration when it touches DB or local resources |
| External adapter / GCS artifacts                          | Unit, plus integration when a local emulator exists         |

## File layout

`test/*.test.ts` (unit) · `test/db/*.test.ts` (integration) · `test/behavior/*.test.ts` (behavior). Playwright stays under `pnpm test:e2e`.

## Linear test block

```markdown
## Tests

| Tier        | Files                                    | Command              |
| ----------- | ---------------------------------------- | -------------------- |
| Unit        | `packages/.../test/foo.test.ts`          | `pnpm test`          |
| Integration | `packages/.../test/db/bar.test.ts`       | `pnpm test:db`       |
| Behavior    | `packages/.../test/behavior/baz.test.ts` | `pnpm test:behavior` |
```

Use `N/A` only when `docs/agents/testing.md` says the tier is not required.
