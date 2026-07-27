# Lazuli agent guide

Lazuli is a single-school management system for an English-language school in Brazil. Keep work
within the requested slice; do not treat historical documents, placeholders, or unimplemented seams
as product completion.

## Repository map

- `apps/web` — Next.js App Router, tRPC client/server, and Better Auth routes.
- `apps/worker` — worker process.
- `packages/api` — tRPC routers, procedures, RBAC, and service orchestration.
- `packages/auth` — Better Auth configuration and session helpers.
- `packages/db` — Prisma schema, migrations, seeds, and database helpers.
- `packages/domain` — pure calculators and invariants.
- `packages/job-contracts` — workflow names, payloads, and enqueue helpers.
- `packages/integrations` — external adapter interfaces and shared clients.
- `packages/worker-handlers` — worker-only handlers for integrations and artifacts.
- `packages/ui` and `packages/validators` — shared UI and Zod validators.
- `tooling/` — shared lint, formatting, and TypeScript configuration.

## Commands and verification

Run commands from the repository root. Common commands are `pnpm dev`, `pnpm dev:worker`,
`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:db`, `pnpm test:behavior`, `pnpm build`,
and `pnpm format:check`.

Use the `ship-with-tests` skill for feature work, production bug fixes, or explicit testing/TDD
requests. It selects the appropriate test tier; do not copy its tier table into this file. Add the
required tests, run relevant checks, and report checks left to CI with a reason.

Before finishing, inspect the diff, run `git diff --check`, and run proportionate validation. Do not
edit applied migrations, generated files, fixture/test identifiers, or historical identifiers merely
to tidy documentation.

## Hard boundaries

- `apps/web` does not import Prisma or `worker-handlers`.
- `job-contracts` does not import `worker-handlers`.
- `domain` imports no `ui`, `api`, or `db` package.
- Heavy or scheduled work belongs behind the worker boundary, not an inline request.
- Student PII stays in Cloud SQL. Hatchet payloads carry minimal identifiers/status data, and worker
  logs must not contain student PII.
- UI labels are Portuguese-BR; business time is `America/Sao_Paulo`.

## Local workspace safety

The local development model uses Docker Compose and seeded fixtures. Linked worktrees receive an
isolated Postgres database and fake-GCS bucket through the post-checkout bootstrap; Mailpit and
Hatchet are shared per machine. Use `LAZULI_BOOTSTRAP_NO_FIXTURES=1` with `git worktree add` only
when the task does not need DB, email, or Hatchet fixtures. Treat `docker compose down -v` as
destructive local-data deletion.

## Authority and routing

A work item owns the scope, completion checks, dependencies, and tests for that piece of work.
Accepted [decision records](docs/decisions/README.md) own durable engineering constraints. Code,
configuration, and tests show what is implemented and enforced; they do not silently replace either
source. If these sources conflict, or a work item lacks behavior needed to proceed, stop and ask the
owner. Historical material may locate provenance but cannot become current instruction without owner
confirmation.

Until Linear is reorganized, execute only self-contained work items that do not conflict with
accepted decisions or current implementation. Existing work items are not presumed correct because
the old PRD was archived.

Use a work item for changing requirements; a decision record for a lasting engineering choice; a
local README only for folder-local operation; and [`docs/legacy/`](docs/legacy/README.md) only for
historical investigation. The root [README](README.md) is the human setup entry point. Do not add a
nested `AGENTS.md` without a demonstrated local rule that cannot be expressed here or enforced in
code/configuration.
