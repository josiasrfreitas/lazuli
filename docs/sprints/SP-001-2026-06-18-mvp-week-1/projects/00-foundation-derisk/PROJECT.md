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

### [P00-01] Scaffold T3 Turbo monorepo to target package shape

- **Status:** `ready-for-agent`
- **Depends on:** —
- **Trace:** §2.1, D-0001/D-0002
- **Goal:** Scaffold from T3 Turbo; create `apps/web`, `apps/worker`, and `packages/{api,auth,db,domain,job-contracts,integrations,worker-handlers,ui,validators}`, `tooling/`, `scripts/`, `infra/`. Remove generated mobile/example apps.
- **Acceptance:**
  - [ ] Package graph matches §2.1; `apps/web` cannot import Prisma or worker handlers (enforced in [P00-04]).
  - [ ] Any deliberate deviation from upstream scaffold documented in `decisions.md`.
  - [ ] `pnpm dev` boots web; `pnpm dev:worker` boots the single worker.
- **Notes:** keep job contracts separate from worker handlers so web never pulls Playwright/PDF/GCS/email deps.

### [P00-02] Local dev environment (Docker Compose) + `.env.example`

- **Status:** `ready-for-agent`
- **Depends on:** P00-01
- **Trace:** §2.2, D-0006
- **Goal:** `docker compose up` brings Postgres 16, Mailpit, Hatchet Lite on stable ports (PG `5432`, Mailpit UI `8025`/SMTP `1025`, Hatchet Lite project-standard port).
- **Acceptance:**
  - [ ] `.env.example` has `DATABASE_URL`, `BETTER_AUTH_SECRET`, Google OAuth, Resend/Mailpit, Hatchet, GCS, and Portal secret placeholders. No Sentry DSN.
  - [ ] Ports match §2.2 exactly.

### [P00-03] Prisma + `packages/db`: UUIDEntity base, migrate/seed plumbing

- **Status:** `ready-for-agent`
- **Depends on:** P00-02
- **Trace:** §4.0, §3.3, §2.2
- **Goal:** Prisma wired to PG16; `UUIDEntity` base; raw-SQL constraint migration channel; `pnpm prisma:migrate`, `pnpm prisma:seed`, `pnpm db:reset`.
- **Acceptance:**
  - [ ] Prisma owns ordinary schema; raw SQL migrations reserved for CHECK / partial-unique / exclusion constraints only (§3.3 v0.3).
  - [ ] `pnpm db:reset` drops, recreates, migrates, seeds.

### [P00-04] Code-quality guardrails (ESLint / TS strict / boundaries)

- **Status:** `ready-for-agent`
- **Depends on:** P00-01
- **Trace:** §3.4
- **Goal:** Shared `tooling/eslint`, `tooling/prettier`, `tooling/tsconfig`; strictness, complexity/size, magic-value, duplication, and dependency-boundary rules from §3.4. Prevent agents from bypassing guardrails.
- **Acceptance:**
  - [ ] `apps/web` → Prisma/worker-handlers import is a lint error.
  - [ ] `packages/job-contracts` → worker-handlers import is a lint error.
  - [ ] tsconfig strict flags + type-aware ESLint enabled per §3.4.

### [P00-05] Quality-gate scripts

- **Status:** `ready-for-agent`
- **Depends on:** P00-03, P00-04
- **Trace:** §10.2
- **Goal:** Expose `pnpm lint`, `typecheck`, `test`, `test:db`, `test:e2e`, `prisma:migrate`, `prisma:seed`, `dev`, `dev:worker`, plus `format:check` and `build`.
- **Acceptance:**
  - [ ] Each command runs locally and exits non-zero on failure.
  - [ ] `test:db` runs against a real Postgres 16.

### [P00-06] CI pipeline (minimum triggers)

- **Status:** `ready-for-agent`
- **Depends on:** P00-05
- **Trace:** §10.2, [../../ci.md](../../ci.md), D-0006/D-0027
- **Goal:** CI runs format, lint, typecheck, unit tests, DB integration tests (PG16 service), prisma migrate/drift check, and build on PR/push to main. E2E nightly + manual only.
- **Acceptance:**
  - [ ] Matrix matches [ci.md](../../ci.md); all listed PR gates block merge.
  - [ ] Postgres 16 service container present for `test:db` + migrate check.
  - [ ] No deploy step (host decision open), no Sentry, no coverage gate.

### [P00-07] Spike: Legacy sample parser

- **Status:** `needs-info` (needs a real Legacy export)
- **Depends on:** P00-03
- **Trace:** §1.1, §1.3, §9.2, S-STU-1
- **Goal:** Parse a real Legacy student export sample; document schema/encoding; prove a one-shot mapping into the Student/Guardian/Address shape. **No** Legacy-specific models or import tables.
- **Acceptance:**
  - [ ] Encoding + column map documented; verbatim name preservation confirmed.
  - [ ] Findings recorded; if no sample yet, blocker raised — do not invent a schema.
- **Open items:** Legacy export schema/encoding/sample (§1.3).

### [P00-08] Spike: Portal credential / API / Playwright feasibility (the gate)

- **Status:** `needs-info` (needs master/coordination credential)
- **Depends on:** P00-02
- **Trace:** §1.2(5), §1.3, §9.1, S-Portal-1
- **Goal:** Validate Portal login, all-class visibility, submit payload, correction/resubmission semantics, PPT endpoint. Produce the **exit decision**: Portal mode = automated | assisted | not-viable for MVP.
- **Acceptance:**
  - [ ] Authoritative model stays Playwright + name-based (D-0023) unless a PRD/decision update is made; JSON API / `cdAluno` remain spike evidence only.
  - [ ] Exit decision recorded in `decisions.md`; **P06 stays blocked until this lands**.
- **Open items:** real credential, submit payload validation, resubmission semantics (§1.3).

### [P00-09] Spike: course/stage seed + Portal naming validation

- **Status:** `needs-info`
- **Depends on:** P00-03
- **Trace:** §1.1, S-CAT-1, D-0030
- **Goal:** Validate production Track→Stage codes, stage `sequence` ordering, and REGULAR-class `portalClassName` generation rules.
- **Acceptance:**
  - [ ] Seed values confirmed against discovery ([course-stage-ordering](../../../../discovery/course-stage-ordering.md)).
  - [ ] Portal naming rule documented for generated vs manual/imported classes (§1.2(6)).

### [P00-10] Seed skeleton

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
