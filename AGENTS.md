# Lazuli — Custom Management System

Custom student/finance/attendance management for a single English-language school in Brazil (~300 students). Replaces the most painful Legacy workflows — especially daily attendance submission to the Portal.

## Documentation index

Read these before assuming product scope, architecture, or tech stack.

| Doc                    | Path                                                                    | Purpose                                                       |
| ---------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------- |
| **Docs index**         | [`docs/README.md`](docs/README.md)                                      | Reading order, TLDR, scope snapshot, open questions           |
| **PRD & user stories** | [`docs/MVP/PRD.md`](docs/MVP/PRD.md)                                    | Product scope, user stories, acceptance criteria              |
| **Decisions**          | [`docs/MVP/decisions.md`](docs/MVP/decisions.md)                        | Architecture, stack, workflow, and discovery-driven decisions |
| **Discovery**          | [`docs/discovery/README.md`](docs/discovery/README.md)                  | Questionnaire data, query tool, discovery artifacts           |
| **Issue tracker**      | Linear + [`docs/agents/issue-tracker.md`](docs/agents/issue-tracker.md) | Projects, issues, dependencies (not duplicated in repo)       |

**Doc hierarchy:** PRD = product behavior · decisions = constraints and rationale · discovery = evidence. If docs disagree, update PRD and decisions together before building.

## Repository structure

T3 Turbo–style monorepo (pnpm workspaces + Turborepo). The package graph is the target shape from [`TECHNICAL_SPEC.md §2.1`](docs/MVP/TECHNICAL_SPEC.md#21-monorepo-layout); boundaries are enforced, not advisory.

```text
apps/
  web/                 Next.js App Router + tRPC client/server + Better Auth routes (never imports Prisma)
  worker/              Single Hatchet worker (reports, email, sessions, best-effort Portal); Playwright-capable
packages/
  api/                 tRPC routers, procedures, RBAC, service orchestration (the BFF boundary)
  auth/                Better Auth config, session helpers, role/session typing
  db/                  Prisma schema, migrations, seeds, raw-SQL constraint migrations, UUIDEntity base
  domain/              Pure domain calculators and invariants (no Prisma, no I/O)
  job-contracts/       Hatchet workflow names + payload schemas + enqueue helpers (never imports worker handlers)
  integrations/        External adapter interfaces + light shared clients
  worker-handlers/     Worker-only handlers: Portal/Playwright, PDFs, GCS, Resend (never imported by web/api)
  ui/                  Shared UI components; Portuguese-BR labels live near UI
  validators/          Zod schemas shared by api, workers, scripts
tooling/
  eslint/  prettier/  tsconfig/   Shared config packages (@lazuli/eslint-config, @lazuli/prettier-config, @lazuli/tsconfig)
infra/
  pulumi/              Pulumi (TypeScript) GCP stacks (placeholder until host/Cloud SQL decision closes)
```

- Internal packages are published as TypeScript source ("just-in-time" packages); Next transpiles them via `transpilePackages`.
- Shared dep versions live in the pnpm **catalog** (`pnpm-workspace.yaml`); reference them with `catalog:`.
- Key boundaries: `apps/web` must not import Prisma or `worker-handlers`; `job-contracts` must not import `worker-handlers`; `domain` imports no `ui`/`api`/`db`. Full guardrails (§3.4) are wired in issue P00-04.
- Root scripts (run from repo root): `pnpm dev` (web), `pnpm dev:worker`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm format:check`. DB/CI scripts land with P00-02/03/05/06.

> **Scaffold status:** Sprint-0 foundation (P00-01) lays down the package graph and bootable web/worker. Docker Compose, Prisma wiring, full ESLint guardrails, quality-gate scripts, CI, and the seed all arrive in the remaining `00-foundation-derisk` issues.

## Working guidelines

- **Stack is documented** — do not assume or introduce technologies that conflict with `docs/MVP/decisions.md` (e.g. NextAuth, Supabase, Cloud Scheduler, SendGrid).
- **Monolith + BFF** — business logic lives in tRPC procedures and shared packages; heavy work (Playwright, PDFs, reports, invoices) goes through Hatchet workers, not inline requests.
- **Single school** — not multi-tenant in MVP. Legacy runs in parallel during the pilot.
- **Portuguese-BR UI**, timezone `America/Sao_Paulo`, mobile-friendly attendance for teachers.
- **Local dev is first-class** — Docker Compose (Postgres, Mailpit, Hatchet Lite) + seed data; see `docs/MVP/decisions.md`.
- **LGPD awareness** — student PII stays in Cloud SQL; minimal data in Hatchet payloads; no PII in worker logs.
- **Scope discipline** — week-1 MVP is ruthless; see `docs/MVP/PRD.md` and `docs/MVP/decisions.md` for current deferred items.
- **Backend-first execution** — backend/UI split per domain project; UI GREs are post-phase until GRE-57 (P00). See [D-0036](docs/MVP/decisions.md#d-0036-frontend-surfaces-deferred-design-system-gate).
- **Open items** — web host (Railway leading, not locked), Cloud SQL connectivity, CI/CD — see `docs/README.md` and `docs/MVP/decisions.md`.

## Quick stack reference

| Layer          | Choice                                        |
| -------------- | --------------------------------------------- |
| Monorepo       | T3 Turbo                                      |
| Frontend / API | Next.js App Router + tRPC BFF                 |
| Auth           | Better Auth (Google + magic link)             |
| Database       | Cloud SQL Postgres 16 (local: Docker Compose) |
| Workflows      | Hatchet Cloud                                 |
| Workers        | GCP Cloud Run                                 |
| Artifacts      | GCS                                           |
| IaC            | Pulumi (TypeScript), state in GCS bucket      |
| Email          | Resend (prod) / Mailpit (local)               |
| Observability  | Sentry                                        |
| Web hosting    | Railway (leading candidate)                   |

## Agent skills

### Issue tracker

Work is tracked in **Linear**. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical defaults (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`), applied as labels in Linear. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context. No `CONTEXT.md`/`docs/adr/` — domain sources are `docs/MVP/PRD.md`, `docs/MVP/decisions.md`, and `docs/discovery/`. See `docs/agents/domain.md`.
