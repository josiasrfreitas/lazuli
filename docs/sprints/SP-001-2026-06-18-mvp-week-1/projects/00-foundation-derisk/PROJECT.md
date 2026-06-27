# [P00] Foundation & de-risk

**Increment:** Sprint 0
**Status:** `ready-for-agent`
**Depends on:** —
**Blocks:** every other project

## Goal

Stand up the T3 Turbo monorepo, local dev, DB plumbing, quality gates, and CI; and run the three
de-risking spikes (Legacy, Portal, course seed) whose outcomes gate downstream projects. Nothing here
ships product behavior — it makes the rest buildable and resolves Sprint-0 unknowns.

## Spec anchors

- Technical Spec: §1.1 (Sprint 0 row), §1.3, §2.1, §2.2, §3.3, §3.4, §4.0, §10.2
- Decisions: D-0001, D-0002, D-0003, D-0004, D-0006, D-0007, D-0027

## Issues

### Scaffold T3 Turbo monorepo to target package shape

- **Status:** `done`
- **Depends on:** —
- **Trace:** §2.1, D-0001/D-0002
- **Goal:** Scaffold from T3 Turbo; create `apps/web`, `apps/worker`, and `packages/{api,auth,db,domain,job-contracts,integrations,worker-handlers,ui,validators}`, `tooling/`, `scripts/`, `infra/`. Remove generated mobile/example apps.
- **Acceptance:**
  - [x] Package graph matches §2.1; `apps/web` cannot import Prisma or worker handlers (enforced in [P00-04]).
  - [x] Any deliberate deviation from upstream scaffold documented in `decisions.md`.
  - [x] `pnpm dev` boots web; `pnpm dev:worker` boots the single worker.
- **Notes:** keep job contracts separate from worker handlers so web never pulls Playwright/PDF/GCS/email deps.

### Local dev environment (Docker Compose) + `.env.example`

- **Status:** `done`
- **Depends on:** P00-01
- **Trace:** §2.2, D-0006
- **Goal:** `docker compose up` brings Postgres 16, Mailpit, Hatchet Lite on stable ports (PG `5432`, Mailpit UI `8025`/SMTP `1025`, Hatchet Lite project-standard port).
- **Acceptance:**
  - [x] `.env.example` has `DATABASE_URL`, `BETTER_AUTH_SECRET`, Google OAuth, Resend/Mailpit, Hatchet, GCS, and Portal secret placeholders. No Sentry DSN.
  - [x] Ports match §2.2 exactly.

### Prisma + `packages/db`: UUIDEntity base, migrate/seed plumbing

- **Status:** `done`
- **Depends on:** P00-02
- **Trace:** §4.0, §3.3, §2.2
- **Goal:** Prisma wired to PG16; `UUIDEntity` base; raw-SQL constraint migration channel; `pnpm prisma:migrate`, `pnpm prisma:seed`, `pnpm db:reset`.
- **Acceptance:**
  - [x] Prisma owns ordinary schema; raw SQL migrations reserved for CHECK / partial-unique / exclusion constraints only (§3.3 v0.3).
  - [x] `pnpm db:reset` drops, recreates, migrates, seeds.

### Code-quality guardrails (ESLint / TS strict / boundaries)

- **Status:** `done`
- **Depends on:** P00-01
- **Trace:** §3.4
- **Goal:** Shared `tooling/eslint`, `tooling/prettier`, `tooling/tsconfig`; strictness, complexity/size, magic-value, duplication, and dependency-boundary rules from §3.4. Prevent agents from bypassing guardrails.
- **Acceptance:**
  - [x] `apps/web` → Prisma/worker-handlers import is a lint error.
  - [x] `packages/job-contracts` → worker-handlers import is a lint error.
  - [x] tsconfig strict flags + type-aware ESLint enabled per §3.4.

### Quality-gate scripts

- **Status:** `done`
- **Depends on:** P00-03, P00-04
- **Trace:** §10.2
- **Goal:** Expose `pnpm lint`, `typecheck`, `test`, `test:db`, `test:e2e`, `prisma:migrate`, `prisma:seed`, `dev`, `dev:worker`, plus `format:check` and `build`.
- **Acceptance:**
  - [x] Each command runs locally and exits non-zero on failure.
  - [x] `test:db` runs against a real Postgres 16 (`@lazuli/db` connects via the Prisma client and asserts `server_version_num` major == 16).

