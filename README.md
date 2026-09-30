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

Orca uses the committed `orca.yaml`. Configure this repository once in Orca with setup policy
**Ask every time**, command source **orca.yaml only**, and agent startup **wait for setup**. Choosing
**Skip setup** retains the light setup already performed by the Git hook; choosing **Run setup**
promotes it to full. From the CLI, use `--setup skip` for light or `--setup run` for full.

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

Archive through Orca to run `pnpm workspace:teardown`; with the CLI, pass `--run-hooks` to
`worktree rm`. Teardown never stops the shared Compose stack. It stops only supported development
processes (`dev`, `dev:worker`, and `storybook`) whose token, technical path, PID, and process start
still match, then removes only database and bucket resources carrying this worktree's ownership
markers. Light worktrees do not access Docker.

Before removing anything, teardown writes a resumable journal under
`$(git rev-parse --git-common-dir)/lazuli-workspace-orphans/`. Isolated failures do not prevent Orca
from archiving: the journal lists pending resources and `pnpm workspace:teardown` can be run again
while the checkout remains available. If the checkout was already removed, run
`pnpm workspace:gc` from another Lazuli worktree to inspect those journals. It is read-only and
prints candidates, preserved resources, and the reason they cannot be observed safely. Run
`pnpm workspace:gc --prune` to collect only an orphan whose absent/unregistered worktree path,
persisted identity, exact derived names, local Compose labels, and database/bucket/lease ownership
markers all agree. It updates the journal after each observed result, so it is safe to repeat after
a partial cleanup.

`workspace:gc --prune` exits non-zero if any candidate remains ambiguous or fails to be removed.
Do not delete those journals to silence the result: restore or inspect the owner path, compare the
recorded token, identity, and technical path with the external marker, then remove the resource
manually only after establishing ownership. Prefix-only, legacy, externally created, non-local, or
otherwise unobservable resources are deliberately preserved.

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

### Rebuilding development data

Run `pnpm seed` in a full worktree to erase its database and fake-GCS bucket, apply migrations,
and load the complete development dataset. This includes staff, students, classes, attendance,
finance settings, standalone orders, contracts, payments, and versioned GCS fixture files.
Every order has one active beneficiary; every contract has one student. Students can share a payer.
Manual edits, extra records, and extra bucket objects are removed on every run.

The former `prisma:seed`, `seed:settings`, `seed:contracts`, `seed:gcs`, and
`workspace:fixtures refresh` commands now delegate to the same complete reset.
`workspace:reset` also rebuilds the same dataset, retaining its interactive confirmation and
`--yes` option. Resource ownership is checked before removal. Shared Compose services,
Mailpit, Hatchet, and other worktrees are preserved. Repeat `pnpm seed` after a failed run.

Finance settings include a R$ 250 tuition ceiling, 20% maximum discount, 10% punctuality discount,
0.1% daily interest, 2% monthly interest, 10% cancellation fee, and R$ 120 material price.
The system administrator remains the distinct `sistema@lazuli.local` account.

See [decision 0024](docs/decisions/0024-rebuild-development-data-through-one-seed.md).

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

### Issue implementation command

Run `scripts/ship-it.sh 126` from any checkout in this repository. It requires an
installed Orca runtime, `codex`, `gh`, Python 3, and a clean local `main` checkout.
The command fast-forwards `main` to `origin/main`, creates an Orca worktree linked
to the issue, then opens one interactive Codex terminal in Orca. Codex receives
one prompt to plan, implement, open a PR with evidence, and babysit CI and review
feedback. The command returns after Orca accepts the prompt; follow progress in
that terminal. It never merges the PR. Override the default GPT-6 Sol low setting
with `--model gpt-6-astra --effort high`. The Codex session runs
with approvals and sandboxing disabled (YOLO mode).
