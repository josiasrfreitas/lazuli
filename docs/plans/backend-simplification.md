# Backend simplification

Status: Complete — owner request, 2026-09-07.

## This change

- Remove `Class.originalPortalClassName` and its writes through a new migration.
- Use one email configuration parser and sender factory, preserving current auth behavior.
- Reuse existing tests and lint; add no new enforcement framework.

`LEGACY` import support, queue scaffolding, and no-op adapters are outside this change.
Import requirements and worker failure behavior need their own product decisions.

## Prevention

1. Keep email parsing and provider selection in integrations. Expose the canonical factory instead
   of provider constructors; extend existing lint boundaries to block relative imports into internals.
2. When deliberately retiring an input format, test its rejection at the real parser/request boundary
   alongside acceptance of the supported format. Do not maintain a second catalog of every API field.
3. Review new fallback branches and alternative formats against the current work item. Automation
   can enforce a known boundary; it cannot determine whether compatibility has a product purpose.

No keyword bans, compatibility metric, global allowlist, or new CI service. Queue enforcement waits
for the work item defining its real runtime dependency and failure contract.

## Tests

| Tier        | Files                                                                              | Command                                                                 |
| ----------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Unit        | `packages/integrations/test/email.test.ts`                                         | `pnpm --filter @lazuli/integrations test`                               |
| Unit        | `tooling/eslint/test/guardrails.test.js`                                           | `pnpm --filter @lazuli/eslint-config test`                              |
| Integration | `packages/db/test/db/class-schema.test.ts`, `packages/api/test/db/classes.test.ts` | `pnpm --filter @lazuli/db test:db`, `pnpm --filter @lazuli/api test:db` |
| Integration | `packages/integrations/test/db/mailpit-email.test.ts`                              | `pnpm --filter @lazuli/integrations test:db`                            |
| Behavior    | `packages/auth/test/behavior/auth-flow.test.ts`                                    | `pnpm --filter @lazuli/auth test:behavior`                              |

The public API now omits provider constructors and transport-selection internals. The existing
`import/no-restricted-paths` rule blocks auth from importing email internals by relative path; its
negative/positive test runs in `tooling/eslint/test/guardrails.test.js`.

Validated: email unit tests (16), Mailpit integration (1), auth behavior (6), database schema (6),
class creation/cloning (5), and lint guardrails (12). The migration was deployed without reset to
`lazuli_architecture_review`; the removed column is absent. Relevant lint, typechecks, formatting,
and `git diff --check` passed. Full repository suites remain with existing hooks/CI; validation here
was limited to the changed paths. Three pre-existing dynamic-path lint warnings remain in guardrails.
