# Lazuli Technical Specification

**Status:** v0.3 draft for implementation, revised after adversarial review + implementation grilling  
**Date:** 2026-06-18  
**Source of truth:** [PRD](./PRD.md) + [decisions](./decisions.md). Discovery files provide evidence; if they disagree with PRD/decisions, PRD/decisions win until both are amended together.

**v0.3 revisions (effort-budget grilling):**

1. **Portal is a best-effort formality, not a load-bearing dependency.** The school often does not keep Portal current when students change. The submit stays a dumb, name-match, best-effort side effect that is allowed to be wrong or skipped. No persistent Portal ID/roster mapping, no fail-closed reconciliation, no nightly correctness guarantees. **Nothing else in the system may depend on Portal being correct.** Sequencing and product value do not hinge on Portal feasibility.
2. **One worker service, not two.** `worker-default` and `worker-portal` collapse into a single `worker` app/image (Playwright-capable, low concurrency). Re-split only if Playwright load later justifies isolation.
3. **Cross-entity invariants live in the service layer, not DB triggers.** With a single trusted writer (the tRPC BFF) and non-adversarial operators, the DB keeps only _cheap, local_ constraints (CHECK, unique / partial-unique indexes, the semester exclusion constraint). All trigger-backed cross-table invariants enumerated in §4.4–4.7 are enforced in the tRPC transaction layer with named domain checks + integration tests. See §3.3.
4. **Money writes are serialized in-transaction.** Finance allocation/overpayment ceilings move to the service layer but must take a `SELECT … FOR UPDATE` on the target installment row inside the allocation transaction, so concurrent allocations cannot race past an installment's ceiling.
5. **No Sentry in MVP.** Error monitoring (Sentry) is dropped for now. Rely on Cloud Run / host logs (IDs only, no PII). Revisit observability tooling post-MVP.

This spec turns the current product/domain decisions into an implementation contract for the first T3 Turbo codebase. It covers the full MVP target, sequenced by increment per `D-0027`. The current repository is docs-only; Sprint 0 must scaffold the codebase before these commands, packages, and migrations exist. Deferred modules remain out of MVP.

