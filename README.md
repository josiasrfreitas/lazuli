# Lazuli

Lazuli is a management system for one English-language school in Brazil. It supports student,
attendance, finance, reporting, and Portal responsibilities. The interface is Portuguese-BR and
business time is `America/Sao_Paulo`.

## Development status — 2026-07-27

This is a dated, non-executable status snapshot, not a backlog or implementation specification.
Lazuli is not production-ready. Data migration, report/PDF worker execution, and all frontend
implementation remain unfinished. Portal submission is required in the final MVP phase as a daily
automated attendance job that displays errors or required information; it is not implemented yet.
Credentials, 2FA, name matching, retries, and exact failure handling remain future work-item
details. Non-authentication operational messaging is deferred pending management review; Better
Auth magic-link delivery is not part of that deferral.

Use the assigned work item for current scope, completion checks, dependencies, and tests.

## Repository map

- `apps/` — web and worker applications.
- `packages/` — API, auth, database, domain, job contracts, integrations, worker handlers, UI, and validators.
- `infra/` — infrastructure placeholders and local support.
- [`docs/decisions/`](docs/decisions/README.md) — accepted durable engineering constraints.
- [`docs/legacy/`](docs/legacy/README.md) — frozen historical material; not current guidance.

## Setup

Prerequisites: Node.js `^22.12.0 || >=24.0.0 <25 || ^26.0.0`, pnpm `11.6.0`, and
Docker Compose for local services.

1. Copy `.env.example` to `.env` and supply the required local values.
2. Start local services with `docker compose up -d`.
3. Install dependencies with `pnpm install`.
4. Start the web app with `pnpm dev`, Storybook with `pnpm storybook`, or the worker with
   `pnpm dev:worker`.

Common commands: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:integration`,
`pnpm test:transport`, `pnpm build`, and `pnpm format:check`.

For coding-agent constraints, verification expectations, and documentation routing, read
[`AGENTS.md`](AGENTS.md). Folder-specific operational notes remain in
[`infra/pulumi/README.md`](infra/pulumi/README.md) and
[`packages/db/prisma/migrations/README.md`](packages/db/prisma/migrations/README.md).

## Frontend foundation

Start with the current [frontend guide](docs/frontend/README.md), including the hard 200-line limit
for component implementation files.

`@lazuli/ui` owns the shadcn registry primitives, shared utilities, and theme tokens. Its
`styles.css` export contains only shared theme and base CSS; each host must import it from a
host-owned Tailwind entrypoint. The web `components.json` is for product compositions and hooks
local to `apps/web`, while shared primitives remain in `packages/ui`.

Web development and builds use Webpack because workspace packages use `.js` specifiers that
resolve to TypeScript source. The current setup is intentionally not compatible with Turbopack.
