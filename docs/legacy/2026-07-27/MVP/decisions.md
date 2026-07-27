# Decisions

**Status:** living decision register  
**Last updated:** 2026-07-04  
**Product source:** [PRD and user stories](./PRD.md)

This file replaces the old architecture decision files. Use it as the first stop for architecture, product constraints, and discovery-driven decisions. If a decision changes, update this file and the affected PRD story in the same change.

## TLDR

- Build a single-school management system for one school network, not a multi-tenant SaaS.
- Ship a monolithic T3 Turbo app: Next.js App Router, tRPC BFF, TypeScript, Prisma.
- Use Better Auth with Google OAuth first and magic link fallback. Staff must be pre-provisioned.
- Store production data in Cloud SQL Postgres 16. Use Docker Compose Postgres 16 locally.
- Run heavy work through Hatchet workflows and GCP Cloud Run workers, never inline in tRPC requests.
- The wedge is attendance capture plus automated Portal submission.
- Course catalog is modeled as **ProductLine → Track → Stage**. Tracks are **independent** (no `Track.sequence`, no cross-track equivalence model). Product-line labels are seeded rows, not hardcoded enum values. Only **`Stage.sequence`** orders levels within a track. Catalog is seed-only in MVP. Stage placement lives on **`PedagogicalProgress`** (active = `endDate` null), separate from operational **`Enrollment`**.
- All domain tables share a **UUIDEntity** base (`uuid` PK, `created_at`, `updated_at`, `deleted_at`) — see [D-0034](#d-0034-uuidentity-base-for-all-domain-tables).
- **Student field-level rastreabilidade deferred** — no per-field edit/status attribution on `Student` in MVP; [S-STU-5](./PRD.md#s-stu-5--student-status-lifecycle-deferred) deferred — see [D-0035](#d-0035-defer-student-field-level-traceability).
- Attendance MVP tracks `PRESENT` and `ABSENT` only. `LATE` is out. **Makeup (reposição) is a separate operational workflow (`Makeup` entity), not an attendance status, and does NOT affect the 75% attendance %.**
- Finance MVP = receivables & revenue tracking only, built on **Order** (Payer · Order · OrderBeneficiary · Installment · InstallmentAdjustment · PaymentEntry · PaymentAllocation): manually-recorded payments reconciled against Cora. `Order.principalAmount` is the agreed principal; all statuses/balances are **derived** (not stored); payments are **payer-scoped** and may span orders. Integer cents, BRL-only. It does not issue boletos, run a checkout, process payments, or track expenses (all Phase 2). See [D-0028](#d-0028-finance-core-model--order)/[D-0032](#d-0032-finance-ledger--derive-dont-store-adjustments-payer-scoped-payments).
- MVP enables only two roles, `ADMIN` and `TEACHER`. `SECRETARY`/`FINANCE` return with expenses and bank integration.
- Deferred to Phase 2: leads/CRM, expenses, WhatsApp/Evolution, charge issuance/checkout, pedagogical progress & assessments, and assisted class generation.
- **UI issues stay in domain projects (P01–P08), post-phase until GRE-57 design-system triage closes** — see [D-0036](#d-0036-frontend-surfaces-deferred-design-system-gate).
- Portuguese-BR UI, `America/Sao_Paulo` product timezone, LGPD-aware handling of student PII.

## Current Stack

| Concern          | Decision                                                                                                        |
| ---------------- | --------------------------------------------------------------------------------------------------------------- |
| Product shape    | Single-school internal system                                                                                   |
| App architecture | Monolith first, module boundaries in code                                                                       |
| Monorepo         | T3 Turbo                                                                                                        |
| Frontend         | Next.js App Router                                                                                              |
| API              | tRPC BFF                                                                                                        |
| Language         | TypeScript                                                                                                      |
| ORM              | Prisma                                                                                                          |
| Auth             | Better Auth: Google OAuth + magic link                                                                          |
| Production DB    | Cloud SQL Postgres 16                                                                                           |
| Local DB         | Docker Compose Postgres 16                                                                                      |
| Workflows        | Hatchet Cloud                                                                                                   |
| Workers          | GCP Cloud Run                                                                                                   |
| Artifacts        | GCS                                                                                                             |
| IaC              | Pulumi TypeScript, state in GCS                                                                                 |
| Email            | Resend in production, Mailpit locally                                                                           |
| Observability    | Sentry                                                                                                          |
| Web hosting      | Open; Railway leading, Vercel alternative                                                                       |
| WhatsApp         | Evolution API, self-hosted on GCP — **Phase 2** ([D-0018](#d-0018-notifications-mvp--transactional-email-only)) |
| UI language      | Portuguese-BR                                                                                                   |
| Product timezone | `America/Sao_Paulo`                                                                                             |

## System Shape

```text
Web app (Railway leading; Vercel alternative)
  T3 Turbo · Next.js App Router · tRPC BFF · Better Auth
        | Prisma / tRPC
        v
Cloud SQL Postgres
        ^
        | status/artifact rows
        |
Hatchet Cloud -> GCP Cloud Run workers -> GCS / Portal / Sentry / Resend
```

Local development uses Docker Compose for Postgres, Mailpit, and Hatchet Lite, plus `pnpm dev` for the app and `pnpm dev:worker` for workers.

## Decision Register

| ID     | Decision                                                                                                   | Status                   |
| ------ | ---------------------------------------------------------------------------------------------------------- | ------------------------ |
| D-0001 | Start with a monolithic architecture                                                                       | Accepted                 |
| D-0002 | Use T3 Turbo with a tRPC BFF                                                                               | Accepted                 |
| D-0003 | Use GCP for data, workers, storage, secrets, and Pulumi-managed infra                                      | Accepted                 |
| D-0004 | Use Hatchet Cloud plus GCP workers for background jobs                                                     | Accepted                 |
| D-0005 | Use Better Auth with Google OAuth and magic link                                                           | Accepted                 |
| D-0006 | Use Docker Compose plus seeded data for local development                                                  | Accepted                 |
| D-0007 | Use Sentry and Resend; Mailpit locally                                                                     | Accepted                 |
| D-0008 | Model rolling enrollment and variable contract periods                                                     | Accepted                 |
| D-0009 | Reflect current attendance reality; defer `LATE`                                                           | Accepted                 |
| D-0010 | Makeup scheduling belongs to coordenação/admin, with secretary backup                                      | Accepted                 |
| D-0011 | Commercial installment schedule, decoupled from academic periods                                           | Accepted                 |
| D-0012 | Confirm 1% monthly interest; keep multa opt-in until rate is validated                                     | Accepted                 |
| D-0013 | Substitute teachers have no formal pool; use free-text fallback when built                                 | Accepted, Phase 2 design |
| D-0014 | Coexist with Cora; do not duplicate Cora dunning emails                                                    | Accepted                 |
| D-0015 | Defer substitute-teacher assignment from MVP                                                               | Accepted                 |
| D-0016 | Reduce MVP role set to `ADMIN` + `TEACHER`                                                                 | Accepted                 |
| D-0017 | Finance MVP is receivables & revenue tracking only                                                         | Accepted                 |
| D-0018 | Notifications MVP is transactional email only                                                              | Accepted                 |
| D-0019 | Defer leads/CRM from MVP                                                                                   | Accepted                 |
| D-0020 | Defer expenses from MVP                                                                                    | Accepted                 |
| D-0021 | Model class modality as two axes (scheduleType + format)                                                   | Accepted                 |
| D-0022 | Class/enrollment "bones now, brain later"                                                                  | Accepted                 |
| D-0023 | Portal access via shared master login; match students by name                                              | Accepted                 |
| D-0024 | Student status set `ACTIVE\|INACTIVE\|DROPPED\|SUSPENDED`                                                  | Accepted                 |
| D-0025 | Model payer as a first-class entity                                                                        | Accepted                 |
| D-0026 | Legacy import is a short-lived dev script with no import models                                            | Accepted                 |
| D-0027 | Sequencing: Sprint 0 → wedge → receivables → comms                                                         | Accepted                 |
| D-0028 | Finance core model: Order · Payer · Beneficiary · Installment · PaymentEntry                               | Accepted                 |
| D-0029 | Attendance: neutral data state, untaken-session flag, explicit % formula                                   | Accepted                 |
| D-0030 | Course catalog: ProductLine → Track → Stage; stage-only `sequence`; independent tracks                     | Accepted                 |
| D-0031 | Enrollment is operational; stage placement lives on PedagogicalProgress (amends D-0022)                    | Accepted                 |
| D-0032 | Finance ledger: derive-don't-store statuses, InstallmentAdjustment, payer-scoped payments (refines D-0028) | Accepted                 |
| D-0033 | Structured Guardian and Address entities                                                                   | Accepted                 |
| D-0034 | UUIDEntity base for all domain tables                                                                      | Accepted                 |
| D-0035 | Defer student field-level traceability                                                                     | Accepted                 |
| D-0036 | UI deferred post-phase in domain projects; backend/UI split; gated on GRE-57 design-system triage (P00)    | Accepted                 |

## D-0001: Monolith First

Build and deploy one primary Next.js application for the MVP. UI, business logic, and data access live in one codebase with one shared Postgres database.

Background workers are separate processes only where runtime requires it, such as Playwright Portal submission or PDF/CSV generation. They stay in the same repository and share the same data model.

Services can be extracted later when student/parent portals, AI workflows, third-party integrations, or different scaling/security needs justify the cost.

## D-0002: T3 Turbo and tRPC BFF

Use T3 Turbo as the monorepo scaffold with `apps/web` and shared packages such as API, DB, and auth. Client/server communication goes through tRPC routers.

Business logic, RBAC, and data access live in tRPC procedures and shared packages. Do not add a separate REST or GraphQL backend for the MVP.

This gives end-to-end typing and fast delivery now, while keeping procedure/module boundaries that can be extracted later.

## D-0003: GCP and Pulumi

Use GCP for production data, worker compute, generated artifacts, secrets, container images, and Pulumi state.

Expected services:

| Concern         | GCP service             |
| --------------- | ----------------------- |
| Database        | Cloud SQL Postgres      |
| Workers         | Cloud Run jobs/services |
| Generated files | Cloud Storage           |
| Secrets         | Secret Manager          |
| Images          | Artifact Registry       |
| IaC state       | GCS bucket              |

Pulumi is the IaC tool because TypeScript matches the application stack. Web hosting remains open; Railway is the current leading candidate.

Open infrastructure items: web host, Cloud SQL connectivity from the host, CI/CD, staging strategy, GCS retention, and PDF generation library.

## D-0004: Hatchet for Background Work

Use Hatchet Cloud as the workflow control plane. Run worker code on GCP Cloud Run.

MVP workflows:

| Workflow            | Trigger                                          | Notes                                           |
| ------------------- | ------------------------------------------------ | ----------------------------------------------- |
| `sessions-generate` | Semester creation and explicit regenerate (tRPC) | Idempotent `ClassSession` row creation; no cron |
| `portal-submit`     | Hatchet cron and manual tRPC enqueue             | Playwright submission to Portal                 |
| `report-generate`   | On demand                                        | CSV/PDF reports to GCS                          |
| `invoice-generate`  | On demand or batch                               | PDF invoices/statements to GCS                  |
| `notification-send` | Event/rule-driven if WhatsApp ships              | Evolution API / Resend                          |

tRPC mutations enqueue workflows and return quickly with a job ID. Workers update DB rows and artifacts, and the UI polls for status/download URLs.

## D-0005: Better Auth

Use Better Auth with Google OAuth as the primary sign-in method and magic link as fallback. Apple Sign In is deferred.

Authentication proves identity only. Authorization requires a pre-provisioned `User` row with role `ADMIN`, `SECRETARY`, `TEACHER`, or `FINANCE`. Unknown emails are rejected or held for approval. RBAC is enforced in tRPC middleware.

The role enum is defined with all four values, but **MVP enables only `ADMIN` and `TEACHER`** (see [D-0016](#d-0016-mvp-role-set--admin--teacher)). `SECRETARY`/`FINANCE` are added back as middleware + enabled values when expenses/bank integration land — no data migration required.

## D-0006: Local Development

Local development is first-class. Use Docker Compose for:

- Postgres 16
- Mailpit
- Hatchet Lite
- fake-gcs-server (GCS emulator on port 4443)

Seed data should include staff users for enabled MVP roles (`ADMIN`, `TEACHER`), realistic students/classes/enrollments, class sessions, attendance, and financial records. Optional Phase 2 seed examples (leads, expenses) may be added when those modules ship.

**Git worktrees.** Use `git worktree add` — a `post-checkout` hook (lefthook) bootstraps each new linked worktree: copies `.env`, runs `pnpm install`, and points `DATABASE_URL` at an isolated `lazuli_<branch_slug>` database on the shared Compose Postgres instance and `GCS_ARTIFACTS_BUCKET` at an isolated `lazuli-<branch_slug>` bucket on the shared fake-gcs-server. Mailpit and Hatchet stay shared (one stack per machine; bootstrap checks engine health before `docker compose up -d`).

Warning: raw `git worktree add` may start Docker when engines are down. Tasks without DB/email/Hatchet fixtures:

```bash
LAZULI_BOOTSTRAP_NO_FIXTURES=1 git worktree add <path> <branch>
```

Stop fixtures when done:

```bash
docker compose down       # stop; keep volumes
docker compose down -v    # stop and wipe local DB volumes (destructive)
```

Manual re-bootstrap: `pnpm bootstrap:worktree` (add `--reset-db` to re-seed, `--no-fixtures` for install + `.env` only). Re-seed GCS fixtures anytime with `pnpm seed:gcs` (add `--force` to overwrite objects).

## D-0007: Observability and Email

Use Sentry for errors, Portal cron health, and basic uptime visibility. Use Resend for production transactional email: magic links, Portal failure alerts, report/job notifications, and operational digests.

Use Mailpit locally. Do not introduce SendGrid unless this decision is reopened.

## D-0008: Rolling Enrollment and Contract Periods

**Amended 2026-07-04:** distinguishes **rolling enrollment** (valid, all modalities) from **rolling session generation** (deprecated for PERSONALIZED/PPT — see [changelog #52](./CHANGELOG.md)).

**Rolling enrollment (operational).** Students may join or leave a class at any point during a semester via `Enrollment.entryDate` / `exitDate`. Mid-semester joiners are not counted absent for sessions before they enrolled ([D-0029](#d-0029-attendance--neutral-data-state-untaken-session-flag--formula)). Enrollment windows are independent of when `ClassSession` rows were generated.

**Session generation (calendar).** REGULAR and PERSONALIZED/PPT share the same ~6-month **`Semester`** calendar for generating `ClassSession` rows — per weekday slot between `Semester.startDate` and `Semester.endDate`, skipping `SchoolClosedDay` ([S-CLS-2](./PRD.md#s-cls-2--auto-generate-class-sessions-p0)). The pedagogical split between modalities is **not** a different session calendar: REGULAR classes carry one shared stage on the class; PERSONALIZED/PPT advances stage per student via `PedagogicalProgress` while staying in the same class, schedule, and teacher ([D-0031](#d-0031-enrollment-is-operational-stage-placement-lives-on-pedagogicalprogress)). ~~PERSONALIZED "open-ended" classes with a ~90-day rolling horizon extended by a nightly Hatchet cron~~ is **deprecated** — it conflated rolling enrollment with rolling session generation and does not match school operations.

**Orders decoupled from semesters.** Orders (formerly "contracts"; see [D-0028](#d-0028-finance-core-model--order)) are not bound to a single semester — nor to any academic period/enrollment/class/stage ([D-0032](#d-0032-finance-ledger--derive-dont-store-adjustments-payer-scoped-payments)). Session generation follows the academic calendar; billing follows order/installment dates; the two never couple.

## D-0009: Attendance Reality and No `LATE` in MVP

Discovery showed two current attendance flows:

- Some teachers mark paper and coordenação enters Portal.
- Some teachers type directly into the Portal Portal do Professor.

The MVP must become the single source of truth for both groups. It should fix the irregular Portal cadence as much as eliminate retyping.

The school does not currently track tardiness as an operational policy, so MVP attendance statuses are `PRESENT` and `ABSENT` only (makeup is a separate workflow, see [D-0029](#d-0029-attendance--neutral-data-state-untaken-session-flag--formula)). The 75% attendance threshold should be used in attendance summaries.

## D-0010: Makeup Scheduling Owner

Makeup scheduling belongs to coordenação / assistente pedagógico in practice. In the MVP role set, they log in as `ADMIN`. When `SECRETARY` returns in Phase 2, that role may share the capability as a backup.

Do not add a `COORDINATOR` role in week 1. Revisit if RBAC granularity becomes painful or the pedagogical assistant needs a non-admin account.

Makeup scheduling requires advance notice in the UI: target date must be at least tomorrow.

## D-0011: Installment Defaults

Installments are negotiated commercial terms, not academic-period presets. Order creation takes `installmentCount`, `startDate`, and `dueDay`, then stores the generated `Installment` rows as the durable schedule. There is no `GenerationPreset` enum or persisted `generationPreset` provenance field.

`Order.dueDay` is required and selected from `{5, 10, 15, 20, 25}`. `firstDueDate` is derived as the next occurrence of the selected day after `startDate`.

Do not align installments to semester boundaries by default. Orders may span any commercial window; the generated installments only need to sum to the agreed `principalAmount`.

## D-0012: Interest and Multa

Overdue interest is confirmed at 1% per month. Store or configure `interestRatePctMonthly` with default `1.0` and compute the accrued amount for **display only** — there is **no auto-accrual** in MVP.

The late-payment fine (`multa`) is unresolved. Coordinator B says it is usually not applied; Coordinator A says there is a fixed value/percentage but did not provide the rate. **When interest or multa is actually charged, it is represented as an `INTEREST` / `LATE_FEE` `InstallmentAdjustment`** ([D-0032](#d-0032-finance-ledger--derive-dont-store-adjustments-payer-scoped-payments)), not as dedicated `lateFeePct`/`lateFeeAppliedAt` columns. The adjustment backbone exists in MVP; the management UI and any auto-application wait for the school to validate the rate/policy (Phase 2).

## D-0013: Substitute Teacher Fallback

When substitute-teacher assignment is eventually built, the school has no formal substitute pool. Prefer selecting an existing teacher user, but allow a free-text substitute teacher name.

This is a Phase 2 design decision only. See D-0015 for MVP scope.

## D-0014: Cora Coexistence

The school already uses Cora for boletos and automated collection emails. MVP finance tracks orders, installments, and payment entries (and statements), but does not issue or cancel boletos and does not track expenses ([D-0020](#d-0020-defer-expenses)).

Do not duplicate Cora's default dunning schedule. **MVP** ships hardcoded email triggers only ([D-0018](#d-0018-notifications-mvp--transactional-email-only)):

- D+30 email to payer after Cora's D+15 email has been ignored.
- Portal failure email to admin.

**Phase 2** configurable rules (S-NOT-3) may add:

- D+2 WhatsApp draft for staff to send.
- Additional email/WhatsApp rules as needed.

Cora reconciliation is out of scope for MVP and should remain visible as a Phase 2 candidate.

## D-0015: Defer Substitute Teacher Assignment

Do not build session-level substitute teacher assignment in MVP. Teacher absence path in MVP is session cancellation with a reason and optional makeup scheduling. Cancelled sessions are excluded from Portal submission.

Do not add `substituteTeacherId` or `substituteTeacherName` to `ClassSession` until the substitute flow is promoted from Phase 2.

## D-0016: MVP Role Set — ADMIN + TEACHER

MVP enables only two roles: `ADMIN` (owner + coordenação, doing all operational and financial work) and `TEACHER` (scoped to their own classes/sessions for attendance). `SECRETARY` and `FINANCE` are deferred until the expense module and bank integration justify splitting back-office duties.

Permissions: `ADMIN` = everything (students, enrollment, attendance, calendar, Portal, finance, settings, user management). `TEACHER` = own classes only (`class.teacherId == user.id`), mark/edit attendance same-day. The teacher scope check is the only resource-level rule; everything else is plain role-gating in tRPC middleware.

Admin read-only impersonation is deferred. The role enum keeps all four values so the split is config-only later (no migration).

## D-0017: Finance MVP — Receivables & Revenue Tracking Only

MVP finance records `Order` → `Installment` → manually-entered `PaymentEntry` (with divisible allocations), reconciles against Cora, and reports receivables. It does **not** issue charges/boletos, present a checkout, or process payments — those are Phase 2. See [D-0028](#d-0028-finance-core-model--order) for the entity model.

The earlier "P&L" framing is renamed **"Receivables & revenue tracking."** A true P&L / cash-position view depends on the Expense module (D-0020) and is Phase 2. Cora reconciliation stays manual with a fast batch-reconcile UI; automated Cora import of settled boletos is the #1 Phase 2 pick.

## D-0018: Notifications MVP — Transactional Email Only

MVP sends transactional email via Resend only: magic links, Portal failure alerts, and the finance overdue digest. Hardcoded email triggers live in S-NOT-2 (D+30 overdue to payer, Portal failure to admin). WhatsApp via self-hosted Evolution API and the configurable communication rules engine (S-NOT-3) are deferred to Phase 2. This keeps Evolution self-hosting off the week-1 critical path.

## D-0019: Defer Leads / CRM

The lead/CRM pipeline (intake, kanban, follow-ups, conversion) is out of MVP and moves to Phase 2. Consequently the `LEAD`/`TRIAL` student statuses are removed (see D-0024). The commercial team's needs are acknowledged but not built in week 1.

## D-0020: Defer Expenses

The expense module — and therefore the cash-position card and any true P&L — is deferred to Phase 2. This was previously P0. The owner's expense-control concern is real and pre-committed as a Phase 2 headline, but it is not part of the wedge or the receivables MVP.

## D-0021: Class Modality as Two Axes

Class "modality" is modeled as two independent attributes, not one enum:

- `scheduleType`: `REGULAR | PERSONALIZED` (PERSONALIZED = PPT; Portal external code likely `PERSP`). Drives progress semantics; **session generation uses the same `Semester` window for both** ([D-0008 amendment 2026-07-04](#d-0008-rolling-enrollment-and-contract-periods)).
- `format`: `IN_PERSON | ONLINE`. Delivery only.

Online follows regular pedagogy remotely, so it is a format, not a third modality. Portal's `REG`/`PERSP` prefix maps from `scheduleType`. The Portal class name is derived from structured fields and stored, with the original Portal string retained for compatibility; some name parts (`1S/2S`, trailing suffix) are unconfirmed.

**Class stage field (refined alongside [D-0030](#d-0030-course-catalog--track-and-stage)/[D-0031](#d-0031-enrollment-is-operational-stage-placement-lives-on-pedagogicalprogress)).** The class's declared stage is `Class.sharedStageId` (FK to `Stage`). It is **conditionally nullable by modality**, enforced with a DB CHECK constraint: `scheduleType = 'REGULAR' ⟹ sharedStageId IS NOT NULL` and `scheduleType = 'PERSONALIZED' ⟹ sharedStageId IS NULL`. REGULAR classes share one stage (the field drives the **stage segment of the derived Portal class name** via `Stage.internalCode`, and templates each REGULAR enrollment's initial `PedagogicalProgress`); PERSONALIZED classes carry no shared stage — per-student stage placement lives on `PedagogicalProgress`. Conditional nullability is accepted here because it mirrors a real domain split, and the CHECK constraint makes the invalid combinations unrepresentable.

## D-0022: Class / Enrollment — "Bones Now, Brain Later"

Model the operational data now; defer the intelligence. IN MVP: `ClassSession` (`SCHEDULED | CANCELLED`), enrollment as a first-class **operational** entity (`entryDate`, `exitDate?`, `exitReason?`, movement history — **no** stored `status` (derived from `exitDate`) and **no** `stageId`; stage placement lives on `PedagogicalProgress`, see [D-0031](#d-0031-enrollment-is-operational-stage-placement-lives-on-pedagogicalprogress)), stage-per-student for PERSONALIZED classes, and a `previousClass` lineage pointer with a manual "clone for next period" action.

DEFERRED to Phase 2: pedagogical progress tracking, assessments, and assisted/constraint-driven class generation (availability solver, auto-suggested continuity, auto-split, assisted transfer→reschedule→split→PPT resolution). The minimum age for PPT (≈8) is unconfirmed.

~~The full stage taxonomy and **how stage is modeled** are intentionally **not decided yet** — to be mapped in a dedicated questionnaire (including stage progression/order).~~ **Resolved 2026-06-17:** the catalog model is [D-0030](#d-0030-course-catalog--track-and-stage) (Track → Stage) and stage placement is [D-0031](#d-0031-enrollment-is-operational-stage-placement-lives-on-pedagogicalprogress).

**Amendment (2026-06-17) — structural progression enters MVP.** This decision originally deferred _all_ pedagogical progress to Phase 2. That is refined: the MVP needs to know **where a student is pedagogically placed** (stage placement affects enrollment semantics, PPT progression, and operational continuity), so the **structural** representation of progression — the `PedagogicalProgress` entity ([D-0031](#d-0031-enrollment-is-operational-stage-placement-lives-on-pedagogicalprogress)) — is **in MVP**. What stays deferred to Phase 2 is **pedagogical evaluation** (grades, assessments, test attempts, pass/fail rules, automatic progression, skill/content-level tracking, report cards, teacher evaluation). In short: MVP models _where the student is placed_, not _how well they are performing_.

## D-0023: Portal Master Login and Name-Based Matching

Portal Prof is accessed with a single shared school master credential stored in GCP Secret Manager. The `portal-submit` Playwright worker logs in, locates each class by its Portal class name/schedule, and marks attendance per student by **matching student names** on the Portal roster — there is no external student ID. Student names must be preserved verbatim from import.

MVP intent is programmatic nightly submission. **Key risk:** if the master login enforces 2FA/OTP, unattended automation is impossible and the flow degrades to an assisted "one-click submit with a human present." Resolving this is the top goal of the Sprint-0 Portal walkthrough. Whether the integration is ultimately programmatic or manual/assisted is confirmed by that spike.

**Portal run tracking is a dedicated entity (amended 2026-06-18).** `ClassSession` keeps the durable success fact `portalSubmittedAt`; queue/attempt/job/outcome/error facts live on session-linked `PortalRun` rows. This avoids overwriting `portalLast*` fields on the session while still keeping the Portal model narrow: no Portal roster snapshots and no persistent student-ID mapping unless empirical operation requires them.

## D-0024: Student Status Set

MVP student status enum is `ACTIVE | INACTIVE | DROPPED | SUSPENDED`. `LEAD`/`TRIAL` are removed (no lead pipeline, D-0019). `SUSPENDED` is added for _trancamento_ (paused enrollment, may return, seat context). The billing rules for `SUSPENDED` (fine, deadline, installment impact) remain manual/Phase 2; only the state is modeled now.

**Suspension cascade (resolved 2026-06-17).** Setting a student `SUSPENDED` **closes their active enrollments** (`exitDate` = suspension date, `exitReason = SUSPENDED`) and **closes the active `PedagogicalProgress`** (`endReason = SUSPENDED`, kept distinct from `DROPPED` so suspension and dropout stay distinguishable in progress history). This removes the student from active rosters and stops the attendance denominator cleanly via the existing `Semester ∩ Enrollment window` logic ([D-0029](#d-0029-attendance--neutral-data-state-untaken-session-flag--formula)) — no phantom absences accrue. The status-change modal is **informational only** — it makes **no automatic billing change**; staff handle installments manually (waiver/correction/adjustment). "May return" is handled by **re-enrolling** later (no resumable `PAUSED` enrollment state in MVP). `SUSPENDED` is therefore a value of `Student.status`, `Enrollment.exitReason`, **and** `PedagogicalProgress.endReason`.

## D-0025: Payer as a First-Class Entity

**Refined by [D-0028](#d-0028-finance-core-model--order).** The payer (billing party) is its own entity — `name`, `taxId` (CPF/CNPJ), `phone`, `email` — not just fields on the order. One payer can hold many orders; an order belongs to exactly one payer. The student is the _beneficiary_; the payer is who is billed and contacted. A broader structured guardian/household model remains deferred.

**Deliberate overlap with the `Guardian` (resolved 2026-06-17, updated 2026-06-18).** The `Guardian` ([D-0033](#d-0033-structured-guardian-and-address-entities), originally free-text _responsável_) is the **pedagogical/contact guardian** ("who to call about the kid") — a **distinct concept** from the `Payer` (the **billing party**). In practice they are often the same person, and MVP accepts the **re-entry** (the operator may retype the guardian as a Payer when creating an order). There is **no structural link** between `Guardian` and `Payer` — no shared FK — even though `Guardian` is now a structured entity ([D-0033](#d-0033-structured-guardian-and-address-entities)). Unifying them into one contact/party graph, plus household groups, stays deferred ([PRD §16](./PRD.md#16-out-of-scope-for-mvp-phase-2)). This duplication is a conscious tradeoff, not an oversight.

## D-0026: Legacy Import — One-Shot Script

The Legacy migration is an ad hoc, short-lived developer-run script. It may contain local parsing helpers for the specific export file, but those helpers are not domain models, reusable adapter interfaces, import job contracts, or persistent staging tables.

No Legacy-specific models/tables are added in MVP: no `LegacyStudentSource` abstraction, no import batch/job table, no row-staging table, and no persisted raw Legacy payload. The script writes normal domain rows (`Student`, `Guardian`, `Address`, and any explicitly in-scope related rows), emits a temporary validation/report artifact for the developer, and can be deleted after the migration is accepted. Re-imports are developer tasks. The export is reportedly "formato ruim" and is a Sprint-0 risk spike. An in-app importer with preview/mapping/dedup is not planned; revisit only if repeated imports become a real operational need.

## D-0027: Implementation Sequencing

Deliver in order: **Sprint 0** (de-risk spikes: real Legacy export with an ad hoc parser script + recorded Portal walkthrough behind the Portal adapter boundary; repo/infra scaffold) → **Increment 1, the wedge** (auth/RBAC → student import → classes/sessions/calendar/enrollment → attendance → Portal auto-submit) → **Increment 2, receivables** (orders → installments → manual payments → reconcile UI → receivables dashboard) → **Increment 3** (transactional notifications + remaining dashboards/reports). Pilot success: Portal on time daily, teachers capture without paper, receivables visible in one place.

## D-0028: Finance Core Model — Order

> **Refined 2026-06-17 by [D-0032](#d-0032-finance-ledger--derive-dont-store-adjustments-payer-scoped-payments).** D-0032 holds the current field-level schema, derived statuses, the `InstallmentAdjustment` backbone, payer-scoped payments, and invariants. This section is the high-level entity overview.

The finance/receivables module is built on **`Order`** as its main entity (renamed from "Contract": an order is fundamentally about money arriving, and the same shape will later carry ad-hoc/standalone charges). Entities and cardinality:

- **`Payer`** — billing party (person or company): `name`, `taxId`, `phone`, `email`. One payer → many orders.
- **`Order`** — the financial agreement / receivable package: belongs to exactly one payer; carries required `kind` (`TUITION | ENROLLMENT_FEE | MATERIAL | OTHER`), `principalAmount` (final agreed principal), `startDate`, `dueDay`, optional `signedOrderArtifactId` UUID, and cancellation facts. **Not** tied to any academic period/enrollment/class/stage. No stored `period`, `status`, `discount`, generation preset, or `SUPERSEDED` (see [D-0032](#d-0032-finance-ledger--derive-dont-store-adjustments-payer-scoped-payments)).
- **`Beneficiary` ≡ `Student`** — there is no separate Beneficiary entity. An **`OrderBeneficiary`** link carries the Order↔Student many-to-many: an order covers ≥1 student (siblings, multi-product); a student appears on many orders over time.
- **`Installment`** — "an amount due by a date." An order has ≥1 installment; each belongs to exactly one order. `amount`, `dueDate`, `waivedAt?`, `waivedReason?`. Payment/overdue state is **derived**, not stored.
- **`InstallmentAdjustment`** — signed financial adjustments on an installment (`INTEREST | LATE_FEE | DISCOUNT | CORRECTION`). Backbone built now; minimal UI in MVP.
- **`PaymentEntry`** — money received from a **payer** (`date`, `amount`, `method`, `note`, `externalReference?`); belongs to a Payer, not an order.
- **`PaymentAllocation`** — divisible join between `PaymentEntry` and `Installment`; allocations may span multiple orders **within the same payer**.

Overpayment / credit balance is not modeled in MVP, but the unallocated remainder (`entry.amount − Σ allocations`) stays **visible**; no carry-forward, no refunds (Phase 2).

**Deferred:** the full **ad-hoc charge** flow (materials priced by stage, reimbursements, events — one-off or recurring) is parked until modeled together with the stage taxonomy. `Order.kind` only classifies receivables already recorded in the backbone; it does not add pricing catalogs, payment processing, or a charge-generation workflow.

## D-0029: Attendance — Neutral Data State, Untaken-Session Flag, % Formula

**Attendance entity.** Attendance is recorded at the **`(enrollment, classSession)`** grain:

```ts
Attendance {
  id
  enrollmentId        // FK → Enrollment; studentId is reached THROUGH the enrollment (not duplicated)
  classSessionId      // FK → ClassSession
  status              // PRESENT | ABSENT   (no MAKEUP — makeup is a separate entity)
  recordedAt?
  notes?
}                     // unique (enrollmentId, classSessionId)
```

The enrollment captures the student, the class relationship, and the student's valid participation window — which is needed to scope the attendance denominator. `studentId` is **not** stored on the record.

Attendance has these settled rules:

**Explicit confirm, no persisted draft (amended 2026-06-18).** There is no server-side `AttendanceDraft` table in MVP. Before confirmation, teacher selections are client state only. For speed, the UI **pre-selects PRESENT** so a teacher only taps absentees. A session is **"attendance taken" only when the teacher presses an explicit session-level `Confirmar chamada` action** — there is no per-student submit, but there **is** one per-session confirm. On confirm, the app creates/updates committed `Attendance` rows for the active roster: untouched students commit as `PRESENT`, toggled students commit as `ABSENT`, and the session is stamped **`attendanceConfirmedAt`** (+ `attendanceConfirmedBy`). This resolves the all-present case: opening or glancing at the roster does **not** count as taking attendance (no accidental all-present commit), and the system can always distinguish "confirmed everyone present" from "never took the call". This **amends** the earlier "no submit button" rule and supersedes the prior server-side draft/autosave assumption.

**Untaken-session flag.** A session is **flagged untaken** once its scheduled end time passes (`America/Sao_Paulo`) with **`attendanceConfirmedAt` still null**. Untaken sessions are **excluded from the Portal nightly job** (so a forgotten class never reaches the portal as a fabricated all-present roster) and surfaced on the Portal health card and the admin dashboard. Admins/teachers can still take/confirm attendance later via the existing edit paths ([S-ATT-4](./PRD.md#7-attendance) / [S-ATT-5](./PRD.md#7-attendance)); confirming clears the flag.

**Makeup is a separate entity, NOT an attendance status (decided 2026-06-17).** Booking a reposição does **not** create an attendance record. Makeup has its own lifecycle:

```ts
Makeup {
  id
  originEnrollmentId      // the student's home enrollment (who is doing the makeup)
  targetClassSessionId    // the session they will visit
  scheduledAt
  scheduledBy?
  reason?
  attendedAt?             // set when the visitor actually shows and is marked present
  cancelledAt?
}
```

`MakeupDisplayStatus` is **derived** (house style): `CANCELLED` if `cancelledAt` → `ATTENDED` if `attendedAt` → `NO_SHOW` if the target session has ended and neither is set → else `SCHEDULED`. The visitor renders on the **target** session roster _from `Makeup` rows_ (not from an attendance record); the origin session is untouched.

**Makeup does not affect the 75% attendance %** — neither numerator nor denominator. A no-show makeup therefore cannot wrongly credit the student, and an attended makeup does not neutralize the origin absence. Makeups are tracked for coordination/history/support only. (This supersedes the earlier "MAKEUP = present-equivalent credit" rule and removes `MAKEUP` from the attendance status set.)

**Attendance % (75% flag).** The attendance minimum is evaluated **per 6-month academic period, not per stage** — `PedagogicalProgress` is **not** involved. The universal 6-month bucket is the **`Semester`** ([D-0008](#d-0008-rolling-enrollment-and-contract-periods)); a session falls into the semester whose date range contains its date, for **all** modalities (REGULAR, PERSONALIZED/PPT, ONLINE). Per **`(enrollment, semester)`**:

```
% = PRESENT / held_sessions
```

where `held_sessions` = sessions of the class that fall within **`Semester window ∩ Enrollment window`**, are **not `CANCELLED`**, **and have `attendanceConfirmedAt` set** (i.e. the call was actually taken — the same "held" definition as [S-CLS-2](./PRD.md#s-cls-2--auto-generate-class-sessions-p0)). The intersection with the enrollment window means a mid-semester joiner is not counted absent for sessions before they enrolled. The 75% threshold from [D-0009](#d-0009-attendance-reality-and-no-late-in-mvp) is applied to this per-semester value. An enrollment-level (lifetime) % may be shown as an optional aggregate but is **not** the basis for the flag.

**Denominator = confirmed sessions only (resolved 2026-06-17).** The single predicate for "held" is **`attendanceConfirmedAt IS NOT NULL`** (plus not `CANCELLED`, plus in `Semester ∩ Enrollment window`). This makes numerator and denominator share one source — `PRESENT` counts only exist on confirmed sessions, since attendance is committed only on `Confirmar chamada` — so neither can drift from the other. Two session kinds are therefore **excluded** automatically: **future** sessions (never confirmed) and **untaken** past sessions (`attendanceConfirmedAt` null after scheduled end). Untaken sessions are **never** silent absences in the %; they surface only as the separate untaken-session warning ([S-REP-4](./PRD.md#13-dashboards--reports)). This resolves the prior ambiguity where "non-`CANCELLED` sessions in window" literally would have counted future and untaken sessions against the student, contradicting both S-CLS-2's "held" definition and the "not silent absences" guarantee.

**Empty denominator (`held_sessions = 0`, resolved 2026-06-17).** When an `(enrollment, semester)` has no confirmed sessions yet (new enrollment, early semester, or no call taken yet), the % is **undefined** and is rendered as **"—" / "sem dados"** — _not_ 0% and _not_ 100%. The **<75% flag only evaluates when `held_sessions > 0`**; it never fires on an empty denominator. Concretely: `flagged ⟺ held_sessions > 0 AND PRESENT / held_sessions < 0.75`. This prevents false "at risk of failing the attendance minimum" labels on students who simply haven't had a taken session yet.

**Unresolved:** the school's **justified-absence policy** is in conflict (Coordinator A: doesn't count; Coordinator B: counts but with makeup). MVP has no `JUSTIFIED` status, and **makeups no longer neutralize absences** (makeup doesn't affect the %), so **as currently modeled every `ABSENT` counts equally** regardless of justification or makeup. The earlier interim "convert justified absences to makeups for credit" workaround is **void**. Until the policy is settled (see [PRD §15 open question 15](./PRD.md#15-open-questions-need-answers-before--during-week-1)), this "every absence counts" stance is the MVP default.

## D-0030: Course Catalog — Track and Stage

**Amended 2026-06-18** ([changelog #44–45](./CHANGELOG.md)): product-line coverage expanded to seven progression paths; `Track.sequence` dropped — tracks are independent, ordering lives on `Stage` only.

**Amended 2026-07-03 (GRE-24):** product line moved from hardcoded enum values to seeded `ProductLine` rows. This keeps school/product labels editable through data changes rather than schema changes.

The course catalog (validated in [discovery/course-stage-ordering.md](../discovery/course-stage-ordering.md)) is modeled as seeded tables, **ProductLine → Track → Stage**.

```ts
// ProductLine, Track, and Stage extend UUIDEntity — see D-0034.

ProductLine {
  key           // stable seed key, e.g. "adult", "teens_connect", "teenstation"
  name          // user-facing product line label, e.g. "Adultos", "Teens Connect"
  status        // ACTIVE | LEGACY
  portalPrefix? // optional, if a product-line Portal segment is later confirmed
}

Track {
  name          // e.g. "Adultos / English Main", "Teens Connect", "Teenstation"
  productLineId // FK → ProductLine
  status        // ACTIVE | LEGACY
  portalPrefix? // optional, if a track-level Portal segment is later confirmed
}

Stage {
  trackId       // FK → Track
  name          // canonical/user-facing, e.g. "Teens Upper Intermediate", "Essentials 2"
  internalCode  // short operational code, e.g. "TUI", "ES2", "SP1"; unique within track
  sequence      // order of the stage inside its track (1,2,3…)
}
```

Rules:

- **Tracks are independent.** No `sequence` on `Track` and no cross-track ordering. Some real-world equivalences exist (e.g. Speed ↔ adult English) but are hard to model and the operational gain is small — staff pick the target track/stage explicitly when enrolling or advancing.
- **Stage ordering only:** linear integer `sequence` per track. "Next stage" = same track, `sequence + 1`. No `previous/next` pointers; cross-track equivalences/branching are **not modeled**.
- **`ProductLine`** classifies the school's product lines as seed data. Initial rows: `adult` (Adultos), `kids` (Infantil), `teens` (legacy Teens), `teens_connect` (Teens Connect), and `teenstation` (legacy Teenstation). Speed and Espanol are active tracks under Adultos. Product-line names can evolve through seed changes without schema enum churn.
- **`Track.status = LEGACY` blocks new, allows existing.** Legacy tracks (e.g. `TEENS`, `TEENSTATION` — being replaced by `TEENS_CONNECT`) cannot be picked when creating a **new** class or **new** enrollment, but existing classes/enrollments on them keep working and reporting. Connect is `ACTIVE`.
- **Canonical Portal naming (resolved 2026-06-17).** There is **no separately-stored Portal stage code.** `Stage.internalCode` is our internal code **and** the stage segment of the derived/stored Portal class-name string (the `TUI` in `REG/TUI-…`, see [D-0021](#d-0021-class-modality-as-two-axes)). Portal **student** matching is by full **student** name ([D-0023](#d-0023-portal-master-login-and-name-based-matching)); the **class** is located via the derived Portal class-name string. The exact class-name _format_ (and that Portal's class list is locatable by it) remains a Sprint-0 walkthrough item — as does PPT/PERSONALIZED naming, which has no stage segment.
- **Seed-only in MVP, no CRUD UI.** The catalog (5 product lines, 7 tracks, 42 stages) ships as an idempotent seed derived from the discovery doc, with legacy product lines/tracks seeded as `LEGACY`. Edits are a developer task (like Legacy import, [D-0026](#d-0026-legacy-import--one-shot-script)). An admin catalog UI is Phase 2.

GRE-24 seeds the real Lazuli course/stage catalog. GRE-13 separately validates whether `Stage.internalCode` and derived class-name rules match the external Portal. Portal-only corrections should update seed data or class-name derivation rules after GRE-13. Whether Speed reconnects into the adult English path is **not modeled** — staff pick the target track/stage explicitly when enrolling or advancing.

## D-0031: Enrollment is Operational; Stage Placement Lives on PedagogicalProgress

`Enrollment` and pedagogical progression do **not** mean the same thing across modalities, so they are separated. Putting `stageId` directly on `Enrollment` was rejected: in REGULAR classes a stage snapshot aligns with the class-period cycle, but in PERSONALIZED/PPT a student advances stages **while staying in the same class, schedule, teacher, and operational relationship**. PPT is a significant part of the operation, not an edge case, so it must not be modeled as an exception.

```ts
// Enrollment and PedagogicalProgress extend UUIDEntity — see D-0034.

Enrollment {            // operational vínculo only — "which class is the student linked to?"
  studentId
  classId
  entryDate
  exitDate?             // active = exitDate IS NULL; NO stored status (derived)
  exitReason?           // set when exitDate set: COMPLETED | TRANSFERRED | DROPPED | SUSPENDED | CORRECTION
  // NO stageId
}

PedagogicalProgress {   // stage placement + history — "which stage is the student working on?"
  enrollmentId          // FK → Enrollment
  stageId               // FK → Stage
  startDate
  endDate?              // null = active; one active record per active enrollment
  endReason?           // null while active; ADVANCED | TRANSFERRED | DROPPED | SUSPENDED | CORRECTION
}
```

Rules:

- **Enrollment has no stored `status`** (resolved 2026-06-17). Active = `exitDate IS NULL`; `EnrollmentDisplayStatus {ACTIVE, CLOSED}` is derived. The reason it closed lives in `exitReason ∈ {COMPLETED, TRANSFERRED, DROPPED, SUSPENDED, CORRECTION}` (`COMPLETED` = finished a period/stage via clone-for-next-period). Mirrors the no-stored-status pattern below; removes the ambiguous "ACTIVE + exitDate set".
- **Current stage is derived from the active `PedagogicalProgress`** (`endDate IS NULL`). No redundant `status` field — active/historical is derived from `endDate`. This avoids awkward states like `COMPLETED + DROPPED`.
- **Each active enrollment has exactly one active `PedagogicalProgress`.** REGULAR enrollments usually have one record (matching `Class.sharedStageId`); PERSONALIZED/PPT enrollments accumulate **multiple sequential** records as the student advances.
- **`endReason`** (set when `endDate` is set): `ADVANCED` (moved to next stage), `TRANSFERRED` (moved class/enrollment before completing), `DROPPED` (left/interrupted), `SUSPENDED` (trancamento — kept distinct from DROPPED so suspension and dropout are distinguishable in progress history, [D-0024](#d-0024-student-status-set)), `CORRECTION` (data fix).
- **Advancing a PPT student does not close the enrollment.** The thin transactional `advance` action: (1) find the active `PedagogicalProgress` for the enrollment; (2) find the next `Stage` in the same `Track` by `sequence + 1`; (3) set its `endDate` and `endReason = ADVANCED`; (4) create a new active `PedagogicalProgress` at the next stage; (5) keep the enrollment active. REGULAR progression continues to happen via the class lineage / "clone for next period" flow ([D-0022](#d-0022-class--enrollment--bones-now-brain-later)), which produces a successor class + enrollment + initial progress record.
- This **amends [D-0022](#d-0022-class--enrollment--bones-now-brain-later)**: structural progression is in MVP; pedagogical evaluation (grades, assessments, pass/fail, automatic progression) stays Phase 2. `PedagogicalProgress` is the structural home those Phase-2 fields will later hang off.

## D-0032: Finance Ledger — Derive-Don't-Store, Adjustments, Payer-Scoped Payments

Refines [D-0028](#d-0028-finance-core-model--order) into a field-level ledger model. Guiding principle (shared with [D-0029](#d-0029-attendance--neutral-data-state-untaken-session-flag--formula)/[D-0031](#d-0031-enrollment-is-operational-stage-placement-lives-on-pedagogicalprogress)): **store durable business facts; derive display statuses at read time.** All amounts are **integer cents, BRL-only** (no currency field — one school). **Naming convention:** every monetary field is integer cents and uses the **`Cents` suffix** (`principalAmountCents`, installment `amountCents`, allocation `amountCents`, adjustment `amountCents`, payment `amountCents`); where this doc writes `amount`/`principalAmount` for brevity, read `…Cents`.

```ts
// All entities below extend UUIDEntity (id, created_at, updated_at, deleted_at) — see D-0034.

Payer { name, taxId, phone, email }                                   // → many Orders

Order {
  payerId,
  kind,                   // TUITION | ENROLLMENT_FEE | MATERIAL | OTHER
  principalAmount,        // final AGREED principal (post any signing discount); installments generated from this
  startDate, dueDay,      // dueDay ∈ {5,10,15,20,25} (D-0011)
  signedOrderArtifactId?, // nullable UUID only until GeneratedArtifact ships
  cancelledAt?, cancelledReason?    // only stored lifecycle fact
}                          // NO period, NO status, NO discount fields, NO generationPreset, NO SUPERSEDED

OrderBeneficiary { orderId, studentId }   // Order↔Student m2m (Beneficiary ≡ Student)

Installment { orderId, amount, dueDate, waivedAt?, waivedReason? }   // amount = scheduled principal

InstallmentAdjustment { installmentId, type, amount, reason?, createdById? }
  // type ∈ { INTEREST, LATE_FEE, DISCOUNT, CORRECTION }   (no WAIVER — full waiver is Installment.waivedAt)
  // amount is signed: INTEREST/LATE_FEE positive; DISCOUNT/CORRECTION may be negative

PaymentEntry { payerId, date, amount, method, note?, externalReference?, createdById? }   // money received from a payer
PaymentAllocation { paymentEntryId, installmentId, amount }                 // divisible
```

**Derived values (read-time, never persisted):**

- Installment `paidAmount = Σ(allocations)`; `currentExpected = amount + Σ(adjustments)`; `remaining = currentExpected − paidAmount`.
- `InstallmentDisplayStatus ∈ { UPCOMING, DUE_THIS_MONTH, OVERDUE, PAID, WAIVED }`, priority: **WAIVED** (`waivedAt` set) → **PAID** (`paidAmount ≥ currentExpected`) → **OVERDUE** (`dueDate < today`, unpaid) → **DUE_THIS_MONTH** (`dueDate` in the **current calendar month, `America/Sao_Paulo`**) → **UPCOMING**. ("today"/"current month" are evaluated in `America/Sao_Paulo`, so the status is deterministic across timezone/month boundaries.) A partially-paid installment still shows DUE_THIS_MONTH/OVERDUE with paid/remaining shown separately. No transition job.
- **Waiver forgives only the remaining.** Setting `waivedAt` forces the installment's `openBalance` contribution to 0 going forward but does **not** touch existing allocations: `paidAmount` stays, and revenue (which sums `PaymentEntry`/`PaymentAllocation`, **not** installment status) still counts it. Waiver is allowed only when `remaining > 0` (waiving a fully-paid installment is blocked as meaningless). `WAIVED` means "nothing further expected", not "erase what was paid".
- Order `openBalance = Σ(non-waived installments' remaining)`; `OrderDisplayStatus ∈ { CANCELLED, COMPLETED, ACTIVE }`: **CANCELLED** (`cancelledAt` set) → **COMPLETED** (`openBalance = 0`) → **ACTIVE**.
- PaymentEntry `unallocatedRemainder = amount − Σ(allocations)` — visible, not carried forward.

**Invariants:**

- `Σ(allocations of an entry) ≤ entry.amount`.
- `Σ(allocations to an installment) ≤ installment.currentExpected` (i.e. `amount + Σ adjustments`).
- Every installment allocated by a PaymentEntry belongs to an order whose `payerId == entry.payerId`.
- `PaymentEntry.amount ≥ 0`, `PaymentAllocation.amount ≥ 0` (no negative entries/refunds in MVP).
- `Order.principalAmount > 0`; `Installment.amount ≥ 0`; `Order.dueDay ∈ {5, 10, 15, 20, 25}`.
- `Order.cancelledAt` and `cancelledReason` move together; `Installment.waivedAt` and `waivedReason` move together.
- `signedOrderArtifactId` is a UUID-only reference for now; the `GeneratedArtifact` table/FK is deferred to the artifact workflow slice.
- At generation, `Σ(installments) == order.principalAmount` (equal split, **remainder on the last installment**); they are **not** forced equal afterward (waivers/adjustments may diverge).

**Behavioral rules:**

- **No interest auto-accrual in MVP.** 1%/month interest ([D-0012](#d-0012-interest-and-multa)) and multa are shown as informational projections. When actually charged, they are represented as `INTEREST`/`LATE_FEE` adjustments — the backbone exists now; full adjustment-management UI is Phase 2.
- **No signing discount stored.** It is folded into `principalAmount`; gross/list and discount-granted are not recoverable in MVP (accepted reporting gap). `DISCOUNT` adjustments are for _post-generation_ per-installment reductions only.
- **Order edit cutoff (concrete).** An order's `principalAmount` and installment schedule are editable only while the order has **no financial activity** — defined as **any `PaymentAllocation`, `waivedAt`, or `InstallmentAdjustment` on any of its installments**. Once any exists, the order is **locked**; changes must go through cancel + recreate or explicit `CORRECTION`/`DISCOUNT` adjustments / waiver fields. (Replaces the fuzzy "before meaningful payments exist".) No formal supersede/versioning.
- **Order is decoupled** from academic structure; academic context is navigated via the linked student; optional provenance may be added to `OrderBeneficiary` later.
- **Batch reconcile (Cora):** group selected installments by payer → one `PaymentEntry` per payer → one `PaymentAllocation` per installment (default amount = installment `remaining`) with settlement date + method + optional `externalReference` (Cora id). No special "settled" flag — paid is derived.

## D-0033: Structured Guardian and Address Entities

**Decided 2026-06-18.** Expands the student record by promoting the responsável to an entity and adding a structured address — **partially reversing** the earlier "free-text only" stance ([changelog #9](./CHANGELOG.md), [D-0025](#d-0025-payer-as-a-first-class-entity)). The Legacy export ([discovery/Legacy](../discovery/Legacy/)) carries richer, if messy, data (separate RG/CPF, a full responsável block with its own address, _grau de parentesco_) that the free-text field was throwing away.

**Entities:**

- **`Guardian`** — `fullName`, `relationship` (_grau de parentesco_, free text), `documentType?`, `documentNumber?`, `phone?`, `email?`, `addressId?`. Replaces `Student.responsibleText`. `Student.guardianId` is a **many-to-one** FK, so **siblings may share one `Guardian`** (a gain the free-text field could not give). One guardian per student in MVP — **multiple guardians per student and household groups stay deferred** ([PRD §16](./PRD.md#16-out-of-scope-for-mvp-phase-2)).
- **`Address`** — Brazilian shape: `street` (logradouro), `number`, `complement`, `neighborhood` (bairro), `city`, `state` (UF), `postalCode` (CEP). All optional (export quality varies).
- Both **`Student` and `Guardian` carry `addressId?`** — a **plain, shareable FK**: when a minor lives with their guardian, both rows may point at the **same** `Address`. Editing a shared row affects both holders by design (the UI must make this visible). `onDelete: SetNull`.

**Document number.** A single `documentType` (`enum DocumentType { CPF, RG }`) + `documentNumber` pair on both `Student` and `Guardian`, rather than separate `cpf`/`rg` columns. One legal document per person; CPF is the same id used by `Payer.taxId`. **Paired invariant:** `documentNumber` set ⟹ `documentType` set (CHECK + tRPC). During the ad hoc Legacy import, separate RG/CPF columns collapse to the populated one (CPF preferred when both exist); discarded Legacy source values are not persisted as a raw payload.

**Relationship to `Payer`.** `Guardian` (contact) and `Payer` (billing) stay **structurally separate with no FK** ([D-0025](#d-0025-payer-as-a-first-class-entity)) — promoting the responsável to an entity does **not** merge the two concepts. Re-entry when they are the same person is still accepted.

**Minor rule.** The "responsável required for minors" rule now points at `guardianId` (was `responsibleText`): a minor `Student` must have a `Guardian`. tRPC-validated; DB trigger because age depends on the current date.

## D-0034: UUIDEntity Base for All Domain Tables

**Decided 2026-06-18.** Every domain table in the Prisma schema shares a common column block instead of ad-hoc `cuid` IDs and per-model timestamp fields.

**UUIDEntity columns** (repeated on each domain model; Prisma has no inheritance):

| Column (DB)  | Prisma field | Type           | Notes                                       |
| ------------ | ------------ | -------------- | ------------------------------------------- |
| `id`         | `id`         | `uuid` PK      | `@default(uuid())`                          |
| `created_at` | `createdAt`  | `timestamptz`  | `@default(now())`                           |
| `updated_at` | `updatedAt`  | `timestamptz`  | `@updatedAt`                                |
| `deleted_at` | `deletedAt`  | `timestamptz?` | soft delete; default reads filter `IS NULL` |

**Scope:** all models in [TECHNICAL_SPEC §4.1–4.8](./TECHNICAL_SPEC.md#4-prisma-data-model). **Exceptions:** Better Auth adapter tables; `FinanceSettings` singleton (`id = "singleton"`, no soft delete).

**Implementation notes:**

- TypeScript type `UUIDEntity` lives in `packages/db` for shared helpers.
- Soft delete via Prisma client extension; product flows set `deletedAt`, not hard `DELETE`.
- Domain-specific operational timestamps (`recordedAt`, `requestedAt`, etc.) remain separate from the entity lifecycle timestamps. Per-field student profile attribution (`statusChangedAt`, `contactUpdatedAt`, etc.) is deferred — see [D-0035](#d-0035-defer-student-field-level-traceability).

## D-0035: Defer Student Field-Level Traceability

**Decided 2026-06-18.** `Student` carries no per-field edit or status-change attribution in MVP. Removed from the schema:

- `statusChangedAt`, `statusChangedById`, `statusChangeReason`
- `contactUpdatedAt`, `contactUpdatedById`
- `notesUpdatedAt`, `notesUpdatedById`

**Consequences:**

- [S-STU-5](./PRD.md#s-stu-5--student-status-lifecycle-deferred) moves from P1 to **deferred** until a rastreabilidade layer is designed (generic audit log, event stream, or field-level stamps — TBD).
- **`DROPPED` reason** is no longer enforced at P0; staff may set `DROPPED` without capturing a reason in the system. Supersedes [changelog #39](./CHANGELOG.md) on that point.
- Profile UI does not show `lastModifiedBy` beside contact/notes fields.
- Operational attribution on other entities (e.g. committed `Attendance.lastModifiedAt`) is unchanged.

## D-0036: Frontend Surfaces Deferred (design-system gate)

**Decided 2026-06-27.** Product screens stay in their **original Linear domain projects** (P01–P08). Backend and UI are **separate issues** in the same project when a story was hybrid. UI issues are **post-phase work**, blocked until **GRE-57** (design system triage in P00) closes.

**Split rule:** hybrid stories keep the **original GRE on the backend half**; UI gets a new GRE in the **same domain project** (e.g. GRE-20 API + GRE-60 UI, both in P02).

| Backend                       | UI (same project)                     |
| ----------------------------- | ------------------------------------- |
| GRE-15 auth endpoints (P01)   | GRE-58 sign-in surfaces (P01)         |
| GRE-17 RBAC HTTP 403 (P01)    | GRE-16 app shell + 403 page (P01)     |
| GRE-20 profile API (P02)      | GRE-60 profile page + forms (P02)     |
| GRE-61 attendance tRPC (P05)  | GRE-33 mobile attendance screen (P05) |
| GRE-41 `portal.health` (P06)  | GRE-62 Portal health card (P06)       |
| GRE-63 receivables API (P07)  | GRE-49 receivables dashboard (P07)    |
| GRE-59 extrato worker (P07)   | poll UX in GRE-49                     |
| GRE-64 dashboard router (P08) | GRE-52 admin/teacher home pages (P08) |

**Gate:** GRE-57 in **[P00] Foundation & de-risk** — not a separate UI project.

**Consequences:**

- [PRD](./PRD.md) user stories remain the behavioral contract; backend issues do not implement screens.
- [TECHNICAL_SPEC §8](./TECHNICAL_SPEC.md#8-ui-boundaries) defines UI behavior; implementation lives in UI-labelled GREs above.
- `packages/ui` baseline ships when GRE-57 closes.

## D-0037: Receivables as a Deep Module

**Decided 2026-07-08.** The finance/receivables implementation exposes one API-owned module surface:
`receivables(db, staffUserId)`. tRPC procedures remain the RBAC and transaction boundary, but they call
this module instead of coordinating payer, order, installment, payment, waiver, adjustment, and dashboard
steps directly.

**Module shape:**

- Public surface: `packages/api/src/receivables/index.ts` exports the `receivables` factory, public result
  types, and error constants needed by tests and callers.
- Private implementation: `packages/api/src/receivables/internal/*` owns persistence orchestration,
  order schedule generation, ledger reads, payment allocation checks, waivers, adjustments, batch
  reconcile, and dashboard reads.
- Boundary: ESLint blocks imports from `receivables/internal` outside the receivables module. Tests and
  routers must prove behavior through `receivables(...)` or the HTTP/tRPC boundary, not by reaching into
  coordinator files.
- Pure calculators stay in `@lazuli/domain`. The API module composes them with Prisma; it does not move
  database access into the domain package.

**Rationale:** The previous finance API implementation scattered one order flow across many shallow
coordinator files whose public interfaces closely mirrored their implementations. A single receivables
module keeps D-0032's derive-don't-store ledger semantics while making the end-to-end create → derive →
aggregate flow testable through one interface.

**Consequences:**

- `packages/api/src/receivables/router.ts` should remain thin: input schema, RBAC procedure, transaction,
  module call.
- New receivables behavior should first ask whether it belongs on the module surface or remains an
  internal detail; adding another externally imported coordinator is a regression.
- Integration tests should include at least one module-level flow that creates an order, derives ledger
  state through payments/waivers/adjustments, and reads dashboard/overdue aggregates through
  `receivables(...)`.

## Security and Data Rules

- Student PII lives in Cloud SQL.
- Hatchet payloads carry IDs and minimal status data, not full student profiles.
- Worker logs must not contain student PII.
- GCS artifacts use signed URLs for download.
- Retention policy for reports, invoices, and receipts is still open.
- Production secrets come from GCP Secret Manager; local secrets live in `.env.local`.

## Deferred

The canonical out-of-scope / deferred list lives in [PRD §16](./PRD.md#16-out-of-scope-for-mvp-phase-2). Each deferral is backed by a decision in the register above (D-0015, D-0016, D-0017, D-0018, D-0019, D-0020, D-0022, D-0026, D-0035). Update both together when scope changes.
