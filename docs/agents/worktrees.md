# Git Worktree Orchestration

Parallel branches without port, database, or GCS bucket collisions. Product rationale lives in [D-0006](../MVP/decisions.md#d-0006-local-development); this doc covers the automation.

Shipped in [PR #36](https://github.com/josiasrfreitas/lazuli/pull/36) (bootstrap + isolated Postgres). Per-worktree GCS buckets land in [PR #37](https://github.com/josiasrfreitas/lazuli/pull/37) (open as of writing).

## Why

Agents and humans often work on multiple branches at once. Fixed local ports (5432, 8025, 8888) mean one shared Docker Compose stack per machine, but each worktree still needs its own database (and GCS bucket) so migrations, seeds, and artifact tests do not clobber each other.

## Quick start

```bash
git worktree add ../lazuli-feature-x feature/x
cd ../lazuli-feature-x
```

The lefthook `post-checkout` hook runs `scripts/git-hooks/post-checkout-worktree.sh`, which calls `scripts/bootstrap-worktree.sh` when the previous HEAD was the null ref (new worktree creation).

Bootstrap (unless opted out):

1. Copies or creates `.env`, then patches per-worktree `DATABASE_URL` (and GCS vars after PR #37)
2. Runs `pnpm install`
3. Starts shared Docker engines if needed (`docker compose up -d`)
4. Creates isolated Postgres DB + runs `pnpm prisma:deploy` (or `pnpm db:reset` with `--reset-db`)
5. Creates isolated GCS bucket + seeds fixtures (after PR #37)
6. Runs `pnpm runtime:check`

Skip fixtures for docs-only work:

```bash
LAZULI_BOOTSTRAP_NO_FIXTURES=1 git worktree add <path> <branch>
```

## Isolation model

| Resource                                           | Scope        | Notes                                                     |
| -------------------------------------------------- | ------------ | --------------------------------------------------------- |
| Postgres database                                  | Per worktree | `lazuli_<branch_slug>` on shared `lazuli-postgres`        |
| GCS bucket                                         | Per worktree | `lazuli-<branch_slug>` on shared fake-gcs-server (PR #37) |
| Postgres / Mailpit / Hatchet / fake-gcs containers | Shared       | One Compose stack per machine; fixed ports                |
| `.env` secrets                                     | Per worktree | Copied from another worktree or `.env.example`            |

## Naming

Branch slug rules differ slightly between Postgres and GCS:

| System   | Pattern                | Slug transform                                 |
| -------- | ---------------------- | ---------------------------------------------- |
| Postgres | `lazuli_<branch_slug>` | `/` and `-` → `_`, lowercase, `[a-z0-9_]` only |
| GCS      | `lazuli-<branch_slug>` | `/` and `_` → `-`, lowercase, `[a-z0-9-]` only |

Examples: branch `feature/foo-bar` → DB `lazuli_feature_foo_bar`, bucket `lazuli-feature-foo-bar`.

## Bootstrap flags

Manual re-bootstrap: `pnpm bootstrap:worktree` (same script as the hook).

| Flag / env                       | Effect                                                             |
| -------------------------------- | ------------------------------------------------------------------ |
| `--no-fixtures`                  | `.env` + `pnpm install` only; no Docker, DB, GCS, or runtime check |
| `LAZULI_BOOTSTRAP_NO_FIXTURES=1` | Passed to hook at `git worktree add` time → adds `--no-fixtures`   |
| `--reset-db`                     | `pnpm db:reset` instead of `pnpm prisma:deploy`                    |
| `--skip-docker`                  | Skip `docker compose up -d` (DB steps still run if Postgres is up) |
| `--force`                        | Re-run even when `.worktree-bootstrapped` marker exists            |
| `--source PATH`                  | Copy `.env` from another checkout                                  |

## Commands

```bash
pnpm bootstrap:worktree              # manual bootstrap
pnpm bootstrap:worktree -- --reset-db
pnpm bootstrap:worktree -- --no-fixtures
pnpm seed:gcs                        # re-upload GCS fixtures (PR #37; --force to overwrite)
docker compose up -d                 # start shared engines
docker compose down                  # stop; keep volumes
docker compose down -v               # stop and wipe volumes (destructive)
```

GCS env patched into `.env` (PR #37): `GCS_ARTIFACTS_BUCKET`, `GCS_PROJECT_ID` (`lazuli-local`), `STORAGE_EMULATOR_HOST` (`http://localhost:4443`). Fixtures live under `infra/local/gcs-seed/`.

## Teardown and pitfalls

- **`docker compose down -v` is destructive** — wipes Postgres and fake-gcs volumes for the whole machine, not just one worktree.
- **One Compose stack per machine** — all worktrees share ports 5432, 1025/8025, 8888/7077, 4443 (PR #37). You cannot run two stacks side by side without port conflicts.
- **Raw `git worktree add` may start Docker** when engines are down. Use `LAZULI_BOOTSTRAP_NO_FIXTURES=1` for lint/docs-only branches.
- **Re-bootstrap is idempotent** — marker file `.worktree-bootstrapped` skips repeat runs unless `--force`.

## Testing implications

Each worktree has its own Postgres database (and GCS bucket after PR #37). Integration and behavior tests against `DATABASE_URL` in that checkout's `.env` never touch another branch's data.

Pre-commit runs unit tests only; CI runs `test:db` and `test:behavior` against a fresh Postgres 16 service. See [`docs/agents/testing.md`](testing.md).
