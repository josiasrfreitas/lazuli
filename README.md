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

Prerequisites: Node.js `^22.13.0 || >=24.0.0 <25 || ^26.0.0`, pnpm `11.6.0`, and
Docker Compose for local services.

1. Copy `.env.example` to `.env` and supply the required local values.
2. Run `pnpm workspace:setup light`, then promote with `pnpm workspace:setup full` for Web or Worker.
3. Start the web app with `pnpm dev`, Storybook with `pnpm storybook`, or the worker with
   `pnpm dev:worker`. Web is available at the hostname shown by `pnpm workspace:status`.

Common commands: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:integration`,
`pnpm test:transport`, `pnpm build`, and `pnpm format:check`.

### Worktrees

New linked worktrees run `pnpm workspace:setup light` from the checkout hook. The light profile
installs dependencies when `node_modules` is absent or its pnpm lock snapshot is stale, records
stable local intent in `.lazuli/workspace.json`, and updates
the worktree-derived `.env` values. It does not require or start Docker, provision a database or
bucket, run migrations, or load fixtures.

Run `pnpm workspace:status` to inspect the persisted identity, URLs, ports, intended resources,
the Web and Storybook proxy leases, and any observable health of the optional shared Docker stack. Database
and bucket entries are intent only in the light profile.

Promote an existing light worktree with `pnpm workspace:setup full`. Promotion keeps its identity,
ports, secrets, database name, and bucket name. It reconciles the shared Docker Compose stack once,
waits for every declared service, creates only missing worktree resources, always applies deployed
migrations, and loads database fixtures only for a database created by this setup flow. GCS seed
objects are uploaded only when absent, so locally edited objects are preserved. Caddy remains owned
by the Storybook command and is not part of full setup.

The full command is serialized per worktree and safe to repeat. If it stops after database creation
or during seed, `.lazuli/database-initialization.json` remains pending and the next
`pnpm workspace:setup full` resumes initialization. An already existing database with no pending
journal is treated as user data: migrations run, but fixtures are not reloaded. Workspace metadata
records the requested profile; `pnpm workspace:status` separately observes the current database,
bucket, initialization journal, and Compose service health without starting anything.

When promotion fails, inspect the shared stack with `docker compose ps` and the affected service
with `docker compose logs <service>`, then retry `pnpm workspace:setup full`. The command does not
reset a database or replace existing GCS objects.

Run `pnpm storybook` from a light worktree to serve it at the worktree's Storybook URL. `pnpm dev`
does the same for Web after reconciling the full profile. These commands start a shared Caddy
instance bound only to `127.0.0.1:80` when needed, then lease each hostname only
for the lifetime of the Storybook command. Install Caddy first with `brew install caddy`. Caddy does
not require Docker or any Lazuli data service. If its HTTP or admin port is occupied, the hostname
does not resolve to loopback, or an unrelated Caddy instance uses the selected admin port, the command
stops with a corrective diagnostic.

For local sign-in, leave both Google OAuth values empty, request a magic link for
`dev@lazuli.local`, and open the captured message at `http://localhost:8025`. The link returns to
the current worktree hostname, and its session cookie is scoped to that hostname. Configure both
Google values together to enable the Google button; a partial pair is rejected.

`pnpm bootstrap:worktree` remains a temporary bridge for worktrees created before this flow. It
refuses a checkout with `.lazuli/workspace.json` so legacy and light ownership cannot mix.

### Resetting development data

Run `pnpm db:reset` from the repository root to discard the configured local database,
reapply migrations, and seed fresh development fixtures. This deletes manual changes in that
database; it does not reset shared Mailpit or Hatchet services.

`pnpm prisma:seed` supports loading fresh fixtures or repeating an unchanged fixture load in
the same semester. After editing or deleting development finance records, changing fixture
definitions, or moving to another semester, use `pnpm db:reset`. The finance seed does not
reconcile edited orders, recover deleted schedules, or preserve payment history across a reset.
Product lifecycle and financial-history rules still apply to the application itself.

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