> **UI execution split (2026-06-27, [D-0036](./decisions.md#d-0036-frontend-surfaces-deferred-design-system-gate)):** §8 and other UI references define behavior for **UI-labelled GREs in domain projects** (post-phase, gated on GRE-57). P01–P09 **backend** issues implement schema, tRPC, workers, and auth endpoints only.

Trace IDs are expanded in Section 12.

## 1. Scope Contract

### 1.1 MVP modules and sequencing

The full MVP includes:

- Auth and RBAC for enabled roles `ADMIN` and `TEACHER`.
- Student import, search, profile, contact edits, notes, status changes.
- Seeded course catalog: `Track -> Stage`.
- Classes, schedule slots, sessions, school closed days, semesters, session cancellation.
- Enrollment as the operational student/class link.
- PedagogicalProgress as structural stage placement/history.
- Attendance capture, explicit session confirmation, makeups as separate workflow.
- Portal submission boundary, conditional on Sprint-0 feasibility.
- Receivables: payers, orders, installments, adjustments, payment entries, allocations, waivers, dashboards/reports.
- Transactional email only: magic links, Portal failure alerts, D+30 overdue email, daily overdue digest.
- Dashboards and report/artifact generation.

MVP excludes:

- Leads/CRM, expenses, WhatsApp/Evolution API, payment processing/boleto issuance, automated Cora import, grades/assessments, assisted class generation, substitute-teacher assignment, household groups / sibling-discount rules / multiple guardians per student, in-app Legacy importer UI, `SECRETARY` and `FINANCE` enablement. Legacy importer UI is not planned; revisit only if repeated imports become a real operational need.

> A **single structured `Guardian`** per student and a shared `Address` entity **are** in MVP ([D-0033](./decisions.md#d-0033-structured-guardian-and-address-entities)); only multi-guardian households and discount rules remain deferred.

Detailed story and decision trace lives in Section 12.

Increment order:

| Increment   | Implementation target | Included scope                                                                                                                                                    |
| ----------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sprint 0    | Scaffold + de-risk    | T3 Turbo scaffold, Prisma/Postgres, Docker Compose, seed skeleton, Legacy sample parser spike, Portal credential/API/Playwright spike, course seed validation     |
| Increment 1 | Wedge                 | Auth/RBAC, students/import, catalog seed, classes/sessions/calendar, enrollment/progress backbone, attendance, Portal submission mode selected by Sprint-0 result |
| Increment 2 | Receivables           | Payers, orders, installments, adjustments backbone, manual payments, allocations, batch reconcile, receivables dashboard                                          |
| Increment 3 | Comms/reports         | Resend transactional emails, overdue digest, Portal failure alerts, report/artifact generation, dashboard polish                                                  |

Fields or procedures tagged `P1` below are not week-1 requirements unless an accepted decision already requires their storage for a P0 backbone. They should be implemented after the P0 path is stable.

### 1.2 Resolved implementation assumptions

These assumptions fill implementation gaps without changing product scope:

1. All product date math uses `America/Sao_Paulo`; DB timestamps are stored as UTC `timestamptz`; date-only business fields use Postgres `date`.
2. Display statuses are never stored. Store business facts and derive statuses in query/service code.
3. Prisma owns ordinary schema definitions; raw SQL migrations own only _cheap, local_ constraints — CHECK constraints, partial unique indexes, and the semester exclusion constraint. Cross-entity invariants that would otherwise need triggers are enforced in the tRPC transaction layer (single trusted writer) with named domain checks + integration tests, not DB triggers. See §3.3 (v0.3).
4. Async workflow display state is derived from job/fact timestamps (`queuedAt`, `attemptedAt`, `succeededAt`, `failedAt`) and domain success facts (`portalSubmittedAt`, artifact `completedAt`). These are operational facts, not business display statuses.
5. Portal integration stays behind `PortalClient`. The current authoritative model uses Playwright, Portal class names, and student names per `D-0023`. The discovery report found a JSON API and `cdAluno` IDs; this remains Sprint-0 spike evidence only. API-first production behavior or persistent Portal ID mapping requires a PRD/decision update before it becomes implementation contract or core schema.
6. `Class.portalClassName` is stored as the current locator/audit string. For REGULAR classes it is generated from structured fields once naming is validated. For PERSONALIZED/PPT, manual/imported `portalClassName` is allowed until the Sprint-0 walkthrough fully confirms naming.
7. No notification rule engine table ships in MVP. Hardcoded email triggers live in code and Hatchet schedules.
8. No generic audit-log table ships in MVP. Operational rows that still need edit attribution in MVP (e.g. committed `Attendance`) carry `lastModifiedById` / `lastModifiedAt`. Per-field student profile attribution is deferred ([D-0035](./decisions.md#d-0035-defer-student-field-level-traceability)).

Trace: `D-0008`, `D-0023`, `D-0029`, `D-0030`, `D-0031`, `D-0032`; `S-Portal-1`, `S-ATT-1`, `S-FIN-2`.

### 1.3 Open items carried into Sprint 0

Do not block repo scaffold on these, but do not pretend they are solved:

- Legacy export schema/encoding/sample.
- Actual Portal master/coordination credential, all-class visibility, submit payload validation, correction/resubmission semantics, PPT endpoint behavior.
- Exact production course/stage internal codes and Portal naming.
- Justified absence policy. MVP default remains: every `ABSENT` counts equally; makeups do not affect attendance percentage.
- Multa rate/policy.
- Artifact retention policy.
- Web host, Cloud SQL connectivity, CI/CD target environment, staging, PDF library.

Trace: PRD Section 15; `D-0023`, `D-0026`, `D-0027`, `D-0029`, `D-0030`, `D-0012`.

## 2. Architecture

### 2.1 Monorepo layout

Scaffold from T3 Turbo and keep its Turborepo/package-manager conventions. Sprint 0 must document any deliberate deviation from the upstream scaffold. The logical package names below are the target shape for this product; if the scaffold creates different app names, either rename consistently during Sprint 0 or maintain a mapping in `docs/decisions.md`.

Deliberate MVP deviations from common T3 Turbo examples:

- Use Prisma with Cloud SQL Postgres, not Drizzle/Supabase.
- Keep only web surfaces needed for this internal app; remove scaffolded mobile/example apps if generated.
- Add one long-running Hatchet worker app for the Cloud Run service.
- Keep job contracts separate from worker handlers so the web app never imports Playwright, PDF, GCS, or email runtime dependencies.

```text
apps/
  web/                     Next.js App Router app, tRPC client/server entry, Better Auth route handlers
  worker/                  Single Hatchet worker: reports, email, session generation, and best-effort Portal; Playwright-capable image, low concurrency
packages/
  api/                     tRPC routers, procedures, RBAC middleware, service orchestration
  auth/                    Better Auth config, session helpers, role/session typing
  db/                      Prisma schema, migrations, seeds, raw SQL constraint migrations
  domain/                  Pure domain calculators and invariants with no Prisma dependency
  job-contracts/           Hatchet workflow names, payload schemas, enqueue helpers
  integrations/            Adapter interfaces plus light clients safe to share
  worker-handlers/         Worker-only handlers for Portal, PDFs, GCS, Resend; never imported by web/api
  ui/                      Shared UI components; Portuguese-BR labels live near UI
  validators/              Zod schemas shared by API, workers, and scripts
tooling/
  eslint/
  prettier/
  tsconfig/
scripts/
  legacy-import-students.ts
  seed.ts
  verify-constraints.ts
infra/
  pulumi/                  Pulumi TypeScript stacks for GCP resources
```

Rules:

- `apps/web` may call tRPC procedures and render UI. It must not import Prisma directly.
- `apps/worker` runs the Hatchet worker as a single Cloud Run service. It may import `packages/db`, `packages/domain`, `packages/job-contracts`, `packages/integrations`, and `packages/worker-handlers`. Portal (Playwright) handlers run here at low concurrency; re-split into a dedicated worker only if Playwright load later justifies it.
- `packages/api` is the BFF boundary: all web writes go through tRPC procedures.
- `packages/domain` contains pure functions for derived values and status calculators.
- `packages/job-contracts` owns enqueue contracts only. It must not import worker handlers.
- `packages/integrations` owns external adapter interfaces and lightweight clients. Playwright-heavy Portal implementation lives in worker-only code.
- `packages/db` owns schema, migrations, seeds, and DB-level constraints.

Trace: `D-0001`, `D-0002`, `D-0003`, `D-0004`, `D-0006`, `D-0007`.

### 2.2 Runtime topology

```text
Next.js web app
  - Better Auth
  - tRPC BFF
  - Prisma through packages/db
       |
       v
Postgres 16 (Cloud SQL prod, Docker Compose local)

Hatchet Cloud
       |
       +--> Cloud Run service: worker (single)
              - Prisma, Resend, GCS, report generation
              - Portal adapter + Playwright-capable runtime (best-effort, low concurrency)
```

Local development:

- `docker compose up` starts Postgres 16, Mailpit, and Hatchet Lite.
- Sprint-0 `docker-compose.yml` must define stable local ports: Postgres `5432`, Mailpit UI `8025` / SMTP `1025`, Hatchet Lite on the project-standard local port selected during scaffold.
- `.env.example` must include `DATABASE_URL`, `BETTER_AUTH_SECRET`, Google OAuth placeholders, Resend/Mailpit config, Hatchet config, GCS local/prod placeholders, and Portal credential secret names/placeholders. (No Sentry DSN in MVP.)
- `pnpm dev` starts web.
- `pnpm dev:worker` starts the single local worker.
- `pnpm db:reset` drops/recreates local schema and runs seed.
- Seed data includes at least: one admin, two teachers, tracks/stages, active and archived classes, generated sessions, enrolled students, sample attendance, one payer with orders/installments/payments, and one failed/untaken Portal scenario.

Trace: `D-0003`, `D-0004`, `D-0006`, `D-0007`.

## 3. Cross-Cutting Rules

### 3.1 Naming and data conventions

- Database table names use Prisma model names in singular PascalCase.
- API/router names use lower camel case.
- Money fields are integer cents, BRL-only, and end in `Cents`.
- Local date fields use `DateOnly` semantics (`@db.Date`).
- Local time fields use Postgres `time`.
- Timestamps use `timestamptz`; compare product business dates in `America/Sao_Paulo`.
- `sessionEndInstant = ZonedDateTime(ClassSession.date, ClassSession.endTime, "America/Sao_Paulo")`; untaken-session and makeup no-show derivations use that instant, not date-only comparisons.
- Enums include deferred values only when accepted decisions explicitly preserve them for future enablement, e.g. `UserRole.SECRETARY` and `UserRole.FINANCE`.
- Every `*ById` attribution field is an FK to `User.id` with `ON DELETE RESTRICT`; staff are soft-disabled via `User.isEnabled`, not deleted. Prisma snippets may omit relation-field clutter, but migrations must add these FKs.

Trace: `D-0032`, `D-0005`, `D-0016`.

### 3.2 Derived values

Derived values live in `packages/domain` and are reused by tRPC, workers, tests, and report builders:

- `EnrollmentDisplayStatus = ACTIVE | CLOSED`, derived from `exitDate`.
- `PedagogicalProgressDisplayStatus = ACTIVE | CLOSED`, derived from `endDate`.
- `MakeupDisplayStatus = CANCELLED | ATTENDED | NO_SHOW | SCHEDULED`, derived from `cancelledAt`, target session cancellation, `attendedAt`, and `sessionEndInstant`.
- `InstallmentDisplayStatus = WAIVED | PAID | OVERDUE | DUE_THIS_MONTH | UPCOMING`, derived from waiver, paid amount, due date, and `America/Sao_Paulo` current month.
- `OrderDisplayStatus = CANCELLED | COMPLETED | ACTIVE`, derived from cancellation and open balance.
- `ClassCapacityDisplay = FULL | HAS_SEATS`, derived from active enrollment count and capacity.
- `UntakenSessionFlag`, derived when session end time has passed and `attendanceConfirmedAt` is null.
- `AttendancePercent`, per `(enrollment, semester)`.
- `PortalDayDisplayStatus = CLOSED | NEEDS_ATTENTION | FAILED | PARTIAL | SUBMITTED | PENDING`, derived with the precedence in Section 7.1.

No nightly status-flip jobs are allowed for these values.

Trace: `D-0029`, `D-0031`, `D-0032`, `S-REP-4`, `S-Portal-4`.

### 3.3 Database enforcement (v0.3)

There is a single trusted writer — the tRPC BFF — and operators are non-adversarial. So the DB enforces only _cheap, local_ rules, and cross-entity invariants move to the service layer. This is the largest effort cut in v0.3.

**DB-enforced (keep):**

- CHECK constraints for enum-dependent nullability, positive cents, date ordering, due-day choices.
- Partial unique indexes for active/current rows.
- Exclusion constraint for non-overlapping semesters.
- Composite unique indexes for natural duplicates.

**Service-layer-enforced (was trigger-backed):** the following cross-row/table invariants are enforced inside tRPC transactions with named domain checks (mapped to Portuguese-BR errors) and covered by tRPC/DB integration tests — _not_ DB triggers in MVP:

- Attendance session must belong to the same class as the enrollment.
- Attendance session date must be inside the enrollment window.
- REGULAR enrollment progress stage must equal the class `sharedStageId`.
- An active enrollment must have exactly one active PedagogicalProgress; a closed enrollment must have zero active PedagogicalProgress.
- PaymentAllocation installment order payer must equal PaymentEntry payer.
- PaymentAllocation sums must not exceed entry amount or installment current expected amount.
- Legacy/archive/capacity-override guards, active-enrollment-per-track, and the attendance-confirm roster-count check.

**Money serialization:** allocation/overpayment enforcement takes a `SELECT … FOR UPDATE` on the target installment (and, where relevant, the payment entry) inside the allocation transaction, so concurrent allocations cannot race past a ceiling without a trigger.

The "Raw SQL constraints" lists in §4.4–4.7 still enumerate every invariant for completeness; items phrased as `Trigger:` there are, in MVP, implemented as service-layer checks per this section unless they reduce to one of the cheap DB constraints above. Re-introduce specific triggers later only if a second writer (raw scripts, future services) is added.

Trace: house style; `D-0021`, `D-0029`, `D-0031`, `D-0032`.

### 3.4 Code Quality Guardrails

Guardrails, not guidelines: AI agents can ignore prose, but they cannot ignore compiler, linter, test, and CI failures. Sprint 0 must wire these checks to run locally and in CI after the codebase is scaffolded. This section documents the target constraints only; it does **not** require installing or configuring tools in the docs-only repository.

#### ESLint / TypeScript baseline

- Extend `eslint:recommended`, `@typescript-eslint/recommended`, and `@typescript-eslint/recommended-requiring-type-checking` with `parserOptions.project` pointing at the relevant `tsconfig`; rationale: standard JavaScript/TypeScript defects must surface everywhere, including type-aware rules.
- Use `@typescript-eslint/no-unused-vars` as `error`, with unused args caught and `argsIgnorePattern: "^_"`; turn base `no-unused-vars` off; rationale: unused arguments and variables are a strong signal of unfinished AI edits, while `_ignored` remains explicit.
- Add `eslint-plugin-unused-imports`: `unused-imports/no-unused-imports` as `error` and `unused-imports/no-unused-vars` as `warn`; rationale: unused imports are common AI residue and should be auto-removable with `--fix`.
- CI must run the full configured ESLint set and fail on promoted errors; once rollout cleanup is complete, use `--max-warnings=0`; rationale: warnings that never reach CI are only suggestions.

#### Complexity and size

- `complexity: ["error", 10]`; rationale: cyclomatic complexity above 10 usually means the agent should extract decisions into named helpers.
- `max-lines-per-function: ["error", 50, { "skipBlankLines": true, "skipComments": true }]`; rationale: function limits are more useful than file limits for forcing decomposition while the agent edits.
- `max-lines: ["error", 350, { "skipBlankLines": true, "skipComments": true }]`; rationale: oversized files hide duplicated logic and make agent edits harder to review.
- `max-depth: ["error", 4]`; rationale: deep branching is hard for humans and agents to reason about safely.
- `max-params: ["error", 2]`, with class constructors allowed up to 4 only for explicit dependency injection; rationale: object parameters with destructuring make call sites self-documenting.
- `max-statements: ["error", 20]`; rationale: long imperative blocks are where AI tends to mix responsibilities.
- `max-nested-callbacks: ["error", 3]`; rationale: nested callbacks obscure async control flow and error handling.
- `max-classes-per-file: ["error", 1]`; rationale: one class per file keeps module ownership and dependency direction visible.
- `sonarjs/cognitive-complexity: ["error", 15]` from `eslint-plugin-sonarjs`; rationale: cognitive complexity catches tangled logic better than cyclomatic complexity alone.

#### Magic values and readability

- `no-magic-numbers` as `error` with `enforceConst: true`, `ignore: [0, 1, -1, 2]`, and `ignoreArrayIndexes: true`; rationale: timeouts, retries, limits, and money-related numbers need named constants.
- `no-console: "error"`; rationale: application code must use the project logger so logs can redact PII and carry context.
- `id-length: ["error", { "min": 2 }]`, with narrow overrides only for conventional coordinates or generics; rationale: single-letter variables reduce readability and encourage copy-paste logic.
- `eqeqeq: ["error", "always"]`; rationale: implicit coercion creates subtle bugs in form, query, and import parsing code.

#### TypeScript strictness (tsconfig)

- `strict: true`; rationale: all strict TypeScript checks are the baseline, not optional polish.
- `noUncheckedIndexedAccess: true`; rationale: `arr[i]` and `record[key]` must be treated as possibly missing, which catches high-value runtime bugs not covered by `strict`.
- `exactOptionalPropertyTypes: true`; rationale: absent and explicitly `undefined` fields must not be conflated in API and Prisma input shapes.
- `noImplicitOverride: true`; rationale: subclass overrides must be intentional if classes are used.
- `noUncheckedSideEffectImports: true`; rationale: side-effect-only imports should be explicit and checked by the compiler.
- `forceConsistentCasingInFileNames: true`; rationale: casing drift passes on some machines and fails in Linux CI.
- `noUnusedLocals: true` and `noUnusedParameters: true`; rationale: the compiler is the backstop for dead code even if ESLint is bypassed.

#### TypeScript strictness (type-aware ESLint)

- `@typescript-eslint/no-explicit-any: "error"`; rationale: AI frequently uses `any` as a shortcut around the domain model.
- Enable `@typescript-eslint/no-unsafe-assignment`, `no-unsafe-call`, `no-unsafe-return`, `no-unsafe-member-access`, and `no-unsafe-argument` as errors; rationale: these rules stop `any` from leaking through the system.
- `@typescript-eslint/no-floating-promises: "error"`; rationale: un-awaited promises are a common source of skipped writes, swallowed errors, and flaky tests.
- `@typescript-eslint/explicit-function-return-type` as `error` for exported functions, tRPC procedures, worker handlers, and package boundary functions; rationale: module boundaries should not expose inferred accidental types.

#### Duplication

- Run `jscpd` in CI with a project threshold of 2% duplicated lines, `min-lines: 8`, and generated files excluded; rationale: duplicated logic is one of the highest-value AI-specific failure signals.
- `sonarjs/no-duplicate-string: ["error", 3]`; rationale: repeated literals should become constants or domain vocabulary.
- `sonarjs/no-identical-functions: "error"`; rationale: identical functions usually mean the agent copied instead of extracting shared behavior.

#### Architecture and dependency boundaries

- Use `dependency-cruiser` or `eslint-plugin-boundaries` to enforce layers: `packages/domain` must not import `ui`, `api`, or `db`; `apps/web` must not import Prisma directly; UI components must not import services or DB; workers must not import UI; rationale: architecture rules need executable boundaries, not reviewer memory.
- `import/no-cycle: "error"`; rationale: cycles create initialization bugs and make refactors unsafe.
- `import/no-restricted-paths: "error"` for forbidden cross-package imports; rationale: local exceptions should be explicit and reviewed.
- Use `no-restricted-syntax` to forbid direct `process.env` access outside the config module; rationale: configuration should be validated once and injected, not scattered through code.

#### Tests

- CI coverage thresholds: global 80% statements/lines/functions and 70% branches, with `packages/domain` at 90% statements/lines/functions and 80% branches; rationale: domain calculators and invariants are the highest-leverage test surface.
- Add Stryker mutation testing later, after the base test suite is stable; rationale: mutation testing catches tests that execute code but assert too little, a common AI-generated-test failure mode.

#### Security

- Enable `eslint-plugin-security` recommended rules; rationale: obvious insecure patterns should fail before review.
- Run `gitleaks` in CI and pre-commit where practical; rationale: secrets must not enter the repo history.
- Run dependency auditing (`pnpm audit` or the package-manager equivalent) plus Dependabot/Renovate; rationale: known vulnerable dependencies should not wait for manual discovery.
- Verify dependency existence through a clean install from the configured registry before accepting new package names; rationale: this guards against AI-hallucinated or slopsquatted packages.

#### Formatting and modern-code consistency

- Use Prettier separately from ESLint; rationale: formatting should be deterministic and not mixed with logic lint rules.
- Enable `eslint-plugin-unicorn` recommended config with explicit framework-compatible overrides; rationale: modern JavaScript consistency catches stale patterns and improves generated code quality.

#### Preventing the agent from bypassing guardrails

- Forbid inline `eslint-disable` directives using `eslint-plugin-no-inline-config`, `eslint-plugin-eslint-comments`, or an equivalent rule set; rationale: the agent must fix the code or ask for help, not hide violations.
- Add a Claude Code `PreToolUse` hook that blocks edits to ESLint config files, TypeScript config files, and guardrail hook files; rationale: if a rule blocks progress, the agent reports that to the user instead of weakening the rule.
- Add a post-edit lint feedback hook that runs lint after each edited file and feeds errors back to the agent, capped at 3 fix attempts per file; rationale: fast feedback prevents long invalid edit chains and stops infinite fix loops.

#### Optional self-documenting-code rule

- Team decision: consider disallowing ordinary comments to force better names and function extraction, while allowing JSDoc/annotations where tooling requires them; rationale: this can improve AI output, but it conflicts with legitimate API docs and should not be a default rule.

#### Rollout principle

- Introduce new guardrails as warnings first, then promote them to errors as touched code and legacy areas are cleaned up; rationale: guardrails should converge the codebase without blocking scaffold day one.
- Use per-directory overrides only for explicit legacy/generated areas, with a cleanup owner or removal condition; rationale: overrides without an exit path become permanent holes.
- Once a rule is promoted for a directory, CI treats it as a hard constraint and does not silently downgrade it; rationale: the point is guardrails, not guidelines.

## 4. Prisma Data Model

This section is the implementation contract for `packages/db/prisma/schema.prisma` plus raw SQL migrations.

### 4.0 UUIDEntity base

Every domain table in Sections 4.1–4.8 carries a shared column set. Prisma has no model inheritance, so the block is defined once here and repeated in `schema.prisma` at scaffold time (copy-paste or a thin codegen step). Model blocks below list only domain-specific fields plus a `// UUIDEntity` marker.

```prisma
// UUIDEntity — not a Prisma model; the shared column block every domain entity repeats.
//
//   id         String    @id @default(uuid()) @db.Uuid
//   createdAt  DateTime  @default(now()) @map("created_at")
//   updatedAt  DateTime  @updatedAt @map("updated_at")
//   deletedAt  DateTime? @map("deleted_at")
```

Rules:

- Primary keys are Postgres `uuid`, generated by `@default(uuid())` (backed by `gen_random_uuid()`).
- DB columns use snake_case via `@map`; application code uses camelCase Prisma field names.
- `deleted_at` enables soft delete. Default reads filter `deletedAt IS NULL` via a Prisma client extension in `packages/db`.
- Hard `DELETE` is reserved for dev resets and migration cleanup, not product flows.
- **Exceptions:** Better Auth adapter tables (owned by Better Auth, not this pattern); `FinanceSettings` singleton (fixed string PK `"singleton"`, no `deleted_at`).

TypeScript mirror in `packages/db`:

```typescript
/** Shared shape for all domain entities. */
export type UUIDEntity = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};
```

Trace: house style.

### 4.1 Auth and staff

```prisma
enum UserRole {
  ADMIN
  SECRETARY
  TEACHER
  FINANCE
}

model User {
  // UUIDEntity
  email       String   @unique
  name        String
  role        UserRole
  isEnabled   Boolean  @default(true)

  taughtClasses Class[] @relation("ClassTeacher")
}
```

Better Auth owns its adapter tables (`Account`, `Session`, `Verification` or generated equivalent). Authorization always joins the Better Auth identity to `User.email`; unknown or disabled users are rejected.

MVP enables only `ADMIN` and `TEACHER`. `SECRETARY` and `FINANCE` remain enum values for future role split but cannot be assigned in UI while disabled by config.

Session rules:

- Session duration is 30 days.
- Header includes a sign-out action (**UI in P01** — GRE-58; backend sign-out endpoint in GRE-15).
- tRPC context exposes `ctx.staffUser = { id: User.id, email, role, isEnabled }`; Better Auth's own user/session ID is never used for domain resource checks.

Trace: `S-AUTH-1`, `S-AUTH-2`; `D-0005`, `D-0016`.

### 4.2 Students

```prisma
enum StudentStatus {
  ACTIVE
  INACTIVE
  DROPPED
  SUSPENDED
}

enum DocumentType {
  CPF
  RG
}

model Student {
  // UUIDEntity
  fullName           String
  phone              String?
  email              String?
  birthDate          DateTime?     @db.Date
  documentType       DocumentType?
  documentNumber     String?
  addressId          String?
  guardianId         String?
  status             StudentStatus @default(ACTIVE)
  notes              String?

  address            Address?      @relation(fields: [addressId], references: [id], onDelete: SetNull)
  guardian           Guardian?     @relation(fields: [guardianId], references: [id], onDelete: SetNull)
  enrollments        Enrollment[]
  orderLinks         OrderBeneficiary[]
}

model Guardian {
  // UUIDEntity
  fullName       String
  relationship   String?
  documentType   DocumentType?
  documentNumber String?
  phone          String?
  email          String?
  addressId      String?

  address        Address?      @relation(fields: [addressId], references: [id], onDelete: SetNull)
  students       Student[]
}

model Address {
  // UUIDEntity
  street       String?
  number       String?
  complement   String?
  neighborhood String?
  city         String?
  state        String?
  postalCode   String?

  students     Student[]
  guardians    Guardian[]
}
```

Rules:

- `fullName` is preserved verbatim from Legacy import because Portal matching currently depends on names.
- Search uses Postgres trigram indexes over `fullName`, phone, email, and current class code; no normalized name column is part of the domain model.
- **`Guardian` is a first-class entity** ([D-0033](./decisions.md#d-0033-structured-guardian-and-address-entities)), replacing the former free-text `responsibleText`. `Student.guardianId` is a many-to-one FK, so siblings may share one `Guardian` row. It is the **pedagogical/contact** guardian ("who to call about the kid") and is kept **structurally distinct** from the finance `Payer` (the billing party) — there is no FK between them ([D-0025](./decisions.md#d-0025-payer-as-a-first-class-entity)).
- `Guardian.relationship` is the _grau de parentesco_ (e.g. `Mãe`, `Pai`, `Avó`), free text in MVP — not an enum.
- If `birthDate` means the student is a minor, `guardianId` is required by tRPC validation. DB enforcement uses a trigger because age depends on current date.
- **`documentType` + `documentNumber` are paired** (on both `Student` and `Guardian`): if `documentNumber` is set, `documentType` must be set, enforced by tRPC validation and a CHECK constraint (`documentNumber IS NULL` OR `documentType IS NOT NULL`). One document per person — `CPF` (the tax/legal id, also used by `Payer.taxId`) or `RG`. Legacy's separate RG/CPF columns are collapsed to the populated one by the ad hoc import script; discarded source values are not persisted as raw import data.
- **`Address` is a shared, optional FK** ([D-0033](./decisions.md#d-0033-structured-guardian-and-address-entities)): both `Student` and `Guardian` may point at the **same** `Address` row when they cohabit, or hold independent rows. Editing a shared row affects both holders by design; the UI must surface this. `onDelete: SetNull` keeps the holder when an address is removed. Address fields use Brazilian shape (`street`/logradouro, `number`/Nº, `complement`, `neighborhood`/bairro, `city`, `state`/UF, `postalCode`/CEP).
- Setting `status = SUSPENDED` closes active enrollments and active progress in the same transaction. Billing is not mutated automatically.
- Deferrable trigger: a `DROPPED` or `SUSPENDED` student may not have active enrollments or active progress after the status-change transaction.
- No per-field edit attribution on `Student` in MVP ([D-0035](./decisions.md#d-0035-defer-student-field-level-traceability)); rastreabilidade comes later.
- `doNotContact` is P1 (`S-NOT-4`) and is intentionally not in the P0 schema.

Trace: see Section 12.

### 4.3 Course catalog

```prisma
enum CatalogStatus {
  ACTIVE
  LEGACY
}

model ProductLine {
  // UUIDEntity
  key          String
  name         String
  status       CatalogStatus @default(ACTIVE)
  portalPrefix String?
  tracks       Track[]

  @@unique([key])
  @@unique([name])
}

model Track {
  // UUIDEntity
  productLineId String
  name          String
  status        CatalogStatus @default(ACTIVE)
  portalPrefix String?
  productLine  ProductLine @relation(fields: [productLineId], references: [id])
  stages       Stage[]

  @@unique([productLineId, name])
}

model Stage {
  // UUIDEntity
  trackId      String
  name         String
  internalCode String
  sequence     Int

  track        Track @relation(fields: [trackId], references: [id])

  @@unique([trackId, internalCode])
  @@unique([trackId, sequence])
}
```

Rules:

- Seed-only in MVP. No CRUD UI.
- `ProductLine` classifies product labels as seed data instead of a schema enum. Initial rows: `adult` (Adultos), `kids` (Infantil), `teens` (legacy Teens), `teens_connect` (Teens Connect), and `teenstation` (legacy Teenstation). Speed and Espanol are active tracks under Adultos.
- One `Track` row per progression path from [discovery/course-stage-ordering.md](../discovery/course-stage-ordering.md): Adultos / English Main, Adultos / Speed, Adultos / Espanol, Infantil, Teens Legacy, Teens Connect, and Teenstation Legacy.
- **Tracks are independent.** No `sequence` on `Track`; no cross-track ordering or equivalence model. Some real-world equivalences exist (e.g. Speed ↔ adult English) but are hard to model and the operational gain is small — staff pick the target track/stage explicitly when needed.
- **Stage ordering only:** `Stage.sequence` is the linear order within one track. Next stage = same track, `sequence + 1`.
- `Track.status = LEGACY` blocks new classes/enrollments but allows existing rows to keep working.
- No equivalence/branching model.

Trace: `S-CAT-1`, `S-ENR-4`; `D-0030`, `D-0031`.

### 4.4 Calendar, classes, and sessions

```prisma
enum Weekday {
  MONDAY
  TUESDAY
  WEDNESDAY
  THURSDAY
  FRIDAY
  SATURDAY
  SUNDAY
}

enum ClassScheduleType {
  REGULAR
  PERSONALIZED
}

enum ClassFormat {
  IN_PERSON
  ONLINE
}

enum ClassStatus {
  ACTIVE
  ARCHIVED
}

enum ClassSessionStatus {
  SCHEDULED
  CANCELLED
}

model Semester {
  // UUIDEntity
  name      String   @unique
  startDate DateTime @db.Date
  endDate   DateTime @db.Date
}

model SchoolClosedDay {
  // UUIDEntity
  date      DateTime @unique @db.Date
  reason    String
  createdById String?
}

model Class {
  // UUIDEntity
  internalCode          String            @unique
  teacherId             String
  scheduleType          ClassScheduleType
  format                ClassFormat
  sharedStageId         String?
  semesterId            String?
  year                  Int
  capacity              Int
  status                ClassStatus       @default(ACTIVE)
  previousClassId       String?
  portalClassName          String
  originalPortalClassName  String?

  teacher               User              @relation("ClassTeacher", fields: [teacherId], references: [id])
  sharedStage           Stage?            @relation(fields: [sharedStageId], references: [id])
  semester              Semester?         @relation(fields: [semesterId], references: [id])
  previousClass         Class?            @relation("ClassLineage", fields: [previousClassId], references: [id])
  nextClasses           Class[]           @relation("ClassLineage")
  scheduleSlots         ClassScheduleSlot[]
  sessions              ClassSession[]
  enrollments           Enrollment[]
}

model ClassScheduleSlot {
  // UUIDEntity
  classId   String
  weekday   Weekday
  startTime DateTime @db.Time
  endTime   DateTime @db.Time

  class     Class    @relation(fields: [classId], references: [id])
  sessions  ClassSession[]

  @@unique([classId, weekday, startTime, endTime])
  @@unique([classId, id])
}

model ClassSession {
  // UUIDEntity
  classId               String
  scheduleSlotId        String?
  date                  DateTime           @db.Date
  startTime             DateTime           @db.Time
  endTime               DateTime           @db.Time
  status                ClassSessionStatus @default(SCHEDULED)
  cancelReason          String?
  cancelledAt           DateTime?
  cancelledById         String?
  attendanceConfirmedAt DateTime?
  attendanceConfirmedById String?
  attendanceLastCommittedAt DateTime?
  portalSubmittedAt       DateTime?

  class                 Class              @relation(fields: [classId], references: [id])
  scheduleSlot          ClassScheduleSlot? @relation(fields: [scheduleSlotId], references: [id])
  attendanceRows        Attendance[]
  makeups               Makeup[]
  portalRuns               PortalRun[]

  // Raw SQL adds partial unique indexes because scheduleSlotId is nullable.
}

model PortalRun {
  // UUIDEntity
  classSessionId        String
  queuedAt              DateTime
  attemptedAt           DateTime?
  succeededAt           DateTime?
  failedAt              DateTime?
  errorCode             String?
  errorMessage          String?
  jobId                 String?

  classSession          ClassSession       @relation(fields: [classSessionId], references: [id])

  @@index([classSessionId, queuedAt])
  @@index([jobId])
}
```

Raw SQL constraints:

- `Semester.startDate <= Semester.endDate`.
- Semesters do not overlap: exclusion constraint on `daterange(startDate, endDate, '[]')`.
- `Class.capacity > 0`.
- `Class.scheduleType = REGULAR` implies `sharedStageId IS NOT NULL`.
- `Class.scheduleType = PERSONALIZED` implies `sharedStageId IS NULL`.
- `Class.scheduleType = REGULAR` implies `semesterId IS NOT NULL`.
- `Class.scheduleType = PERSONALIZED` implies `semesterId IS NOT NULL` (amended 2026-07-04 — both modalities generate sessions from the same `Semester` window; see [D-0008](./decisions.md#d-0008-rolling-enrollment-and-contract-periods)).
- Trigger: new classes on `LEGACY` tracks are rejected unless the transaction is flagged as import/correction.
- Partial unique index: active classes have unique `portalClassName`; archived classes may retain historical reused names.
- `ClassScheduleSlot.startTime < ClassScheduleSlot.endTime`.
- Composite FK: `(ClassSession.classId, ClassSession.scheduleSlotId) -> ClassScheduleSlot(classId, id)` when `scheduleSlotId IS NOT NULL`.
- Partial unique index for generated sessions: `(classId, scheduleSlotId, date)` where `scheduleSlotId IS NOT NULL`.
- Partial unique index for ad-hoc/manual sessions: `(classId, date, startTime, endTime)` where `scheduleSlotId IS NULL`.
- Trigger: when `scheduleSlotId IS NOT NULL`, session weekday/start/end match the referenced slot.
- `ClassSession.startTime < ClassSession.endTime`.
- `ClassSession.status = CANCELLED` implies `cancelReason IS NOT NULL` and `cancelledAt IS NOT NULL`.
- `ClassSession.status = SCHEDULED` implies `cancelledAt IS NULL`.
- Trigger: a session cannot be cancelled if `attendanceConfirmedAt` or `portalSubmittedAt` is set. Corrections to already-held/submitted sessions require an explicit future correction flow, not ordinary cancellation.
- `PortalRun` records Portal queue/attempt/outcome facts for one `ClassSession`. At most one of `succeededAt` and `failedAt` may be set; `errorCode`/`errorMessage` require `failedAt`.
- Trigger/report guard: a generated session date must map to exactly one `Semester` before attendance can be confirmed or attendance summaries/reports can be calculated. Unbucketed sessions surface as setup errors; they are never silently omitted.

Rules:

- `ARCHIVED` classes are hidden from active pickers, do not accept new enrollments, and do not generate future sessions. History remains visible through archive filters.
- `semesterId` is required for session generation on **both** REGULAR and PERSONALIZED classes. Generation window = the bound `Semester.startDate`…`endDate` for every weekday slot; closed days are skipped. ~~PERSONALIZED ~90-day rolling horizon + nightly cron extension~~ is deprecated ([D-0008](./decisions.md#d-0008-rolling-enrollment-and-contract-periods), [changelog #52](./CHANGELOG.md)).
- Creating a future `SchoolClosedDay` cancels matching future scheduled sessions with no committed attendance; sessions with committed attendance are not auto-cancelled and are returned as warnings.
- Cancelling a session cascades active target makeups to cancelled, so a cancelled target session never derives as makeup no-show.
- Re-opening a closed day regenerates missing scheduled sessions idempotently.
- Session generation is idempotent by the generated/ad-hoc unique indexes above.

Trace: `S-CLS-1`, `S-CLS-2`, `S-CAL-1`, `S-CAL-2`, `S-CAL-4`; `D-0008`, `D-0015`, `D-0021`, `D-0022`, `D-0030`.

### 4.5 Enrollment and pedagogical progress

```prisma
enum EnrollmentExitReason {
  COMPLETED
  TRANSFERRED
  DROPPED
  SUSPENDED
  CORRECTION
}

enum ProgressEndReason {
  ADVANCED
  TRANSFERRED
  DROPPED
  SUSPENDED
  CORRECTION
}

model Enrollment {
  // UUIDEntity
  studentId              String
  classId                String
  entryDate              DateTime              @db.Date
  exitDate               DateTime?             @db.Date
  exitReason             EnrollmentExitReason?
  capacityOverrideReason String?

  student                Student               @relation(fields: [studentId], references: [id])
  class                  Class                 @relation(fields: [classId], references: [id])
  progressRecords        PedagogicalProgress[]
  attendanceRows         Attendance[]
  makeups                Makeup[]
}

model PedagogicalProgress {
  // UUIDEntity
  enrollmentId String
  stageId      String
  startDate    DateTime           @db.Date
  endDate      DateTime?          @db.Date
  endReason    ProgressEndReason?

  enrollment   Enrollment         @relation(fields: [enrollmentId], references: [id])
  stage        Stage              @relation(fields: [stageId], references: [id])
}
```

Raw SQL constraints:

- `Enrollment.exitDate IS NULL` iff `exitReason IS NULL`; `exitDate >= entryDate` when set.
- Partial unique index: one active enrollment per `(studentId, classId)` where `exitDate IS NULL`.
- Trigger: no more than one active enrollment per `(studentId, trackId)`, where `trackId` is reached through the enrollment's active PedagogicalProgress stage. This allows intentional concurrent study in different tracks, but prevents duplicate active enrollment in the same track.
- Trigger: new enrollments are rejected for `ARCHIVED` classes.
- Trigger: new enrollments are rejected for stages on `LEGACY` tracks unless the transaction is flagged as import/correction.
- Trigger: if active enrollment count exceeds class capacity, `capacityOverrideReason` is required.
- `PedagogicalProgress.endDate IS NULL` iff `endReason IS NULL`; `endDate >= startDate` when set.
- Partial unique index: one active PedagogicalProgress per `enrollmentId` where `endDate IS NULL`.
- Exclusion constraint: progress date windows for the same enrollment do not overlap.
- Trigger: an active enrollment must have exactly one active PedagogicalProgress after enrollment/progress mutations; a closed enrollment must have zero active PedagogicalProgress.
- Trigger: for REGULAR class enrollments, active progress `stageId` equals class `sharedStageId`.
- Trigger: `PedagogicalProgress` date window is inside its enrollment window.

Rules:

- Enrolling into REGULAR creates active progress at the class `sharedStageId`.
- Enrolling into PERSONALIZED requires the operator to choose an initial `Stage`.
- Transferring closes enrollment and progress, then opens a new enrollment and new progress.
- Advancing a PERSONALIZED student closes the active progress with `ADVANCED`, opens the next stage, and leaves enrollment open.
- REGULAR progression happens through clone-for-next-period: old enrollment/progress close, successor class/enrollment/progress open.

Trace: see Section 12.

### 4.6 Attendance and makeups

```prisma
enum AttendanceStatus {
  PRESENT
  ABSENT
}

model Attendance {
  // UUIDEntity
  enrollmentId    String
  classSessionId  String
  status          AttendanceStatus
  recordedAt      DateTime         @default(now())
  recordedById    String?
  notes           String?
  lastModifiedAt  DateTime?
  lastModifiedById String?

  enrollment      Enrollment       @relation(fields: [enrollmentId], references: [id])
  classSession    ClassSession     @relation(fields: [classSessionId], references: [id])

  @@unique([enrollmentId, classSessionId])
}

model Makeup {
  // UUIDEntity
  originEnrollmentId   String
  targetClassSessionId String
  scheduledAt          DateTime     @default(now())
  scheduledById        String?
  reason               String?
  attendedAt           DateTime?
  attendedById         String?
  cancelledAt          DateTime?
  cancelledById        String?
  cancellationReason   String?

  originEnrollment     Enrollment   @relation(fields: [originEnrollmentId], references: [id])
  targetClassSession   ClassSession @relation(fields: [targetClassSessionId], references: [id])

  @@unique([originEnrollmentId, targetClassSessionId])
}
```

Raw SQL constraints:

- Trigger: Attendance session class equals Enrollment class.
- Trigger: Attendance session date is in enrollment window.
- Trigger: Attendance rows can only be written for non-cancelled sessions.
- Deferrable trigger on `ClassSession.attendanceConfirmedAt`: active roster count must exactly equal Attendance rows for that session; all rows must be scoped to the session class/window; all statuses must be `PRESENT` or `ABSENT`; committed rows must have `recordedAt`.
- Trigger: Makeup target session date must be at least tomorrow in `America/Sao_Paulo` at scheduling time.
- Trigger: Makeup target class differs from origin enrollment class unless an admin override is explicitly recorded in `reason`.
- `Makeup.cancelledAt IS NULL OR attendedAt IS NULL` unless a future decision allows cancel-after-attended corrections.
- `MakeupDisplayStatus = CANCELLED` if the makeup row is cancelled or the target session is cancelled; `ATTENDED` if `attendedAt` is set; `NO_SHOW` if `sessionEndInstant` has passed and neither cancellation nor attendance is set; otherwise `SCHEDULED`.

Attendance confirm transaction:

1. Load active enrollments for session class where session date is in enrollment window.
2. Read the confirm payload from the client. Missing active enrollments mean `PRESENT`; explicit absent selections become `ABSENT`.
3. Upsert one committed `Attendance` row per active enrollment with `PRESENT` or `ABSENT`.
4. Stamp each committed row `recordedAt` and `recordedById` for staff actions.
5. Stamp `ClassSession.attendanceConfirmedAt`, `attendanceConfirmedById`, and `attendanceLastCommittedAt`.

Admin edits after confirmation:

- Update committed Attendance rows directly.
- Stamp row `lastModifiedAt`/`lastModifiedById`.
- Update `ClassSession.attendanceLastCommittedAt`.
- Portal retry eligibility derives from `portalSubmittedAt IS NULL OR attendanceLastCommittedAt > portalSubmittedAt`.

Attendance percentage:

```text
held_sessions =
  sessions for enrollment.class
  where session.date in Semester window
  and session.date in Enrollment window
  and session.status != CANCELLED
  and session.attendanceConfirmedAt is not null

present_count =
  Attendance rows for those sessions where status = PRESENT

attendance_percent =
  if held_sessions = 0: null ("sem dados")
  else present_count / held_sessions

flagged =
  held_sessions > 0 and attendance_percent < 0.75
```

Makeups do not affect numerator or denominator.

Trace: see Section 12.

### 4.7 Finance

```prisma
enum InstallmentAdjustmentType {
  INTEREST
  LATE_FEE
  DISCOUNT
  CORRECTION
}

enum PaymentMethod {
  PIX
  CASH
  TRANSFER
  CARD
  CHEQUE
  BOLETO
  OTHER
}

model FinanceSettings {
  id                     String   @id @default("singleton")
  interestRatePctMonthly Decimal  @default(1.0) @db.Decimal(5, 2)
  updatedAt              DateTime @updatedAt @map("updated_at")
  updatedById            String?
}

model Payer {
  // UUIDEntity
  name      String
  taxId     String?
  phone     String?
  email     String?

  orders    Order[]
  payments  PaymentEntry[]
}

model Order {
  // UUIDEntity
  payerId              String
  principalAmountCents Int
  startDate            DateTime          @db.Date
  dueDay               Int
  signedOrderArtifactId String?
  cancelledAt          DateTime?
  cancelledReason      String?

  payer                Payer             @relation(fields: [payerId], references: [id])
  beneficiaries        OrderBeneficiary[]
  installments         Installment[]
}

model OrderBeneficiary {
  // UUIDEntity
  orderId   String
  studentId String

  order     Order   @relation(fields: [orderId], references: [id])
  student   Student @relation(fields: [studentId], references: [id])

  @@unique([orderId, studentId])
}

model Installment {
  // UUIDEntity
  orderId      String
  amountCents  Int
  dueDate      DateTime @db.Date
  waivedAt     DateTime?
  waivedReason String?
  overdueD30EmailSentAt DateTime?

  order        Order    @relation(fields: [orderId], references: [id])
  adjustments  InstallmentAdjustment[]
  allocations  PaymentAllocation[]
}

model InstallmentAdjustment {
  // UUIDEntity
  installmentId  String
  type           InstallmentAdjustmentType
  amountCents    Int
  reason         String?
  createdById    String?

  installment    Installment               @relation(fields: [installmentId], references: [id])
}

model PaymentEntry {
  // UUIDEntity
  payerId           String
  date              DateTime            @db.Date
  amountCents       Int
  method            PaymentMethod
  note              String?
  externalReference String?
  createdById       String?

  payer             Payer               @relation(fields: [payerId], references: [id])
  allocations       PaymentAllocation[]
}

model PaymentAllocation {
  // UUIDEntity
  paymentEntryId String
  installmentId  String
  amountCents    Int

  paymentEntry   PaymentEntry @relation(fields: [paymentEntryId], references: [id])
  installment    Installment  @relation(fields: [installmentId], references: [id])

  @@unique([paymentEntryId, installmentId])
}
```

Collection attempts (`S-FIN-4`) are P1 and intentionally have no P0 table. When promoted, add a separate migration and keep P0 dashboards/reports independent of it.

Raw SQL constraints:

- All `*Cents` fields on principal, installment, payment, allocation are `>= 0`.
- `InstallmentAdjustment.amountCents` is signed; for `INTEREST`/`LATE_FEE`, it must be `> 0`; for `DISCOUNT`, it must be `< 0`; `CORRECTION` may be either sign but not zero.
- `Order.dueDay IN (5, 10, 15, 20, 25)`.
- `Order.principalAmountCents > 0`.
- Each order has at least one `OrderBeneficiary` before commit (deferrable trigger).
- Sum of generated installments equals `Order.principalAmountCents` at creation.
- `PaymentEntry.amountCents >= sum(PaymentAllocation.amountCents)` by trigger.
- `sum(PaymentAllocation.amountCents for installment) <= currentExpectedCents` by trigger.
- Allocated installment's order payer equals payment entry payer by trigger.
- Waiver is allowed only when current remaining amount is `> 0`.
- No new allocations may be created for an installment after `waivedAt` is set.
- Triggers on `InstallmentAdjustment`, `PaymentAllocation`, waiver, and installment updates enforce `currentExpectedCents >= 0` and `paidAmountCents <= currentExpectedCents`, so a later negative adjustment cannot make an already-paid installment retroactively overpaid.
- `overdueD30EmailSentAt` is a delivery idempotency fact for hardcoded `S-NOT-2`; it is not a notification-rule engine.
- `FinanceSettings` is a singleton table. `interestRatePctMonthly` defaults to `1.0`; multa remains open and is not modeled until the school validates the rate/policy.
- `Order.signedOrderArtifactId`, when set, references a `GeneratedArtifact` with `kind = SIGNED_ORDER_PDF`.

Derived formulas:

```text
paidAmountCents = sum(PaymentAllocation.amountCents)
currentExpectedCents = Installment.amountCents + sum(InstallmentAdjustment.amountCents)
rawRemainingCents = currentExpectedCents - paidAmountCents
collectibleInstallment = Order.cancelledAt IS NULL AND Installment.waivedAt IS NULL
collectibleRemainingCents =
  if collectibleInstallment then max(rawRemainingCents, 0)
  else 0

InstallmentDisplayStatus:
  WAIVED if waivedAt is not null
  PAID if paidAmountCents >= currentExpectedCents
  OVERDUE if dueDate < today(America/Sao_Paulo)
  DUE_THIS_MONTH if dueDate is in current calendar month(America/Sao_Paulo)
  UPCOMING otherwise

Order.openBalanceCents =
  sum(collectibleRemainingCents)

OrderDisplayStatus:
  CANCELLED if cancelledAt is not null
  COMPLETED if openBalanceCents = 0
  ACTIVE otherwise

PaymentEntry.unallocatedRemainderCents =
  PaymentEntry.amountCents - sum(PaymentAllocation.amountCents)

interestPreviewCents =
  if dueDate >= today(America/Sao_Paulo) then 0
  else floor(collectibleRemainingCents * (interestRatePctMonthly / 100) * overdueDays / 30);
  never auto-accrued, persisted only if staff creates an INTEREST adjustment
```

Interest-preview assumption: simple, non-compounding, pro-rata 30-day month. It is for display only; actual charged interest is whatever staff records as an `INTEREST` adjustment.

Cancelled orders are excluded from receivables snapshots, overdue lists, overdue digest emails, D+30 emails, and overdue CSVs. Their historical installments remain visible on the order/student statement as non-collectible history.

Order edit cutoff:

- Editable only while none of its installments has a payment allocation, waiver, or adjustment.
- After cutoff, use cancel + recreate, waiver, or adjustment.

Trace: see Section 12.

### 4.8 Artifacts and workflow facts

```prisma
enum ArtifactKind {
  STUDENT_STATEMENT_PDF
  CLASS_ROSTER_PDF
  ATTENDANCE_SUMMARY_PDF
  OVERDUE_RECEIVABLES_CSV
  MONTHLY_ACCOUNTANT_CSV
  SIGNED_ORDER_PDF
}

model GeneratedArtifact {
  // UUIDEntity
  kind           ArtifactKind
  requestedById  String?
  studentId      String?
  classId        String?
  orderId        String?
  storageBucket  String?
  storageObject  String?
  contentType    String?
  fileName       String?
  requestedAt    DateTime     @default(now())
  startedAt      DateTime?
  completedAt    DateTime?
  failedAt       DateTime?
  errorCode      String?
  errorMessage   String?
  expiresAt      DateTime?
}
```

Rules:

- Store GCS object keys, not public URLs.
- Downloads use signed URLs generated on demand.
- `expiresAt` remains nullable until artifact retention is decided.
- Worker logs and error messages must not include student PII. Use IDs and artifact IDs.

Trace: `S-FIN-7`, `S-REP-1`, `S-REP-2`, `S-REP-3`, `S-REP-4`; `D-0003`, `D-0004`, Security and Data Rules.

## 5. tRPC BFF

### 5.1 Router organization

```text
appRouter
  auth
  users
  students
  catalog
  classes
  calendar
  enrollment
  attendance
  portal
  finance
  reports
  dashboard
```

Procedure rules:

- All mutations are authenticated.
- All write procedures run in a transaction when touching more than one aggregate.
- All cross-entity lifecycle actions are exposed as intentful mutations, not generic row edits. Examples: `students.suspend`, `enrollment.transfer`, `enrollment.advanceStage`, `attendance.confirmSession`, `finance.allocatePayment`.
- tRPC returns derived display values from domain calculators; clients do not reimplement formulas.
- Validation errors are Portuguese-BR and map DB constraint names to user-facing copy.
- Auth middleware resolves `ctx.staffUser` from the Better Auth email. Role/resource middleware uses `ctx.staffUser.id`, never the Better Auth adapter user ID.

Trace: `D-0002`, `D-0016`, all P0 stories.

### 5.2 RBAC matrix

| Router       |                      ADMIN |                                                                      TEACHER |
| ------------ | -------------------------: | ---------------------------------------------------------------------------: |
| `users`      |  full MVP staff management |                                                                         none |
| `students`   |                       full | read only for students in own class roster, if needed for attendance context |
| `catalog`    | read; seed/dev writes only |                                   read current stages for own roster context |
| `classes`    |                       full |                                                             read own classes |
| `calendar`   |                       full |                                                            read own sessions |
| `enrollment` |                       full |                                                        read own class roster |
| `attendance` |             full; any date |                                       own class sessions; same-day edit only |
| `portal`     |  enqueue/retry/read health |                                                                         none |
| `finance`    |                       full |                                                                         none |
| `reports`    |                       full |                                                    own class roster PDF only |
| `dashboard`  |            admin dashboard |                                                            teacher home only |

Teacher resource scope:

```text
Class.teacherId == ctx.staffUser.id
```

No substitute/co-teacher resource scope exists in MVP because substitute assignment is deferred.

Trace: `S-AUTH-2`, `S-ATT-4`, `S-ATT-5`, `S-DASH-3`; `D-0015`, `D-0016`.

### 5.3 Key procedures

Students:

- `students.search(query)` — P0, covers `S-STU-2`.
- `students.byId(id)` — P0, covers `S-STU-3`; returns contact, current/past classes, attendance summary, open order/installment status, payment history, notes, and a `wa.me/55...` click-to-chat URL when phone is present.
- `students.create(input)` — P0, covers `S-STU-4`.
- `students.updateContact(id, input)` — P0, covers `S-STU-3`/`S-STU-4`.
- `students.updateNotes(id, notes)` — P0, covers `S-STU-3`.
- `students.setStatus(id, status)` — P0 for setting allowed statuses and `SUSPENDED` cascade.
- Legacy import is not an app procedure in MVP; it is the developer script in Section 9.2.

Classes/calendar:

- `classes.create(input)` — P0, covers `S-CLS-1`.
- `classes.archive(id)` — P0 lifecycle support for `S-CLS-1`.
- `classes.cloneForNextPeriod(id, input)` — P0, REGULAR stage advancement mechanism from `S-CLS-1`.
- `calendar.createSemester(input)` — P0, covers `S-CAL-4`. On success, enqueues `sessions-generate` for all ACTIVE classes bound to the new semester (async; same workflow as `classes.generateSessions`).
- `calendar.importBrazilFederalHolidays(year)` — P0, covers the federal holiday bulk import in `S-CAL-1`.
- `calendar.addClosedDay(date, reason)` — P0, covers `S-CAL-1`.
- `calendar.removeClosedDay(date)` — P0, covers `S-CAL-1`.
- `calendar.cancelSession(sessionId, reason)` — P0, covers `S-CAL-2`.
- `classes.generateSessions(classId|semesterId)` — P0, covers `S-CLS-2`. **Enqueues** the `sessions-generate` Hatchet workflow and returns immediately with a job reference; it does **not** create `ClassSession` rows inline in the request thread.

Enrollment/progress:

- `enrollment.create(input)` — P0, covers `S-ENR-1`.
- `enrollment.advanceStage(enrollmentId)` — P0, covers `S-ENR-4`.
- `enrollment.transfer(input)` — P1, covers `S-ENR-2`; schema constraints exist now, endpoint can wait.
- `enrollment.close(input)` — P1, covers `S-ENR-3`; resolved assumption: academic close/drop/pause makes no automatic billing mutation and links staff to manual waiver/adjustment/order-cancel tools if needed. This follows the house style and `D-0024`/`D-0032`; it does not implement the older auto-waiver prompt literally.

Attendance:

- `attendance.sessionRoster(sessionId)` — P0, covers `S-ATT-1`/`S-ATT-2`.
- `attendance.confirmSession(sessionId, rows)` — P0 explicit confirm for `S-ATT-1`; no server-side draft/autosave in MVP.
- `attendance.adminEdit(sessionId, rows)` — P0, covers `S-ATT-5`.
- `attendance.scheduleMakeup(input)` — P0, covers `S-ATT-3`.
- `attendance.cancelMakeup(id, reason)` — P0 support for `S-ATT-3`.
- `attendance.markMakeupOutcome(id, attended)` — P0, covers `S-ATT-2`.

Portal:

- `portal.health(range)` — P0, covers `S-Portal-4`.
- `portal.enqueueDaily(date?)` — gated P0, enabled only if Sprint-0 Portal exit criteria choose automated or assisted submit mode.
- `portal.enqueueSession(sessionId)` — gated P0, covers `S-Portal-3` after Portal mode is chosen.

Finance:

- `finance.createPayer` — P0, supports `S-FIN-1`.
- `finance.createOrder` — P0, covers `S-FIN-1`.
- `finance.orderById` — P0, covers `S-FIN-2`.
- `finance.createPaymentEntry` — P0, covers `S-FIN-3`.
- `finance.allocatePayment` — P0, covers `S-FIN-3`.
- `finance.batchReconcile` — P0, covers `S-FIN-3`.
- `finance.receivablesSnapshot` — P0, covers `S-FIN-6`.
- `finance.overdueList` — P0, covers `S-FIN-6`.
- `finance.waiveInstallment` — P1, covers `S-FIN-5`; `Installment.waivedAt` remains in schema because `D-0032` defines the ledger backbone.
- `finance.addInstallmentAdjustment` — P1/minimal-admin, covers `S-FIN-8` and actual charged interest/multa; the adjustment table remains in schema because `D-0032` defines the ledger backbone.

Reports:

- `reports.requestStudentStatement` — P0, covers `S-FIN-7`.
- `reports.requestClassRoster` — P0, covers `S-REP-3`.
- `reports.requestAttendanceSummary` — P0, covers `S-REP-4`.
- `reports.requestOverdueCsv` — P0, covers `S-REP-1`.
- `reports.requestMonthlyAccountantCsv` — P0, covers `S-REP-2`.
- `reports.getArtifact` — P0 artifact retrieval.

Trace: see Section 12.

## 6. Background Jobs

### 6.1 Job payload rule

Hatchet payloads carry IDs and non-PII flags only. No student names, phone numbers, emails, payer names, or notes in payloads/logs.

Trace: Security and Data Rules; `D-0004`.

### 6.2 Workflows

`sessions-generate`

- **Scope:** P0 for MVP session row creation. Distinct from `portal-submit`, `report-generate`, and other Hatchet workflows — session generation is **not** a nightly cron in MVP.
- **Trigger:** (1) semester creation (`calendar.createSemester`), (2) explicit regenerate via `classes.generateSessions(classId|semesterId)`, (3) closed-day reopen that calls the same regenerate path. ~~Nightly rolling horizon for PERSONALIZED classes~~ is **deprecated** ([D-0008](./decisions.md#d-0008-rolling-enrollment-and-contract-periods)).
- **Input:** `semesterId?`, `classId?` (exactly one scope path per run — all ACTIVE classes for a semester, or one class). ~~`horizonDays`~~ removed.
- **Execution:** 100% asynchronous — the tRPC procedure only enqueues; the worker writes rows.
- **Behavior:** writes `ClassSession` rows idempotently for every `(class, scheduleSlot, date)` in `Semester.startDate`…`endDate` where the weekday matches; applies to REGULAR and PERSONALIZED equally.
- Skips `SchoolClosedDay`.
- Emits setup errors for any generated date that maps to zero or multiple semesters.

`portal-submit`

- Deployment mode is chosen after Sprint-0 Portal exit criteria:
  - `automated`: Hatchet cron at 02:00 `America/Sao_Paulo` is enabled.
  - `assisted`: unattended cron is disabled; staff enqueue from the app with a human-present Portal session.
  - `not viable`: Portal submit procedures remain hidden and S-Portal-1 is re-planned before implementation.
- Trigger: automated cron when enabled, manual session retry, manual day enqueue.
- Input: `date?` or `classSessionIds`.
- Eligibility: `SCHEDULED`, not cancelled, `attendanceConfirmedAt IS NOT NULL`, and (`portalSubmittedAt IS NULL` or `attendanceLastCommittedAt > portalSubmittedAt`).
- Skips untaken sessions and records them for health-card display.
- Adapter: production contract follows accepted docs: Playwright with shared school credential and class-name/name matching. Direct JSON API and `cdAluno` matching remain Sprint-0 spike candidates only until PRD/decisions are amended.
- Enqueue creates one `PortalRun` per targeted session with `queuedAt` and `jobId` when available.
- Attempt start stamps `PortalRun.attemptedAt`.
- Success stamps `PortalRun.succeededAt` and `ClassSession.portalSubmittedAt`.
- Failure stamps `PortalRun.failedAt`, `errorCode`, and non-PII `errorMessage`; sends Portal failure email. (No Sentry in MVP — failures rely on the email + host logs.)
- Portal is best-effort: a wrong or skipped submission is acceptable and nothing downstream depends on Portal correctness. Do not add reconciliation, mapping caches, or fail-closed gating.
- Runs on the single `worker` service at low concurrency.

`report-generate`

- Trigger: tRPC report request.
- Input: `artifactId`.
- Generates CSV/PDF, writes to GCS, stamps `GeneratedArtifact.completedAt` or `failedAt`.

`email-overdue-digest`

- Trigger: Hatchet cron at 07:00 `America/Sao_Paulo`.
- Input: none.
- Sends admin digest with overdue count, total open, age buckets.

`email-overdue-d30`

- Trigger: daily scan after digest or explicit queue from finance.
- Sends D+30 payer email only when `Installment.overdueD30EmailSentAt IS NULL`.
- On success, stamps `overdueD30EmailSentAt`.
- Must not duplicate Cora's D-15/D0/D+5/D+10/D+15 cadence.

`email-portal-failure`

- Trigger: `portal-submit` failure.
- Sends admin distribution alert with class/session IDs and app retry link, not student names.

`legacy-import-students`

- Developer-run script, not an app workflow in MVP.
- Input: local export file path.
- Ad hoc parser lives inside the short-lived script; no reusable Legacy adapter/interface is part of the app architecture.
- Emits a temporary validation report and performs import only with explicit command flag.
- Persists only normal domain rows; no Legacy import models, staging tables, import jobs, or raw source payloads.

Trace: see Section 12.

## 7. Reports and Dashboards

### 7.1 Dashboard definitions

Active students:

- Count students with `status = ACTIVE`.
- "New this month" uses student `createdAt` month in `America/Sao_Paulo`.

Receivables snapshot:

- Expected this month: sum `currentExpectedCents` for collectible installments due in current calendar month.
- Received this month: sum payment allocations whose `PaymentEntry.date` is in current calendar month.
- Overdue: sum `collectibleRemainingCents` for collectible installments with dueDate before today.
- Buckets: `1-7`, `8-30`, `30+` days overdue, using `today(America/Sao_Paulo) - dueDate`.

Portal health:

Sets:

- `scheduledSessions`: sessions on the day with `status = SCHEDULED`.
- `untakenSessions`: scheduled sessions whose `sessionEndInstant` has passed and `attendanceConfirmedAt IS NULL`.
- `eligibleSessions`: scheduled sessions with `attendanceConfirmedAt IS NOT NULL`.
- `pendingSessions`: eligible sessions where `portalSubmittedAt IS NULL OR attendanceLastCommittedAt > portalSubmittedAt`.
- `failedSessions`: pending sessions whose latest `PortalRun` has `failedAt` set and no `succeededAt`. If attendance changed after a successful submission and no rerun has been attempted yet, the session is pending but not failed.

Precedence:

1. `CLOSED`: no scheduled sessions exist and a `SchoolClosedDay` exists, or all sessions were cancelled due to a closure.
2. `NEEDS_ATTENTION`: any untaken past session exists.
3. `FAILED`: any failed session exists.
4. `PARTIAL`: some eligible sessions are submitted and some are pending.
5. `SUBMITTED`: at least one eligible session exists and no eligible session is pending.
6. `PENDING`: eligible sessions exist but none have been submitted yet.

Untaken sessions are never hidden by "all eligible submitted"; they win via `NEEDS_ATTENTION`.

Trace: `S-DASH-1`, `S-DASH-2`, `S-Portal-4`, `S-FIN-6`, `S-NOT-2`; `D-0029`, `D-0032`.

### 7.2 Report definitions

Overdue receivables CSV:

- Rows include only collectible overdue installments.
- Columns: student, order id/code, installment due date, current expected, paid, collectible remaining, age days.
- No "last contact attempt" until `S-FIN-4` ships.

Monthly accountant CSV:

- Payment entries with allocations in month.
- Waivers in month.
- Expenses excluded.

Class roster PDF:

- Class, teacher, schedule, active enrollments in selected semester/date.
- Includes makeup visitors only for a selected session, not in the base class roster.

Student attendance summary PDF:

- Per `(enrollment, semester)`: held sessions, present, absent, percentage, flagged, makeup count as separate operational stat.
- If any session in the enrollment window has no semester bucket, generation fails with a setup error instead of silently omitting that session.

Student statement PDF:

- All orders where student is an `OrderBeneficiary`.
- Installments with derived statuses and amounts.
- Cancelled orders and waived installments are shown as historical/non-collectible where applicable.
- Payment entries and allocations.

Trace: see Section 12.

## 8. UI Boundaries

> **Planned, not built in backend issues.** UI-labelled GREs in P01–P08 (post-phase until GRE-57). Backend issues expose tRPC procedures these surfaces consume.

The first screen after login is the actual role home:

- `ADMIN`: dashboard with active students, receivables, Portal health, today's/this week's operational warnings.
- `TEACHER`: today's sessions and next session per class.

Portuguese-BR is mandatory for visible UI, validation messages, emails, and generated reports.

Mobile priority:

- Teacher attendance page must fit phone screens.
- Attendance rows use large touch targets and preselected present state, but no data is committed until `Confirmar chamada`.

Desktop priority:

- Admin workflows are dense, searchable, and table-friendly.
- Finance screens show amounts in BRL formatting while storing cents.

Trace: `S-AUTH-2`, `S-ATT-1`, `S-DASH-1`, `S-DASH-3`; AGENTS.md product constraints.

## 9. Integration Boundaries

### 9.1 Portal

Core model stores:

- `Class.portalClassName`
- `Class.originalPortalClassName`
- `ClassSession.attendanceLastCommittedAt`
- `ClassSession.portalSubmittedAt`
- `PortalRun` queue/attempt/job/outcome/error facts linked to `ClassSession`

Core model does not store:

- Portal student ID mapping.
- Portal roster snapshots.
- Rich external portal state.

`PortalClient` interface:

```ts
type PortalSubmitSessionInput = {
  classSessionId: string;
};

type PortalSubmitSessionResult =
  | { ok: true; submittedAt: Date }
  | { ok: false; code: string; message: string };
```

The adapter loads all PII inside the worker from DB by ID only. Logs use internal IDs.

Portal is best-effort (v0.3): the submit matches by name, is allowed to be wrong or skipped, and is not reconciled. No persistent Portal ID/roster mapping is stored and nothing downstream depends on Portal correctness. Keep the adapter as thin as possible.

Trace: see Section 12.

### 9.2 Legacy

Legacy import is an ad hoc, short-lived developer script, not an integration subsystem.

Rules:

- No Legacy-specific Prisma models, staging tables, import batch/job tables, reusable adapter interfaces, or persisted raw source payloads.
- The script may define local parsing helpers for the exact export file, but they are disposable implementation details and must not be promoted into shared packages.
- The script handles encoding and ugly export cleanup, collapses Legacy's separate RG/CPF columns into `documentType` + `documentNumber` (CPF preferred when both present), and writes only normal domain rows.
- Legacy's denormalized parent columns (`Pai/Mãe Responsável`, `Pai/Mãe Aluno`) are **not** modeled in MVP — only the primary `Responsável` becomes a `Guardian`; other source-only values may appear in the temporary validation report but are not persisted as raw import data.
- A `Guardian` row is created (and `addressId` linked) only when the export carries a non-empty responsável name; the student and guardian addresses are imported as separate `Address` rows even when identical (de-dup is not attempted at import).
- Temporary import report includes duplicates by name+phone, missing required values, parse warnings, and rows skipped.
- Names are not normalized before storage.
- Re-run is a developer task.

Trace: `S-STU-1`; `D-0026`.

### 9.3 Resend/Mailpit

- Production email: Resend.
- Local email: Mailpit.
- Magic links are owned by Better Auth.
- Operational emails are hardcoded in jobs; no rule engine.

Trace: `S-AUTH-1`, `S-NOT-2`; `D-0005`, `D-0007`, `D-0018`.

### 9.4 GCS

- Store generated PDFs/CSVs and signed order PDFs.
- DB stores bucket/object key.
- Signed URLs are short-lived and generated on demand.
- Retention policy is open; keep `expiresAt` nullable until decided.

Trace: see Section 12.

## 10. Testing and Quality Gates

### 10.1 Test layers

Agent workflow, file layout, and tier selection rules live in `docs/agents/testing.md`. This section keeps the product/spec layer vocabulary; the agent doc maps those layers to the canonical Unit, Integration, and Behavior commands.

Domain unit tests:

- Attendance percent and empty denominator.
- Untaken-session flag.
- Makeup display status.
- Installment/order status and balances.
- Remainder-on-last installment generation.
- Age buckets and current-month logic in `America/Sao_Paulo`.

DB integration tests (cheap local constraints only):

- CHECK constraints and partial unique indexes.
- Semester overlap rejection (exclusion constraint).
- Natural-duplicate composite unique indexes.

tRPC integration tests (now own the cross-entity invariants, per §3.3):

- RBAC and teacher resource scope.
- Status lifecycle transactions.
- Enrollment create/transfer/advance and enrollment/progress invariants (one active progress, per-track uniqueness, archive/legacy/capacity guards).
- Attendance confirm with all-present and absent rows; session/enrollment class+window match; roster-count check.
- Finance order/payment/waiver flows; payment allocation payer/sum invariants; concurrent-allocation serialization (`SELECT … FOR UPDATE`).

Worker tests:

- Job payload contains IDs only.
- `portal-submit` skips cancelled/untaken sessions.
- Report artifact state transitions.
- Email digest recipient/content shape.

E2E smoke tests:

- Teacher marks and confirms attendance on mobile viewport.
- Admin schedules makeup and teacher marks visitor outcome.
- Admin creates order, registers payment, sees receivables update.
- Manual Portal retry queues a job and records a session-linked `PortalRun`.

Trace: all P0 stories; `D-0027`.

### 10.2 Commands

Sprint 0 scaffold must expose:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:db
pnpm test:behavior
pnpm test:e2e
pnpm prisma:migrate
pnpm prisma:seed
pnpm dev
pnpm dev:worker
```

Until CI/CD is decided, these are local quality gates. When CI is selected, it should run lint, typecheck, unit tests, DB integration tests, and backend behavior tests against Postgres 16. E2E can start as manual or nightly until the app stabilizes.

Trace: `D-0006`, `D-0027`.

## 11. Deployment and Infra

Formal defaults:

- Cloud SQL Postgres 16 for production data.
- GCP Secret Manager for production secrets.
- Artifact Registry for worker images.
- Cloud Run for workers.
- GCS for artifacts and Pulumi state.
- Hatchet Cloud for workflow orchestration.
- No Sentry in MVP; rely on Cloud Run / host logs (IDs only, no PII). Revisit observability post-MVP.
- Resend for production email.
- Railway remains the leading web host; Vercel remains alternative until host decision is closed.

Pulumi stack should create:

- GCS buckets for artifacts and Pulumi state.
- Service accounts for web/worker with least privilege.
- Secret references for DB, Better Auth, Google OAuth, Resend, Portal credentials.
- One Cloud Run service for the single `worker`.
- Artifact Registry repository.
- Resend resources are configured externally but env wiring belongs in infra docs.

Deployment remains blocked on the open web-host and Cloud SQL connectivity decision. If Railway is selected, a follow-up infra decision must specify Cloud SQL access method, SSL/Auth Proxy or direct networking, migration runner, secret injection, and staging/preview behavior.

Trace: `D-0003`, `D-0004`, `D-0007`, PRD Section 15.9.

## 12. Source Trace Matrix

### 12.1 Story trace

| Story        | Status               | Spec coverage / gap                                                                                                                                                                                                      |
| ------------ | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `S-AUTH-1`   | P0                   | Section 4.1 defines Better Auth, pre-provisioned users, unknown-email rejection boundary, 30-day sessions, sign-out, magic link/Resend.                                                                                  |
| `S-AUTH-2`   | P0                   | Sections 4.1, 5.2, and 8 define role filtering, 403/resource checks via RBAC, teacher scope, and no MVP impersonation.                                                                                                   |
| `S-STU-1`    | P0                   | Sections 6.2 and 9.2 define one-shot Legacy script, temporary validation report, no Legacy-specific models, and verbatim name preservation. Legacy sample remains Sprint-0 open item.                                    |
| `S-STU-2`    | P0                   | Sections 4.2 and 5.3 define search fields and trigram search target.                                                                                                                                                     |
| `S-STU-3`    | P0                   | Section 5.3 defines profile aggregate sections and `wa.me` URL; Sections 4.2, 4.6, and 4.7 provide the backing data, including the structured `Guardian` + `Address`.                                                    |
| `S-STU-4`    | P0                   | Section 4.2 defines fields, `documentType`/`documentNumber`, structured `Guardian` + shared `Address`, minor/guardian requirement, status enum, and `SUSPENDED` cascade/no billing mutation.                             |
| `S-STU-5`    | Deferred             | Student status/field-level rastreabilidade deferred ([D-0035](./decisions.md#d-0035-defer-student-field-level-traceability)); no attribution columns on `Student` in MVP.                                                |
| `S-CAT-1`    | P0                   | Section 4.3 defines ProductLine/Track/Stage, legacy behavior, stage-level `sequence` ordering, independent tracks (no cross-track order/equivalence), and seed-only scope. Portal naming validation remains GRE-13 work. |
| `S-CLS-1`    | P0                   | Sections 4.4 and 5.3 define class fields, scheduleType/format axes, status, Portal name storage, one-teacher rule, lineage, and clone-for-next-period.                                                                   |
| `S-CLS-2`    | P0                   | Sections 4.4 and 6.2 define sessions, semester-window generation for REGULAR and PERSONALIZED, async `sessions-generate`, idempotency, closed-day skipping, and setup errors. ~~Rolling horizon~~ deprecated ([D-0008](./decisions.md#d-0008-rolling-enrollment-and-contract-periods)). |
| `S-CAL-1`    | P0                   | Sections 4.4 and 5.3 define closed days, federal holiday import procedure, future cancellation behavior, and reopen/regenerate.                                                                                          |
| `S-CAL-2`    | P0                   | Sections 4.4 and 5.3 define per-session cancellation reason and no cancellation after committed/submitted attendance.                                                                                                    |
| `S-CAL-3`    | P2                   | Explicitly excluded by Sections 1.1 and 13; no substitute fields are modeled.                                                                                                                                            |
| `S-CAL-4`    | P0                   | Sections 4.4, 6.2, and 7.2 define semesters, no overlap, session generation trigger, and unbucketed-session setup errors.                                                                                                |
| `S-ENR-1`    | P0                   | Sections 4.5 and 5.3 define enrollment creation, capacity override reason, active progress seeding, and order prompt boundary.                                                                                           |
| `S-ENR-2`    | P1                   | Sections 4.5 and 5.3 define schema/transaction shape; endpoint is tagged P1.                                                                                                                                             |
| `S-ENR-3`    | P1                   | Section 5.3 records resolved assumption: academic close/drop/pause does not mutate billing automatically; staff use manual finance tools.                                                                                |
| `S-ENR-4`    | P0                   | Sections 4.3, 4.5, and 5.3 define next-stage lookup and progress-only advancement.                                                                                                                                       |
| `S-ATT-1`    | P0                   | Sections 4.6, 5.3, 7.1, and 8 define mobile attendance, explicit confirm, untaken sessions, and no offline/server-draft requirement.                                                                                     |
| `S-ATT-2`    | P0                   | Sections 4.6 and 5.3 define makeup visitors on roster and target-session outcome capture.                                                                                                                                |
| `S-ATT-3`    | P0                   | Sections 4.6 and 5.3 define scheduling makeups with advance-date constraint.                                                                                                                                             |
| `S-ATT-4`    | P0                   | Sections 5.2 and 5.3 define teacher own-class same-day edit via resource scope.                                                                                                                                          |
| `S-ATT-5`    | P0                   | Sections 4.4, 4.6, and 5.3 define admin edits, `attendanceLastCommittedAt`, and Portal retry derivation.                                                                                                                 |
| `S-Portal-1` | Gated P0             | Sections 1.2, 1.3, 6.2, and 9.1 define Portal as gated by Sprint-0 exit criteria with automated/assisted/not-viable modes.                                                                                               |
| `S-Portal-2` | P0 after Portal mode | Sections 6.2 and 9.3 define Portal failure email (no Sentry in MVP; v0.3).                                                                                                                                               |
| `S-Portal-3` | P0 after Portal mode | Sections 4.4, 5.3, and 6.2 define manual enqueue/retry and session-linked `PortalRun` facts.                                                                                                                             |
| `S-Portal-4` | P0                   | Section 7.1 defines health-card sets and precedence.                                                                                                                                                                     |
| `S-FIN-1`    | P0                   | Sections 4.7 and 5.3 define payer/order/beneficiary/installment creation, commercial schedule facts, due-day, and edit cutoff.                                                                                           |
| `S-FIN-2`    | P0                   | Sections 4.7 and 7.1 define installment derived status, balances, interest preview config, and open multa policy.                                                                                                        |
| `S-FIN-3`    | P0                   | Sections 4.7 and 5.3 define payment entries, allocations, payer-scoped invariants, and batch reconcile.                                                                                                                  |
| `S-FIN-4`    | P1                   | Excluded from P0 schema; Sections 4.7 and 7.2 state dashboards/reports do not depend on collection attempts.                                                                                                             |
| `S-FIN-5`    | P1                   | Section 4.7 stores waiver backbone required by `D-0032`; endpoint tagged P1 in Section 5.3.                                                                                                                              |
| `S-FIN-6`    | P0                   | Section 7.1 defines receivables snapshot, collectible amounts, and age buckets.                                                                                                                                          |
| `S-FIN-7`    | P0                   | Sections 4.8, 6.2, and 7.2 define async student statement artifact generation.                                                                                                                                           |
| `S-FIN-8`    | P1                   | Section 4.7 stores adjustment backbone required by `D-0032`; endpoint tagged P1/minimal-admin in Section 5.3.                                                                                                            |
| `S-EXP-1`    | Phase 2              | Excluded by Sections 1.1 and 13.                                                                                                                                                                                         |
| `S-EXP-2`    | Phase 2              | Excluded by Sections 1.1 and 13.                                                                                                                                                                                         |
| `S-EXP-3`    | Phase 2              | Excluded by Sections 1.1 and 13.                                                                                                                                                                                         |
| `S-EXP-4`    | Phase 2              | Excluded by Sections 1.1 and 13.                                                                                                                                                                                         |
| `S-LEAD-1`   | Phase 2              | Excluded by Sections 1.1 and 13.                                                                                                                                                                                         |
| `S-LEAD-2`   | Phase 2              | Excluded by Sections 1.1 and 13.                                                                                                                                                                                         |
| `S-LEAD-3`   | Phase 2              | Excluded by Sections 1.1 and 13.                                                                                                                                                                                         |
| `S-LEAD-4`   | Phase 2              | Excluded by Sections 1.1 and 13.                                                                                                                                                                                         |
| `S-LEAD-5`   | Phase 2              | Excluded by Sections 1.1 and 13.                                                                                                                                                                                         |
| `S-LEAD-6`   | Phase 2              | Excluded by Sections 1.1 and 13.                                                                                                                                                                                         |
| `S-NOT-1`    | Phase 2              | Excluded by Sections 1.1 and 13.                                                                                                                                                                                         |
| `S-NOT-2`    | P0                   | Sections 6.2 and 9.3 define Resend/Mailpit, Portal failure email, D+30 idempotency, and 07:00 overdue digest.                                                                                                            |
| `S-NOT-3`    | Phase 2              | Excluded by Sections 1.1 and 13; no notification rule table.                                                                                                                                                             |
| `S-NOT-4`    | P1                   | Excluded from P0 schema in Section 4.2.                                                                                                                                                                                  |
| `S-DASH-1`   | P0                   | Sections 7.1 and 8 define admin dashboard cards and deferred card omissions.                                                                                                                                             |
| `S-DASH-2`   | P0                   | Section 7.1 defines receivables dashboard metrics.                                                                                                                                                                       |
| `S-DASH-3`   | P0                   | Sections 5.2 and 8 define teacher home.                                                                                                                                                                                  |
| `S-REP-1`    | P0                   | Sections 6.2 and 7.2 define overdue CSV without last-contact attempt.                                                                                                                                                    |
| `S-REP-2`    | P0                   | Sections 6.2 and 7.2 define monthly accountant CSV excluding expenses.                                                                                                                                                   |
| `S-REP-3`    | P0                   | Sections 6.2 and 7.2 define class roster PDF.                                                                                                                                                                            |
| `S-REP-4`    | P0                   | Sections 4.6, 6.2, and 7.2 define attendance summary formula and PDF.                                                                                                                                                    |

### 12.2 Decision trace

| Decision | Spec coverage                                                                                                                                |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `D-0001` | Sections 2 and 5 keep one monolithic BFF with worker processes only for runtime-heavy work.                                                  |
| `D-0002` | Sections 2 and 5 define T3 Turbo/tRPC BFF and prohibit REST/GraphQL parallel backend.                                                        |
| `D-0003` | Sections 2, 9.4, and 11 define GCP data/storage/secrets/IaC defaults and open host item.                                                     |
| `D-0004` | Sections 2 and 6 define Hatchet plus Cloud Run worker services.                                                                              |
| `D-0005` | Sections 4.1, 5.2, and 9.3 define Better Auth, Google/magic link, and pre-provisioning.                                                      |
| `D-0006` | Sections 2.2 and 10.2 define Docker Compose/local seed/quality gates.                                                                        |
| `D-0007` | Sections 6.2, 9.3, and 11 define Resend/Mailpit. Sentry dropped in MVP (v0.3).                                                               |
| `D-0008` | Sections 4.4, 4.5, and 4.7 keep enrollment/orders decoupled from semester windows.                                                           |
| `D-0009` | Sections 4.6 and 7.2 define present/absent only and 75% threshold.                                                                           |
| `D-0010` | Sections 4.6 and 5.3 define admin/coordinator-owned makeup scheduling.                                                                       |
| `D-0011` | Section 4.7 defines commercial installment schedule inputs, due-day choices, and generation constraints.                                     |
| `D-0012` | Section 4.7 defines 1% monthly interest preview and unresolved multa.                                                                        |
| `D-0013` | Sections 1.1 and 13 keep substitute-teacher design Phase 2 only.                                                                             |
| `D-0014` | Sections 4.7 and 6.2 keep Cora coexistence and avoid duplicated dunning schedule.                                                            |
| `D-0015` | Sections 1.1, 5.2, and 13 exclude substitute assignment.                                                                                     |
| `D-0016` | Sections 4.1 and 5.2 enforce ADMIN/TEACHER MVP role set.                                                                                     |
| `D-0017` | Sections 4.7 and 7 limit finance to receivables/revenue tracking.                                                                            |
| `D-0018` | Sections 1.1, 6.2, and 9.3 limit notifications to transactional email.                                                                       |
| `D-0019` | Sections 1.1 and 13 exclude leads/CRM.                                                                                                       |
| `D-0020` | Sections 1.1 and 13 exclude expenses/cash-position/P&L.                                                                                      |
| `D-0021` | Section 4.4 defines scheduleType/format axes and class-stage nullability.                                                                    |
| `D-0022` | Sections 4.4 and 4.5 keep structural bones and defer pedagogy intelligence.                                                                  |
| `D-0023` | Sections 1.2, 6.2, and 9.1 keep Portal thin and Playwright/name-based until amended.                                                         |
| `D-0024` | Sections 4.2 and 5.3 define statuses, SUSPENDED cascade, and no automatic billing.                                                           |
| `D-0025` | Section 4.7 defines Payer as first-class, kept structurally separate from the `Guardian` (D-0033).                                           |
| `D-0026` | Sections 6.2 and 9.2 define one-shot Legacy import script.                                                                                   |
| `D-0027` | Sections 1.1, 6, and 10 define sequencing and gates.                                                                                         |
| `D-0028` | Section 4.7 defines Order/Payer/Beneficiary/Installment/PaymentEntry model.                                                                  |
| `D-0029` | Sections 3.2, 4.6, and 7 define neutral attendance, explicit confirm, makeup, and formula.                                                   |
| `D-0030` | Section 4.3 defines ProductLine/Track/Stage catalog.                                                                                         |
| `D-0031` | Section 4.5 defines Enrollment vs PedagogicalProgress.                                                                                       |
| `D-0033` | Section 4.2 defines the `Guardian` + `Address` entities, `documentType`/`documentNumber`, shared-address FK, and minor/guardian requirement. |
| `D-0032` | Sections 4.7 and 7 define derive-don't-store finance ledger, adjustments, payer-scoped payments.                                             |

## 13. Adversarial Review Resolutions

This draft was reviewed in parallel across four lenses: data-model integrity, source traceability, derive-don't-store correctness, and architecture/repo realism. The resulting changes are encoded above; this section records the main resolutions.

| Lens                           | Resolution encoded                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Data-model integrity           | Added slot/session composite integrity, partial unique indexes for nullable session slots, cancellation guards, active-progress inverse constraints, progress-window exclusion, active enrollment per track, legacy/archive/capacity triggers, active Portal-name uniqueness, and user FK attribution rule.                                                  |
| Source traceability            | Replaced range-based source trace with explicit story and decision matrices; downgraded Portal API discovery to Sprint-0 spike evidence; tagged P1/gated procedures; removed P1-only `CollectionAttempt`/`doNotContact` from P0 schema.                                                                                                                      |
| Derive-don't-store correctness | Removed server-side attendance drafts; kept committed attendance behind explicit confirm; added `attendanceLastCommittedAt` for Portal retry derivation; defined Portal health precedence; made cancelled orders non-collectible; added finance non-negative/overpayment guards, D+30 email idempotency, and GCS artifact references instead of signed URLs. |
| Architecture/repo realism      | Split full MVP by `D-0027` increment, made Sprint-0 scaffold explicit, separated job contracts from worker handlers, split Cloud Run worker services, introduced `ctx.staffUser`, downgraded CI/deployment claims where decisions remain open.                                                                                                               |

Resolved assumptions introduced by review:

- `S-ENR-3` close/drop/pause does not automatically mutate billing in MVP; staff use manual finance tools. This matches the house style and `D-0024`/`D-0032` even though older PRD wording mentions a waiver prompt.
- Concurrent active enrollments are allowed only across different tracks. Duplicate active enrollment in the same track is blocked.
- Production Portal remains Playwright/name-based until PRD/decisions are amended, despite promising API evidence in discovery.

## 14. Non-Goals and Guardrails

- Do not add a REST backend parallel to tRPC.
- Do not add NextAuth, Supabase, Cloud Scheduler, SendGrid, or a new queue.
- Do not add stored business status columns for enrollment, progress, installment, order, makeup, attendance percent, or capacity.
- Do not add `GenerationPreset` or `Order.generationPreset`; installment schedules are commercial terms captured by generated `Installment` rows.
- Do not add server-side attendance drafts/autosave in MVP; attendance selections are persisted only by `attendance.confirmSession`.
- Do not add Legacy-specific models/tables, import batch/job tables, staging tables, or reusable Legacy adapter interfaces; Legacy import is a short-lived script.
- Do not add Portal roster snapshots or student-ID mapping until empirical Portal operation requires them; Portal queue/attempt/outcome facts are tracked only through `PortalRun`.
- Do not add WhatsApp/Evolution, leads, expenses, payment processing, Cora API import, substitute assignment, grades, or automated class-generation intelligence in MVP.
- Do not log student/payer PII from workers.

Trace: AGENTS.md, PRD Section 16, and Section 12.
