# Flow Control Graph — Per-Pair Analysis Instructions

Analyze exactly **two** tRPC endpoints by reading source code, validators, Prisma schema, domain logic, and existing tests. Do not rely on docs alone.

## Output file

Write your result to the path given in the task (`docs/analysis/flow-control-graph/pairs/PAIR-XX.md`).

## Required structure per endpoint

````markdown
## `{router}.{procedure}`

- **Type:** query | mutation
- **Auth:** publicProcedure | protectedProcedure | staffProcedure | teacherProcedure | adminProcedure
- **Input schema:** (key fields + constraints)
- **Entities touched:** (Prisma models + fields)

### State preconditions

Bullet list of DB/domain state required before call succeeds.

### Scenarios

| ID  | Scenario | Given (state) | Input | Expected outcome | HTTP/tRPC error (if any) | Post-state |
| --- | -------- | ------------- | ----- | ---------------- | ------------------------ | ---------- |
| S1  | ...      | ...           | ...   | ...              | ...                      | ...        |

Cover: happy path, RBAC denial, validation errors, domain invariant violations, edge cases (empty, archived, closed, overdue, etc.).

### State transitions (flow nodes)

```mermaid
stateDiagram-v2
  ...
```
````

### Outbound edges

Other endpoints or jobs this procedure enables/triggers/requires next.

### Evidence

Files read, tests referenced (with paths).

````

## Cross-pair edges section

At the bottom of the file, add:

```markdown
## Cross-endpoint edges (this pair only)
| From | To | Condition |
|------|-----|-----------|
````

## DB validation (optional)

If Docker/Postgres is available, you may run `pnpm test:db` or `pnpm test:behavior` filtered to relevant tests, or seed via existing test support helpers. Record what you ran under Evidence.