### CI pipeline (minimum triggers)

- **Status:** `done`
- **Depends on:** P00-05
- **Trace:** §10.2, [../../ci.md](../../ci.md), D-0006/D-0027
- **Goal:** CI runs format, lint, typecheck, unit tests, DB integration tests (PG16 service), prisma migrate/drift check, and build on PR/push to main. E2E nightly + manual only.
- **Acceptance:**
  - [x] Matrix matches [ci.md](../../ci.md); all listed PR gates block merge (`.github/workflows/ci.yml`: `quality` + `database` jobs on `pull_request`/`push` to main).
  - [x] Postgres 16 service container present for `test:db` + migrate check (`postgres:16-alpine` service in the `database` job).
  - [x] No deploy step (host decision open), no Sentry, no coverage gate.
- **Notes:** E2E split into `.github/workflows/e2e.yml` (nightly cron + `workflow_dispatch`), never a PR gate. Prisma 7 drift check uses `prisma migrate diff --from-config-datasource --to-schema … --exit-code` (root `pnpm prisma:drift`); `--from-url` was removed in Prisma 7. Shared `.github/actions/setup` composite keeps jobs DRY (pnpm + Node + frozen install + Turbo cache).

### Spike: Legacy sample parser

- **Status:** `done`
- **Depends on:** P00-03
- **Trace:** §1.1, §1.3, §9.2, S-STU-1
- **Goal:** Parse a real Legacy student export sample; document schema/encoding; prove a one-shot mapping into the Student/Guardian/Address shape. **No** Legacy-specific models or import tables.
- **Acceptance:**
  - [x] Encoding + column map documented; verbatim name preservation confirmed.
  - [x] Findings recorded; if no sample yet, blocker raised — do not invent a schema.
- **Findings:** [docs/discovery/DKSOFT/legacy-export-analysis.md](../../../../discovery/DKSOFT/legacy-export-analysis.md) — 6 sheets analysed (people, contracts, 3 AR ledgers incl. tuition), CPF join key, `Order.kind` decision raised for P07, `RA` decode deferred to P00-09. Attendance/progression history and inactive-people detail intentionally dropped for MVP.
- **Open items:** none.

### Spike: Portal credential / API / Playwright feasibility (the gate)

- **Status:** `needs-info` (needs master/coordination credential)
- **Depends on:** P00-02
- **Trace:** §1.2(5), §1.3, §9.1, S-Portal-1
- **Goal:** Validate Portal login, all-class visibility, submit payload, correction/resubmission semantics, PPT endpoint. Produce the **exit decision**: Portal mode = automated | assisted | not-viable for MVP.
- **Acceptance:**
  - [ ] Authoritative model stays Playwright + name-based (D-0023) unless a PRD/decision update is made; JSON API / `cdAluno` remain spike evidence only.
  - [ ] Exit decision recorded in `decisions.md`; **P06 stays blocked until this lands**.
- **Open items:** real credential, submit payload validation, resubmission semantics (§1.3).

### Spike: course/stage seed + Portal naming validation

- **Status:** `needs-info`
- **Depends on:** P00-03
- **Trace:** §1.1, S-CAT-1, D-0030
- **Goal:** Validate production Track→Stage codes, stage `sequence` ordering, and REGULAR-class `portalClassName` generation rules.
- **Acceptance:**
  - [ ] Seed values confirmed against discovery ([course-stage-ordering](../../../../discovery/course-stage-ordering.md)).
  - [ ] Portal naming rule documented for generated vs manual/imported classes (§1.2(6)).

### Seed skeleton

- **Status:** `ready-for-agent`
- **Depends on:** P00-03
- **Trace:** §2.2
- **Goal:** `scripts/seed.ts` produces at least: 1 admin, 2 teachers, tracks/stages, active + archived classes, generated sessions, enrolled students, sample attendance, 1 payer with orders/installments/payments, and one failed/untaken Portal scenario.
- **Acceptance:**
  - [ ] `pnpm db:reset` yields a demoable dataset covering every MVP module's happy + one edge path.

## Definition of done (project)

- [ ] Repo boots, gates green in CI, seed produces a working local app.
- [ ] All three spikes have written outcomes; gating decisions (Portal mode, Legacy schema, seed codes) recorded in `decisions.md`.
- [ ] Downstream projects can start without re-deriving scaffold or unknowns.
