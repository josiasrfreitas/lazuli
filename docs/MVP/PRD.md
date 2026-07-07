# Lazuli — PRD & User Stories

**Status:** v1.1 — draft  
**Author:** Josias Ribeiro  
**Date:** 2026-06-13 · scope revised 2026-06-17 (SPEC discovery)  
**Companion docs:** [Docs index](./README.md) · [Decisions](./decisions.md)

This document is the source of truth for product scope, user stories, and acceptance criteria. Architecture and product constraints live in [decisions.md](./decisions.md).

> **UI execution split (2026-06-27, [D-0036](./decisions.md#d-0036-frontend-surfaces-deferred-design-system-gate)):** User stories describe **product behavior**. **Backend issues** deliver tRPC/API/workers only. **UI issues** live in the **same domain Linear project** (P01–P08), labelled UI, and are **post-phase** until **GRE-57** (design system triage) closes. Hybrid stories are split: e.g. GRE-20 (API) + GRE-60 (UI) both in P02.

---

## 1. Roles

| Role          | Identity                              | Primary surface                                   |
| ------------- | ------------------------------------- | ------------------------------------------------- |
| **ADMIN**     | School owner / sponsor                | Web (desktop) — full access, dashboards, settings |
| **SECRETARY** | Reception, enrollment, day-to-day ops | Web (desktop primarily, mobile capable)           |
| **TEACHER**   | Classroom staff                       | Web (mobile-first) — attendance + roster only     |
| **FINANCE**   | Bookkeeping / collections             | Web (desktop) — receivables, expenses, reports    |

All staff are pre-provisioned in the `User` table. RBAC enforced in tRPC middleware (see [decisions: Better Auth](./decisions.md#d-0005-better-auth)).

> **MVP role scope (revised 2026-06-17, [D-0016](./decisions.md#d-0016-mvp-role-set--admin--teacher)):** only **`ADMIN`** and **`TEACHER`** are enabled in MVP. `SECRETARY` and `FINANCE` are deferred until expenses + bank integration land (Phase 2). Until then, all secretary/finance work is performed by `ADMIN` users (owner + coordenação). Stories below attributed to `SECRETARY`/`FINANCE` are performed by `ADMIN` in MVP.

## 2. Story conventions

- Format: **As a `<role>`, I want `<capability>` so that `<outcome>`.**
- Each story has **acceptance criteria** (testable, behavioral).
- Each story carries a **priority**: `P0` must ship week 1, `P1` ship week 1 if time, `P2` Phase 2.
- Stories are numbered `S-<module>-<n>` for traceability.

---

## 3. Authentication & access (Auth)

> **UI note:** Login/sign-out UI → GRE-58; shell/403 → GRE-16. Backend: GRE-15, GRE-17.

### S-AUTH-1 · Staff sign in with Google `P0`

**As a** staff member, **I want** to sign in with my school Google account **so that** I don't manage another password.

- Google OAuth via Better Auth, restricted to pre-provisioned `User` emails.
- Magic link via Resend as fallback when Google fails.
- Unknown email → "Acesso não autorizado. Fale com a secretaria." (no auto-provision).
- Session lasts 30 days; "sign out" available in header.

### S-AUTH-2 · Role-based menu `P0`

**As a** teacher, **I want** to only see attendance + my classes **so that** I'm not overwhelmed by finance/admin screens.

- Sidebar items are filtered by role.
- Direct URL access to forbidden routes → 403 page in Portuguese.
- Admin can impersonate other roles (read-only) for support — **deferred to Phase 2** (was `P1`; see [D-0016](./decisions.md#d-0016-mvp-role-set--admin--teacher)).

---

## 4. Students

> **UI note:** Profile, forms, and search chrome → GRE-60 (search UI planned). Backend: GRE-20, GRE-21, GRE-23.

### S-STU-1 · Import students from Legacy export `P0`

**As an** admin/operator, **I want** the existing Legacy roster loaded into the system **so that** we start with the real students, not a typed-in list.

- **MVP delivery: an ad hoc, short-lived developer-run script** — no in-app importer UI and no persistent Legacy-specific models/tables (see [D-0026](./decisions.md#d-0026-legacy-import--one-shot-script)). Re-running is a developer task.
- Parsing/cleanup lives inside that script only; UTF-8 or Latin-1 is handled there. The Legacy export is reportedly "formato ruim" — a Sprint-0 risk spike.
- **Student names are preserved verbatim** — they are the matching key for Portal submission (no external portal ID; see [D-0023](./decisions.md#d-0023-portal-master-login-and-name-based-matching)).
- Duplicate handling (phone+name) and a temporary validation report are produced by the script.
- No in-app import with preview/column-mapping/dedup UI is planned; revisit only if repeated imports become a real operational need.

### S-STU-2 · Search students fast `P0`

**As a** secretary, **I want** to find any student in under 2 keystrokes per match **so that** phone calls feel instant.

- Global search bar in header (`Cmd/Ctrl+K`).
- Searches name, phone, email, current class code.
- Postgres `ILIKE` + trigram OK at MVP scale.
- Results show: name, current class, status badge, phone.

### S-STU-3 · View student profile `P0`

**As a** secretary, **I want** one page with everything about a student **so that** I don't switch screens during a phone call.

- Sections: contact (incl. document, address, and `Responsável`/Guardian block), current/past classes, attendance summary (semester), open order + installment status, payment history, free-text notes, WhatsApp click-to-chat link (`wa.me/55...`).
- Edit-in-place for contact + notes.

### S-STU-4 · Add / edit student `P0`

**As a** secretary, **I want** to register a new student **so that** I can enroll them in a class.

- Required: `fullName`, `status`. Optional: `phone`, `email`, `birthDate`, `documentType`+`documentNumber` (CPF or RG — if a number is entered, the type is required; see [D-0033](./decisions.md#d-0033-structured-guardian-and-address-entities)), `address` (logradouro, nº, complemento, bairro, cidade, UF, CEP).
- If `birthDate` makes student a minor → a **`Responsável` (Guardian)** is required: structured fields `fullName` + `relationship` (grau de parentesco) + at least one of `phone`/`email`, optional `documentType`+`documentNumber` and `address`. The Guardian is a real entity ([D-0033](./decisions.md#d-0033-structured-guardian-and-address-entities)), not a free-text field — pick an existing guardian (e.g. a sibling's) or create one. When the minor lives with the guardian, the form may reuse the **same address** for both. The Guardian (who to call about the kid) stays distinct from the finance **Payer** (who is billed; see [D-0025](./decisions.md#d-0025-payer-as-a-first-class-entity)).
- Status enum (revised 2026-06-17, [D-0024](./decisions.md#d-0024-student-status-set)): `ACTIVE | INACTIVE | DROPPED | SUSPENDED`. `LEAD`/`TRIAL` removed (no lead pipeline in MVP); `SUSPENDED` added for _trancamento_ (paused enrollment, may return; billing rules stay manual/Phase 2).
- Status change requires a confirmation modal that is **informational only** — it performs the academic/roster cascade but makes **no automatic billing change**. For `SUSPENDED` (see [D-0024](./decisions.md#d-0024-student-status-set)): closes active enrollments (`exitReason=SUSPENDED`) + active `PedagogicalProgress` (`endReason=SUSPENDED`), removes the student from active rosters, and stops future attendance accrual via the Semester∩Enrollment-window logic. Existing installments are **not** changed automatically; the modal warns staff to handle billing manually (waiver/correction/adjustment). No "pause installments? [Yes/No]" prompt.

### S-STU-5 · Student status lifecycle `Deferred`

**As an** admin, **I want** status changes to be auditable **so that** dropouts are explainable.

- Deferred until a rastreabilidade layer is designed ([D-0035](./decisions.md#d-0035-defer-student-field-level-traceability)). MVP stores no per-field attribution on `Student` (no `statusChangedAt`, `statusChangeReason`, `contactUpdatedAt`, etc.).
- **`DROPPED` reason** and status-transition audit were previously P0/P1; both move with this deferral. Staff may still set `DROPPED` without capturing a reason in the system.
- No separate audit log table in MVP (see [§14](#14-discovery-driven-scope-changes)).

---

## 5. Course catalog, classes, sessions & calendar

> **UI note:** Class catalog, calendar month view, class detail pages → UI GREs (to be planned). Backend: GRE-24–29.

### S-CAT-1 · Seeded course catalog `P0`

**As the** system, **I want** the course progression catalog seeded **so that** classes and stage placement reference real, ordered stages and the Portal class name can be derived.

- Model: **ProductLine → Track → Stage** (see [D-0030](./decisions.md#d-0030-course-catalog--track-and-stage)). Product-line labels such as Adultos, Infantil, Teens Connect, Teenstation, Speed, and Espanol are seeded data, not hardcoded schema enum values.
- `ProductLine`: `key`, `name`, `status` (`ACTIVE | LEGACY`), optional `portalPrefix`. `Track`: `productLineId`, `name`, `status`, optional `portalPrefix`. `Stage`: `trackId`, `name`, `internalCode` (unique within track), `sequence` (linear order within the track).
- **Seed-only, no CRUD UI in MVP** — idempotent seed derived from [discovery/course-stage-ordering.md](../discovery/course-stage-ordering.md). Legacy lines (Teens, Teenstation) seeded as `LEGACY`; Adultos, Infantil, Teens Connect, Speed, and Espanol tracks as `ACTIVE`. Admin catalog UI is Phase 2.
- **`LEGACY` blocks new, allows existing**: legacy tracks are hidden/disabled when creating a new class or new enrollment, but existing classes/enrollments on them keep working.
- Equivalences / cross-track branching are **not** modeled (deferred).
- GRE-24 seeds the real Lazuli course/stage catalog. External Portal reconciliation is separate GRE-13 work: if Portal-only validation finds naming/code differences, update seed data or class-name derivation rules there.

### S-CLS-1 · Manage class catalog `P0`

**As an** admin, **I want** to define classes with weekly schedule **so that** sessions auto-generate and Portal submission can locate the class.

- **Two independent attributes (revised 2026-06-17, [D-0021](./decisions.md#d-0021-class-modality-as-two-axes)):**
  - `scheduleType`: `REGULAR | PERSONALIZED` (PERSONALIZED = PPT/PERSP). Drives session generation and progress semantics: REGULAR = synchronized group on one shared stage; PERSONALIZED = individual progress, students may sit at different stages.
  - `format`: `IN_PERSON | ONLINE`. Delivery only — online follows regular pedagogy remotely; it is **not** a third modality.
- Fields: `internalCode`, `teacher`, `(weekday, startTime, endTime)` slots, `semester` (required for session generation — both REGULAR and PERSONALIZED/PPT; see [S-CLS-2](#s-cls-2--auto-generate-class-sessions-p0)), `year`, `capacity`, `status`.
- **`Class.status = ACTIVE | ARCHIVED`** (default `ACTIVE`). `ARCHIVED` encodes operator intent to retire a class (not derivable — a class between periods has no future sessions yet isn't retired). `ACTIVE`: appears in pickers, accepts new enrollments, generates future sessions, eligible for attendance/Portal. `ARCHIVED`: hidden from new-enrollment/roster pickers, no new session generation, accepts no new enrollments, but **all history preserved** (sessions, attendance, enrollments, reports, Portal) and viewable via archive filters. On clone-for-next-period, the old class is archived after the successor + carried-forward students exist ("completed for the period" = ARCHIVED, no separate status). `FULL` (derivable from capacity) and `DRAFT`/`COMPLETED` are intentionally **not** modeled.
- **Portal class name** (e.g. `REG/TUI-TER-14:00/16:00-1S/26-1`) is **derived from structured fields** (modality, stage code, weekday, time, period, year, sequence) and stored; the original Portal string is also retained for compatibility/audit. Some parts (`1S/2S`, trailing `-1` suffix) are unconfirmed — see [§15](#15-open-questions-need-answers-before--during-week-1).
- **Stage**: REGULAR classes carry `sharedStageId` (FK to the seeded `Stage` catalog — see [S-CAT-1](#s-cat-1--seeded-course-catalog-p0)); PERSONALIZED classes have `sharedStageId = null` and carry stage **per student** via `PedagogicalProgress` (see [§6](#6-enrollment)). A DB CHECK constraint enforces `REGULAR ⟹ sharedStageId NOT NULL` / `PERSONALIZED ⟹ sharedStageId NULL` ([D-0021](./decisions.md#d-0021-class-modality-as-two-axes)). The `Stage.internalCode` feeds the stage segment of the derived Portal class name (the `TUI` in `REG/TUI-…`). The catalog model (Track → Stage) is decided in [D-0030](./decisions.md#d-0030-course-catalog--track-and-stage); remaining school-validation items are in [§15](#15-open-questions-need-answers-before--during-week-1).
- Multi-day classes (e.g. Mon+Wed) modeled as one `Class` with multiple `(weekday, startTime, endTime)` slots. **Exactly one teacher per class** (single `Class.teacherId`) — a class split across two teachers (e.g. different teacher per weekday) is modeled as two separate `Class`es, not a per-slot teacher. This keeps the teacher resource-scope rule `class.teacherId == user.id` ([D-0016](./decisions.md#d-0016-mvp-role-set--admin--teacher)) simple.
- **Class lineage**: a class may point to its `previousClass` (the class it continues from). MVP supports a manual "clone for next period" action (copy day/time/teacher/students, set `previousClass`). For a REGULAR class this is the **stage-advancement mechanism**: the clone defaults its `sharedStageId` to the **next stage** in the track (`sequence + 1`, editable; "fim da trilha" if none), and each carried-over student gets a closed `PedagogicalProgress` (`endReason = ADVANCED`) on the old enrollment plus a fresh active one on the new enrollment at the successor stage. Assisted/constraint-driven generation is **deferred** (see [D-0022](./decisions.md#d-0022-class--enrollment--bones-now-brain-later)).

> **Scope line — "bones now, brain later" ([D-0022](./decisions.md#d-0022-class--enrollment--bones-now-brain-later)):** MVP models the operational data (classes, modality, sessions, enrollment-as-entity, stage placement via `PedagogicalProgress`, class lineage) but **defers** pedagogical **evaluation** (grades, assessments, pass/fail, auto-progression) and assisted/constraint-driven class generation (availability solver, auto-suggest continuity, auto-split) to Phase 2.

### S-CLS-2 · Auto-generate class sessions `P0`

**As the** system, **I want** to generate `ClassSession` rows **so that** teachers see today's session and Portal has data to submit.

- `ClassSession.status`: `SCHEDULED | CANCELLED`. A "held" session is implicit (past date, not cancelled, **`attendanceConfirmedAt` set**) — no explicit HELD state in MVP. Session also carries `attendanceConfirmedAt?` / `attendanceConfirmedBy?` (see [D-0029](./decisions.md#d-0029-attendance--neutral-data-state-untaken-session-flag--formula)).
- **REGULAR and PERSONALIZED/PPT:** generate the full **`Semester` window** up front — one `ClassSession` per `(weekday slot × date)` between `Semester.startDate` and `Semester.endDate` for the class's `semesterId`. Both modalities share the same academic calendar; PERSONALIZED differs only in per-student stage placement (`PedagogicalProgress`), not in when sessions exist ([D-0031](./decisions.md#d-0031-enrollment-is-operational-stage-placement-lives-on-pedagogicalprogress)).
- Skip dates marked as "no class" on the school calendar (S-CAL-1).
- Re-runnable idempotently.
- **Async only:** `classes.generateSessions(classId | semesterId)` enqueues the Hatchet `sessions-generate` workflow and returns immediately — row creation never runs inline in the tRPC request ([TECHNICAL_SPEC §6.2](./TECHNICAL_SPEC.md#62-workflows)).
- ~~**Amended 2026-07-04 — supersedes prior wording:** PERSONALIZED ~90-day rolling horizon + nightly extension job~~ is **deprecated** ([D-0008](./decisions.md#d-0008-rolling-enrollment-and-contract-periods), [changelog #52](./CHANGELOG.md)).

### S-CAL-1 · School calendar of closed days `P0`

**As an** admin, **I want** to mark holidays / closed days **so that** no class sessions are generated for them.

- Calendar UI: month view, click a day → mark closed with reason (feriado nacional, recesso, evento).
- Bulk import of Brazilian federal holidays for the current year.
- Editing a past date does NOT retroactively delete attendance/sessions.
- **Marking a FUTURE date closed after sessions were generated**: matching future `SCHEDULED` sessions on that date are set to `CANCELLED` (reason = the closure) — never hard-deleted. Cancelled sessions need no attendance, are excluded from the denominator and Portal, and stay visible in history. Sessions that already have **committed attendance** are **not** auto-cancelled — surface a warning for manual resolution. **Re-opening** a date may regenerate the missing `SCHEDULED` sessions (idempotently, no duplicates), via the same generation logic / an explicit "regenerate" action.

### S-CAL-2 · Cancel one session (teacher absence — MVP path) `P0`

**As a** secretary, **I want** to cancel a single session **so that** Portal doesn't try to submit empty attendance.

- **Only teacher-absence path in MVP** — substitute assignment (S-CAL-3) is deferred to Phase 2 (see [D-0015](./decisions.md#d-0015-defer-substitute-teacher-assignment)).
- Cancel reason required (free text). Optional: schedule a makeup session on a future date.
- Cancelled sessions excluded from Portal nightly job.
- Visible on class page with a strike-through and reason.

### S-CAL-3 · Substitute teacher (teacher absence path B) `P2`

**As a** secretary, **I want** to assign a substitute teacher to a session **so that** class runs and attendance is still marked.

> **Deferred from MVP** — see [D-0015](./decisions.md#d-0015-defer-substitute-teacher-assignment). When built, design follows [D-0013](./decisions.md#d-0013-substitute-teacher-fallback).

- Substitute is picked from the `User` list with role `TEACHER` **or** entered as free text when the substitute is not a pre-provisioned user — the school has no formal substitute pool today.
- Session shows both original and substitute (user or free-text name) in roster header.
- Attendance flow unchanged.

### S-CAL-4 · Semester setup `P0`

**As an** admin, **I want** to define semester start/end **so that** sessions are generated against the right calendar.

- Two semesters per year (≈ fev–jun, ago–dez). Fields: `name` (e.g. `2026.1`), `startDate`, `endDate` (configurable — follows the calendar, not fixed calendar halves).
- **Dual role:** (1) **generation calendar for all class modalities** (REGULAR and PERSONALIZED/PPT; `format = ONLINE` included); (2) the **universal 6-month reporting/evaluation bucket** for the 75% attendance flag across **all** modalities ([D-0029](./decisions.md#d-0029-attendance--neutral-data-state-untaken-session-flag--formula)). A session is bucketed into the semester whose date range contains its date.
- Creating a semester enqueues async session generation (S-CLS-2) for all **ACTIVE** classes bound to that semester (`semesterId`).
- ~~**Amended 2026-07-04 — supersedes prior wording:** PERSONALIZED/online "rolling" session generation outside semester windows~~ is **deprecated** ([D-0008](./decisions.md#d-0008-rolling-enrollment-and-contract-periods)).
- **Invariants**: semester date ranges **must not overlap**; a session date should map to **exactly one** semester. A session date that falls in **no** semester window surfaces as a setup error/warning (so attendance is never unbucketed or double-counted).
- **Order installments do not align with the semester window** — see S-FIN-1 and [D-0011](./decisions.md#d-0011-installment-defaults). A semester drives sessions; the order drives billing, and they have independent lifespans.

---

## 6. Enrollment

> **Enrollment is operational; stage placement is separate (revised 2026-06-17, [D-0031](./decisions.md#d-0031-enrollment-is-operational-stage-placement-lives-on-pedagogicalprogress)):** `Enrollment` is the student↔class operational link — `entryDate`, `exitDate?`, `exitReason?` — with **no stored `status`** (active = `exitDate IS NULL`; `exitReason ∈ {COMPLETED, TRANSFERRED, DROPPED, SUSPENDED, CORRECTION}`) and **no** `stageId`. A student's stage placement lives on **`PedagogicalProgress`** (`enrollmentId`, `stageId`, `startDate`, `endDate?`, `endReason?`); the **active** record (`endDate IS NULL`) is the current stage. REGULAR enrollments usually have one progress record (matching `Class.sharedStageId`); PERSONALIZED/PPT enrollments accumulate sequential records as the student advances **without** changing class. This replaces the earlier `stageAtEnrollment` snapshot, which drifted for PPT. Transfers, drops, and class splits are enrollment lifecycle events; movement history is preserved. The _assisted_ conflict-resolution flow (transfer → reschedule class → split → move to PPT) is **deferred** — MVP supports the moves manually. Pedagogical **evaluation** (grades, assessments, pass/fail, auto-progression) stays Phase 2 ([D-0022 amendment](./decisions.md#d-0022-class--enrollment--bones-now-brain-later)).

### S-ENR-1 · Enroll a student into a class `P0`

**As a** secretary, **I want** to enroll a student in a class **so that** they appear in the roster.

- Pick student → pick class → start date (defaults today). **Enrollment is rolling** — students may join at any point during a semester (see [D-0008](./decisions.md#d-0008-rolling-enrollment-and-contract-periods)).
- Optionally: end date (mid-semester join with end), or open-ended.
- Capacity check: warn if class is at capacity, allow override with reason.
- **Seeds the initial `PedagogicalProgress`** (D-0031): REGULAR copies the class's `sharedStageId`; PERSONALIZED requires the operator to pick the student's starting `Stage` (within a track). Every active enrollment must have exactly one active progress record.
- **Order prompt**: if the student has **no `ACTIVE` order** (non-cancelled, with open balance) for the relevant payer, prompt to create one (S-FIN-1). Since orders are decoupled from the academic calendar, the trigger is "no open commitment", not "no order covering this date".

### S-ENR-2 · Move / transfer between classes `P1`

**As a** secretary, **I want** to move a student to a different class mid-semester **so that** their attendance history stays intact.

- Sets `endDate` on current enrollment, opens new enrollment on the next class.
- Closes the active `PedagogicalProgress` (`endReason = TRANSFERRED`) and opens a new active one on the new enrollment (REGULAR copies the target class's `sharedStageId`; PERSONALIZED carries the student's current stage forward).
- Past attendance untouched. Future sessions on old class no longer show student.

### S-ENR-3 · Drop / pause a student `P1`

**As a** secretary, **I want** to mark an enrollment as dropped **so that** they stop appearing in active rosters.

- Sets enrollment `endDate`; updates student `status` if no other active enrollments.
- Prompts: "Mark remaining installments as waived? [Yes/No]."

### S-ENR-4 · Advance a student to the next stage `P0`

**As an** admin/coordinator, **I want** to advance a student to the next stage **so that** PPT progression is recorded without closing their class enrollment.

- One action on an enrollment. Transactional (see [D-0031](./decisions.md#d-0031-enrollment-is-operational-stage-placement-lives-on-pedagogicalprogress)): find the active `PedagogicalProgress`; find the next `Stage` in the same `Track` by `sequence + 1`; set the current record's `endDate` + `endReason = ADVANCED`; create a new active `PedagogicalProgress` at the next stage; **keep the enrollment active**.
- Primarily for PERSONALIZED/PPT, where a student advances stages while staying in the same class, schedule, and teacher.
- REGULAR progression happens instead via class lineage / "clone for next period" ([S-CLS-1](#s-cls-1--manage-class-catalog-p0)), which creates a successor class + enrollment + initial progress record.
- If there is no next stage in the track (end of path), the action is unavailable and surfaces "fim da trilha".
- **No** grades/assessment/pass-fail gating in MVP — advancement is an operational placement move (evaluation deferred to Phase 2).

---

## 7. Attendance

> **UI note:** Mobile attendance screen → GRE-33. Makeup scheduling UI → planned. Backend: GRE-34, GRE-61, GRE-35–38.

### S-ATT-1 · Mark attendance on phone `P0`

**As a** teacher, **I want** to tap each student's status fast **so that** I can do it during/right after class.

- Mobile-first layout: student row = photo (if any) + name + 3-day attendance streak dots + status buttons.
- Status set: **`PRESENT | ABSENT`** (2 buttons, large tap targets). `LATE` is **not** tracked in MVP (see [D-0009](./decisions.md#d-0009-attendance-reality-and-no-late-in-mvp)).
- **Explicit confirm, no server-side draft (see [D-0029](./decisions.md#d-0029-attendance--neutral-data-state-untaken-session-flag--formula)):** the UI **pre-selects PRESENT** so the teacher only taps absentees, but nothing is persisted until the teacher presses `Confirmar chamada`. The session becomes **"taken" only on that one per-session confirm** (no per-student submit). On confirm: untouched students commit as `PRESENT`, toggled students commit as `ABSENT`, and the session is stamped `attendanceConfirmedAt`. All-present case = teacher taps only Confirm.
- **Untaken-session flag:** if the session's scheduled end time passes (`America/Sao_Paulo`) with `attendanceConfirmedAt` still null, the session is flagged untaken — **excluded from the Portal nightly job** ([S-Portal-1](#8-portal-auto-submission--the-wedge)) and surfaced on the Portal health card / dashboard. Confirming later (via [S-ATT-4](#s-att-4--same-day-teacher-edit-window-p0) / [S-ATT-5](#s-att-5--admin-fixes-past-attendance-p0)) clears the flag.
- Current state varies by teacher: some mark on paper (which the coordenação then re-types into the Portal Portal); others type directly into the Portal. Our app becomes the single source of truth either way ([D-0009](./decisions.md#d-0009-attendance-reality-and-no-late-in-mvp)).
- Offline NOT required in MVP. (Wifi: Coordinator A reports excellent everywhere; Coordinator B reports patchy in some rooms — revisit if rollout surfaces dead zones.)

### S-ATT-2 · Makeup students appear in roster `P0`

**As a** teacher, **I want** to see students doing a makeup **so that** I know who's "visiting."

- Secretary schedules the makeup in advance (S-ATT-3).
- Visiting students render at the top of the roster with a "VISITANTE — turma origem: X" tag, sourced from `Makeup` rows (see [D-0029](./decisions.md#d-0029-attendance--neutral-data-state-untaken-session-flag--formula)) — **not** an attendance record.
- At confirm, the teacher marks whether the visitor showed → sets the `Makeup`'s `attendedAt` (status derives to `ATTENDED`/`NO_SHOW`). The origin session is **not** modified.
- **Makeup does not affect attendance %** (neither origin nor target): no present-equivalent credit, no penalty on no-show. It is tracked for coordination only ([S-REP-4](#s-rep-4--per-student-attendance-summary-p0)).

### S-ATT-3 · Schedule a makeup (coordinator / admin) `P0`

**As a** coordinator (logging in as `ADMIN`) / secretary, **I want** to schedule a student into another class for one date **so that** they get credit if they show up.

- Owned by the coordenação / assistente pedagógico in practice (see [D-0010](./decisions.md#d-0010-makeup-scheduling-owner)); `ADMIN` is the role they hold in our system. (`SECRETARY` backup returns when that role is re-enabled in Phase 2.)
- From student profile → "Agendar reposição" → pick target class + date (must be ≥ today + 1 — "precisa avisar com antecedência").
- Creates a `Makeup` row: `originEnrollmentId` = student's home enrollment, `targetClassSessionId` = target session, `scheduledAt`/`scheduledBy` (see [D-0029](./decisions.md#d-0029-attendance--neutral-data-state-untaken-session-flag--formula)). No attendance record is created at booking; outcome (`ATTENDED`/`NO_SHOW`/`CANCELLED`) is set/derived later.

### S-ATT-4 · Same-day teacher edit window `P0`

**As a** teacher, **I want** to fix attendance mistakes the same day **so that** I don't have to bother the secretary.

- Teacher can edit any attendance row on a session where `session.date == today` (`America/Sao_Paulo`).
- After midnight, attendance is read-only for teacher; `ADMIN` can still edit (secretary-equivalent work in MVP).
- Edits update `lastModifiedBy` + `lastModifiedAt`.

### S-ATT-5 · Admin fixes past attendance `P0`

**As an** admin, **I want** to edit any past attendance **so that** I can reconcile against paper rolls.

- No date restriction for `ADMIN` (secretary-equivalent work in MVP).
- If the session was already submitted to Portal, edit triggers a re-submission queue (S-Portal-3).

---

## 8. Portal auto-submission (the wedge)

### S-Portal-1 · Nightly auto-submit `P0?` (conditional — resolved by Sprint-0)

**As the** system, **I want** to submit yesterday's attendance to Portal every night **so that** staff stop re-typing and the submission stops being late.

> **Conditional priority (2026-06-17).** This story is **P0 only if the Sprint-0 Portal spike confirms unattended automation is feasible**; otherwise it is re-planned (degraded scope / P1) after Sprint-0. **Sprint-0 exit criteria that decide it:** (1) recorded Portal walkthrough completed; (2) master-login **2FA/OTP** question answered (no 2FA ⟹ automation viable); (3) class-location semantics confirmed for **REGULAR** _and_ **PERSONALIZED/PPT** classes (PPT has no `sharedStageId` — see [§15.11](#15-open-questions-need-answers-before--during-week-1)). Until all three pass, S-Portal-1 is not "ready". See [D-0023](./decisions.md#d-0023-portal-master-login-and-name-based-matching) / [D-0027](./decisions.md#d-0027-implementation-sequencing).

- Hatchet cron at 02:00 `America/Sao_Paulo`.
- Cloud Run worker `portal-submit` (Playwright) logs in with a **shared school master credential** (GCP Secret Manager), navigates to each class **by its Portal class name/schedule**, and marks attendance per student.
- **Only confirmed sessions are submitted** (`attendanceConfirmedAt` set). Sessions flagged as untaken ([S-ATT-1](#s-att-1--mark-attendance-on-phone-p0) / [D-0029](./decisions.md#d-0029-attendance--neutral-data-state-untaken-session-flag--formula)) and `CANCELLED` sessions are skipped and surfaced on the health card.
- **No external student ID** (revised 2026-06-17, [D-0023](./decisions.md#d-0023-portal-master-login-and-name-based-matching)): students are matched **by name** on the Portal class roster. Names must be preserved verbatim from import.
- Per-student submission: `present:boolean` only (no justification text).
- Idempotent: re-running the same day doesn't duplicate; marks `portalSubmittedAt`.
- Logs contain no student PII (use IDs only).
- **⚠️ Wedge risk:** if the master login enforces 2FA/OTP, unattended nightly automation is not possible and the wedge degrades to an _assisted_ "one-click submit with a human present." Resolving this is the top goal of the Sprint-0 Portal walkthrough (see [§15](#15-open-questions-need-answers-before--during-week-1)).
- Current state Coordinator A reports: submission happens _"quando dá tempo / atrasamos"_ — irregular and often late. The nightly cron exists as much to fix cadence as to eliminate retyping (see [D-0009](./decisions.md#d-0009-attendance-reality-and-no-late-in-mvp)).

### S-Portal-2 · Failure alerts `P0`

**As an** admin, **I want** to know immediately if Portal submission fails **so that** I can fix it before the school day starts.

- On failure: Sentry captures + Resend email to admin distribution list.
- Email body: which class(es) failed, link to retry from app.
- Sentry cron monitor confirms job ran at all.

### S-Portal-3 · Manual re-submit `P0`

**As a** secretary, **I want** a "submit now" button **so that** I can recover from failures or push corrections.

- Per session: "Reenviar para Portal" button (visible if `portalSubmittedAt` is null or if attendance changed after submission).
- Enqueues the same `portal-submit` workflow with a single-session payload.
- UI polls and shows status: enqueued / running / success / failed + last attempt timestamp.

### S-Portal-4 · Portal health card on dashboard `P0`

**As an** admin, **I want** to see Portal status at a glance **so that** I trust the automation.

- Card: last 7 days × per-day badge (✅ submitted / ⚠️ partial / ❌ failed / — closed day).
- One click opens the day's detail with per-class status.

---

## 9. Finance — Orders, installments, payments

> **Model & scope live in [decisions.md](./decisions.md) — this section specifies the stories.** Field-level schema, derived statuses, invariants, and rationale are in [D-0032](./decisions.md#d-0032-finance-ledger--derive-dont-store-adjustments-payer-scoped-payments) (ledger model, refines [D-0028](./decisions.md#d-0028-finance-core-model--order)), [D-0017](./decisions.md#d-0017-finance-mvp--receivables--revenue-tracking-only) (MVP = receivables & revenue tracking only), and [D-0014](./decisions.md#d-0014-cora-coexistence) (Cora coexistence). In brief:
>
> - **Entities:** **`Order`** (belongs to one **`Payer`**, has explicit `kind`, covers ≥1 student via **`OrderBeneficiary`**, where Beneficiary ≡ Student) → ≥1 **`Installment`** (+ signed **`InstallmentAdjustment`** rows); **`PaymentEntry`** belongs to a **`Payer`** and is applied to installments via divisible **`PaymentAllocation`** rows that may span the payer's orders.
> - **Order is decoupled** from any academic period/enrollment/class/stage. `Order.principalAmount` is the agreed principal; **all statuses and balances are derived at read time, not stored** (no stored `period`, order/installment `status`, signing `discount`, or `SUPERSEDED`).
> - All amounts are **integer cents, BRL-only**. MVP **records** orders → installments → manually-entered payments and reconciles against Cora; it does **not** issue boletos, run a checkout, or process payments (Phase 2).
> - **Deferred:** the full ad-hoc-charge flow (materials by stage, reimbursements) is parked until modeled with the stage taxonomy. `Order.kind` classifies the receivable as `TUITION | ENROLLMENT_FEE | MATERIAL | OTHER`, but does not add a pricing catalog or charge-generation workflow.

### S-FIN-1 · Create an order (enrollment) `P0`

**As an** admin, **I want** to create an order when enrolling a student **so that** the financial commitment is captured.

- Fields: `payer` (select an existing `Payer` or create one — `name`, `taxId` CPF/CNPJ, `phone`, `email`), `kind` (`TUITION | ENROLLMENT_FEE | MATERIAL | OTHER`), `beneficiary(ies)` (≥1 student, via `OrderBeneficiary`), `principalAmount` (final agreed principal **in cents**, BRL), `installmentCount`, `startDate`, `dueDay` (one of `{5, 10, 15, 20, 25}`, picked at signing; see [D-0011](./decisions.md#d-0011-installment-defaults)), optional `signedOrderArtifactId` UUID. There is **no stored generation preset** (`ANNUAL`, `SEMESTRAL`, `PER_STAGE`, `CUSTOM`); installments may cover any commercial window defined by the negotiated count and due dates.
- The student is the _beneficiary_; the **payer** is who is billed/contacted (see [D-0025](./decisions.md#d-0025-payer-as-a-first-class-entity)). Statements and collection target the order's payer.
- **No signing-discount field.** Any negotiated discount is folded into `principalAmount` (gross/list and discount-granted are not stored in MVP — accepted reporting gap). Post-generation reductions use a `DISCOUNT` `InstallmentAdjustment`.
- On save: auto-generates `Installment` rows monthly on the chosen `dueDay`. Equal split with the **remainder on the last installment** so `Σ(installments) == principalAmount`. `firstDueDate` is derived (next occurrence of `dueDay` after `startDate`), not entered.
- An order is **not** tied to a `Semester` or any enrollment/class/stage; it may span any commercial window. Academic context is navigated via the linked student.
- **Re-issue** (price change) is operational. The order is **editable only while it has no financial activity** (no `PaymentAllocation`, `waivedAt`, or `InstallmentAdjustment` on any installment); once locked, changes go via cancel + recreate or `CORRECTION`/`DISCOUNT` adjustments ([D-0032](./decisions.md#d-0032-finance-ledger--derive-dont-store-adjustments-payer-scoped-payments)). There is **no** `SUPERSEDED` state in MVP.
- Full **ad-hoc charge** management (pricing catalogs, material-by-stage rules, reimbursements) is **deferred** — see the core-model note above. `Order.kind` is the MVP classification field for orders that are recorded manually or by the enrollment flow.

### S-FIN-2 · View installment status per order `P0`

**As a** finance staff member, **I want** to see each installment's status **so that** I know what's open.

- **Derived** `InstallmentDisplayStatus`: `UPCOMING | DUE_THIS_MONTH | OVERDUE | PAID | WAIVED` — computed at read time (priority WAIVED → PAID → OVERDUE → DUE_THIS_MONTH → UPCOMING), **never stored**, no nightly transition job ([D-0032](./decisions.md#d-0032-finance-ledger--derive-dont-store-adjustments-payer-scoped-payments)).
- Per-installment derived amounts shown separately: `paidAmount = Σ allocations`, `currentExpected = amount + Σ adjustments`, `remaining = currentExpected − paidAmount`. A partially-paid installment still shows DUE_THIS_MONTH/OVERDUE with `remaining`.
- **Interest** preview: **1%/month** (`interestRatePctMonthly`, default `1.0`) — display-only projection, **no auto-accrual**. When actually charged, interest/multa are `INTEREST` / `LATE_FEE` `InstallmentAdjustment` rows (backbone in MVP, management UI Phase 2; see [D-0012](./decisions.md#d-0012-interest-and-multa)).
- **Multa** rate is `TODO: validate with school` (Coordinator B: usually not charged; Coordinator A: a fixed value/percentage, rate unstated).

### S-FIN-3 · Register a payment entry `P0`

**As an** admin, **I want** to log when money came in **so that** the receivables board is accurate.

- A `PaymentEntry` belongs to a **`Payer`** (the money source), not an order: `payerId`, `date`, `amountCents`, `method` (PIX/cash/transfer/card/cheque/other), `note`, optional `externalReference` (Cora id).
- After saving the entry, allocate its amount across one or more installments (`PaymentAllocation` rows, divisible). Allocations may span **multiple orders of the same payer**.
- **Allocation UI starts from the payer**: lists all open installments across that payer's orders, with input fields; allocations may be partial and span installments.
- Invariants ([D-0032](./decisions.md#d-0032-finance-ledger--derive-dont-store-adjustments-payer-scoped-payments)): `Σ(allocations of entry) ≤ entry amount`; `Σ(allocations to installment) ≤ currentExpected`; every allocated installment's order shares the entry's payer; amounts non-negative. Overpayment is **not** carried forward, but the **unallocated remainder** (`amount − Σ allocations`) stays **visible** on the entry. No refunds/negative entries in MVP.
- **Batch reconcile (Cora):** multi-select installments after checking Cora → groups by payer → creates **one `PaymentEntry` per payer** + one full `PaymentAllocation` per installment (default = `remaining`), with settlement date + method + optional `externalReference`. "Paid" is derived — there is no settled flag and no Cora API import in MVP.

### S-FIN-4 · Track collection attempts (non-payment) `P1`

**As a** finance staff member, **I want** to log when I contacted a student about a debt **so that** I don't double-chase.

- Per overdue installment: "Registrar tentativa de cobrança" → channel (WhatsApp/call/email), outcome (no answer / promised by date / disputed), free-text note.
- Distinct from `PaymentEntry` (which represents actual money). Stored on the installment timeline.

### S-FIN-5 · Mark installment as waived `P1`

**As an** admin, **I want** to waive an installment **so that** scholarships and disputes are handled cleanly.

- Requires reason. Sets `waivedAt` + `waivedReason` on the installment (the canonical full-waiver fact); `InstallmentDisplayStatus` derives to `WAIVED` and its `openBalance` contribution becomes 0 ([D-0032](./decisions.md#d-0032-finance-ledger--derive-dont-store-adjustments-payer-scoped-payments)). **Forgives only the remaining** — existing allocations/`paidAmount` are untouched and still count as revenue. Allowed only when `remaining > 0`.
- Stamped with `lastModifiedBy`. (No `waivedById` audit field in MVP; partial forgiveness uses a negative `DISCOUNT`/`CORRECTION` adjustment instead.)

### S-FIN-6 · Receivables dashboard `P0`

**As a** finance staff member, **I want** an overview of open + overdue **so that** I know who to chase today.

- Cards: total expected this month, total received this month, total overdue (with age buckets: 1-7 / 8-30 / 30+ days).
- Overdue list table: student, oldest overdue date, total open, quick-actions (WhatsApp link, register payment). _("Last contact attempt" column + "register attempt" action are added when S-FIN-4 collection logging ships (P1) — not in P0.)_

### S-FIN-7 · Per-student statement (extrato) `P0`

**As a** secretary, **I want** to generate a student's full charge + payment history **so that** I can send it when a parent asks.

- Async via `report-generate` workflow → PDF in GCS.
- Includes: all orders, all installments with status, all payment entries with allocations.

### S-FIN-8 · Discounts `P1`

**As an** admin, **I want** to apply discounts **so that** sibling / scholarship cases are honored.

- **Signing discount is not a stored field** ([D-0032](./decisions.md#d-0032-finance-ledger--derive-dont-store-adjustments-payer-scoped-payments)): any negotiated discount is folded into `Order.principalAmount` at creation. MVP cannot report "discount granted at signing" (accepted gap).
- **Post-generation per-installment discount**: a `DISCOUNT` `InstallmentAdjustment` (negative amount + reason) reduces a specific installment's `currentExpected`. Requires reason; reflected in derived balances.
- No automatic discount rules (sibling, early-payment) in MVP — applied manually.

---

## 10. Expenses & vendor contracts

> **DEFERRED TO PHASE 2 ([D-0020](./decisions.md#d-0020-defer-expenses)).** Expense tracking — and therefore the cash-position card and any true P&L view — is out of MVP. Full story specs (S-EXP-1…S-EXP-4) live in [PHASE-2.md](./PHASE-2.md#expenses--vendor-contracts).

---

## 11. Leads / CRM

> **DEFERRED TO PHASE 2 ([D-0019](./decisions.md#d-0019-defer-leads--crm)).** The lead/CRM pipeline is out of MVP. Consequence: the `LEAD`/`TRIAL` student statuses are removed (see S-STU-4), and the lead → student conversion flow is Phase 2. Full story specs (S-LEAD-1…S-LEAD-6) live in [PHASE-2.md](./PHASE-2.md#leads--crm).

---

## 12. Notifications (Email in MVP; WhatsApp Phase 2)

> **MVP = transactional email only (revised 2026-06-17, [D-0018](./decisions.md#d-0018-notifications-mvp--transactional-email-only)).** Resend handles magic links, Portal failure alerts, and the finance overdue digest. **WhatsApp via Evolution API is deferred to Phase 2** (demotes S-NOT-1 from `P0`). MVP ships hardcoded email triggers in S-NOT-2; the configurable rule engine (S-NOT-3) and WhatsApp channel are Phase 2. This removes self-hosted-Evolution infra from the week-1 critical path.

> **S-NOT-1 (WhatsApp via Evolution API) and S-NOT-3 (configurable communication rules) are deferred to Phase 2** ([D-0018](./decisions.md#d-0018-notifications-mvp--transactional-email-only)). Full specs live in [PHASE-2.md](./PHASE-2.md#notifications--whatsapp--configurable-rules).

### S-NOT-2 · Email send via Resend `P0`

**As the** system, **I want** to send email **so that** staff and students get formal notices.

- Resend used for: magic links, Portal failure alerts, daily overdue digest to admin, transactional notices.
- **MVP default email triggers** (hardcoded; do not duplicate Cora's D-15 / D0 / D+5 / D+10 / D+15 schedule — see [D-0014](./decisions.md#d-0014-cora-coexistence)):
  1. Installment overdue **D+30** → email to payer/responsável (after Cora's D+15 email).
  2. Portal submission failure → email to admin distribution.
  3. **Daily overdue digest** → email to the admin distribution at **07:00 `America/Sao_Paulo`**, summarizing current overdue receivables (count + total open, with age buckets) — the S-FIN-6 snapshot in email form. (This is the "daily overdue digest" referenced above; it is the only scheduled/non-event email in MVP.)

### S-NOT-4 · Per-student opt-out `P1`

**As an** admin, **I want** to mark a student as "do not contact" **so that** LGPD/preferences are honored.

- Boolean per student; suppresses outbound email except magic link. (WhatsApp suppression added when S-NOT-1 ships.)

---

## 13. Dashboards & reports

### S-DASH-1 · Admin dashboard `P0`

**As an** admin, **I want** a single landing page **so that** I see the week at a glance.

- Cards:
  - Active students count + new this month (S-STU-\*)
  - Receivables snapshot: expected / received / overdue (S-FIN-6)
  - ~~Leads due follow-up today (S-LEAD-3)~~ — **deferred (leads Phase 2)**
  - Portal submission health (S-Portal-4)
  - ~~Cash position this month (S-EXP-3)~~ — **deferred (expenses Phase 2)**

### S-DASH-2 · Receivables dashboard (admin) `P0`

- Receivables snapshot + overdue list (S-FIN-6). No expense summary in MVP (expenses Phase 2).

### S-DASH-3 · Teacher home `P0`

- Today's classes (linked to attendance) + next session date for each.

### S-REP-1 · Overdue receivables report `P0`

**As** finance, **I want** an exportable overdue list **so that** I can share with the accountant.

- CSV via `report-generate`. Columns: student, order, installment due date, amount, age in days. _("Last contact attempt" column added when S-FIN-4 ships (P1).)_

### S-REP-2 · Monthly accountant CSV `P0`

**As** finance, **I want** a month-close CSV **so that** the accountant gets a clean ledger.

- Includes: all payment entries with allocations and all waivers in the month. (Expenses excluded — module deferred to Phase 2.)

### S-REP-3 · Class roster PDF `P0`

**As a** teacher / secretary, **I want** a printable roster **so that** I have paper backup.

- Per class, current semester. PDF via `report-generate` → GCS.

### S-REP-4 · Per-student attendance summary `P0`

**As a** secretary, **I want** a per-student semester attendance % **so that** I flag students at risk of failing the attendance minimum.

- Profile section + downloadable PDF. Shows, **per `(enrollment, semester)`**: sessions held, present, absent, %. Makeup count may be shown as a **separate operational stat** (not part of the %). (No `late` column — `LATE` is not in the MVP status set; see [D-0009](./decisions.md#d-0009-attendance-reality-and-no-late-in-mvp).)
- **Formula (see [D-0029](./decisions.md#d-0029-attendance--neutral-data-state-untaken-session-flag--formula)):** `% = PRESENT / held_sessions`, where `held_sessions` = non-`CANCELLED`, **confirmed** sessions (`attendanceConfirmedAt IS NOT NULL`) in **`Semester window ∩ Enrollment window`**. The confirmed predicate means **future** sessions and **untaken** past sessions are excluded automatically (numerator and denominator share one source — `PRESENT` only exists on confirmed sessions). **Makeups do not count** (neither numerator nor denominator). The attendance minimum is **per 6-month semester, not per stage** — `PedagogicalProgress` is not involved. A lifetime enrollment % may be shown as an optional aggregate. Untaken sessions surface as a separate warning, **not** as silent absences.
- **Flag threshold: < 75%** per `(enrollment, semester)` — the attendance minimum per Coordinator A (`att_min_pct`). The flag **only evaluates when `held_sessions > 0`**: `flagged ⟺ held_sessions > 0 AND PRESENT / held_sessions < 0.75`.
- **Empty denominator:** when `held_sessions = 0` (no confirmed sessions yet — new enrollment / early semester / no call taken), the % renders as **"—" / "sem dados"** (not 0%, not 100%) and **is not flagged** ([D-0029](./decisions.md#d-0029-attendance--neutral-data-state-untaken-session-flag--formula)).

---

## 14. Discovery-driven scope changes

The full history of how scope evolved through discovery rounds lives in [CHANGELOG.md](./CHANGELOG.md). The PRD and [decisions.md](./decisions.md) below always reflect the **current** scope.

---

## 15. Open questions (need answers before / during week 1)

1. **Legacy export schema** — exact columns, encoding, sample file? Blocks S-STU-1.
2. **Portal walkthrough** — recorded session with a secretary doing it manually. Blocks S-Portal-1.
3. **Discount rules** — what discounts actually exist (sibling %, scholarship full-waiver, employee-family %)? MVP ships single manual discount; rules can come later.
4. **Multa rate** — 1%/month interest is confirmed; the multa value (% or fixed) is not. Coordinator A reports a fixed value/percentage; Coordinator B reports it is usually waived. Ask Coordinator A for the rate currently configured in Cora.
5. **Communication rule defaults** — confirm proposed S-NOT-3 Phase 2 defaults (including D+2 WhatsApp draft); MVP ships hardcoded email triggers in S-NOT-2 only.
6. ~~**Evolution API hosting** — self-host on GCP Cloud Run from day 1?~~ **Closed / deferred:** WhatsApp via Evolution API is Phase 2 ([D-0018](./decisions.md#d-0018-notifications-mvp--transactional-email-only)). Revisit when S-NOT-1 is scheduled.
7. **Artifact storage retention** — LGPD: how long do we keep generated reports, contract PDFs, and (Phase 2) expense receipts?
8. ~~**Substitute teacher list** — do substitutes pre-exist as `User` rows, or is it ad-hoc free text?~~ **Closed for Phase 2 design**: ad-hoc free text + `User` picker when S-CAL-3 ships ([D-0013](./decisions.md#d-0013-substitute-teacher-fallback)). **Not in MVP** ([D-0015](./decisions.md#d-0015-defer-substitute-teacher-assignment)).
9. **Infrastructure open items** still apply: web host, Cloud SQL connectivity, CI/CD, staging, GCS retention, and PDF library.
10. **Portal master login & 2FA** — does the shared Portal Prof credential enforce 2FA/OTP? If yes, unattended nightly automation is blocked (see S-Portal-1 wedge risk). Top Sprint-0 question.
11. **Portal class name semantics** — confirm `1S/2S` (semester?) and the trailing `-1` suffix in names like `REG/TUI-TER-14:00/16:00-1S/26-1`, and confirm that **`Stage.internalCode` is the right stage segment** and that Portal's class list is locatable by the derived class-name string (there is **no** separate per-stage Portal code — see [D-0030](./decisions.md#d-0030-course-catalog--track-and-stage)). **Also unresolved: how PERSONALIZED/PPT classes are named/located in Portal** — they have `sharedStageId = null`, so there is no stage segment to derive from ([D-0021](./decisions.md#d-0021-class-modality-as-two-axes)). This blocks the wedge for PPT classes until the walkthrough clarifies it.
12. **Stage taxonomy & modeling** — **modeling resolved** ([D-0030](./decisions.md#d-0030-course-catalog--track-and-stage) ProductLine → Track → Stage; [D-0031](./decisions.md#d-0031-enrollment-is-operational-stage-placement-lives-on-pedagogicalprogress) placement on `PedagogicalProgress`). Equivalences remain unmodeled by decision. GRE-24 seeds the real Lazuli catalog from [discovery/course-stage-ordering.md](../discovery/course-stage-ordering.md); GRE-13 validates whether those internal stage codes and derived class names match the external Portal.
13. **PPT minimum age** — confirm the minimum age (≈8?) for moving a child to personalized/PPT.
14. **Confirm `PERSP` = personalized/PPT** as Portal's external code for the modality.
15. **Justified absence ("falta justificada") policy** — discovery diverges: Coordinator A says it does not count as absence; Coordinator B treats it as an absence-with-makeup. The MVP attendance set is `PRESENT | ABSENT` (no `JUSTIFIED`); makeup is now a **separate workflow that does not affect the %** ([D-0029](./decisions.md#d-0029-attendance--neutral-data-state-untaken-session-flag--formula)), so **every `ABSENT` currently counts equally** and the old "convert to makeup for credit" workaround is **void**. Decide whether to (a) add a `JUSTIFIED` status, (b) exclude justified absences from the denominator, or (c) some makeup-linked neutralization. Until decided, the MVP default is **every absence counts**.

---

## 16. Out of scope for MVP (Phase 2+)

Current Phase 2+ backlog:

- Payment processor integration (PIX/boleto via Asaas/Iugu).
- Student/parent self-service portal.
- Apple Sign In.
- Grades / report cards beyond attendance %.
- Advanced analytics (DRE close, churn funnel, lead conversion funnel).
- Document generation beyond invoices + statements (enrollment letters, custom templates).
- Material/book sales tracking (separate from contract materials line).
- Multi-tenant SaaS.
- Vendor / employment contract management (S-EXP-4).
- Configurable communication rules engine and UI (S-NOT-3) — MVP uses hardcoded email triggers in S-NOT-2.
- Enrollment fee (matrícula, R$ 200 for new students) — no MVP story; record outside the system or add in Phase 2.
- Cancellation fine (20% of remaining installments on mid-contract cancel) — no computation UI in MVP; staff compute manually (S-ENR-3 / S-FIN-5 handle waivers only).
- **Multiple guardians per student**, household groups, and sibling-discount rules. (A **single** structured `Guardian` + shared `Address` per student **is** in MVP — see [D-0033](./decisions.md#d-0033-structured-guardian-and-address-entities); only multi-guardian households and discount automation remain deferred.)
- Read-access PII audit log.
- Substitute-teacher assignment on a session (S-CAL-3) — MVP uses session cancel only ([D-0015](./decisions.md#d-0015-defer-substitute-teacher-assignment)).
- **Leads / CRM pipeline** (entire §11) — Phase 2 ([D-0019](./decisions.md#d-0019-defer-leads--crm)).
- **Expenses module** (entire §10), cash-position card, and true P&L — Phase 2 ([D-0020](./decisions.md#d-0020-defer-expenses)).
- **WhatsApp / Evolution API** (S-NOT-1) — Phase 2 ([D-0018](./decisions.md#d-0018-notifications-mvp--transactional-email-only)).
- **Charge/boleto issuance, checkout, and payment processing** — Phase 2; MVP only records payments manually ([D-0017](./decisions.md#d-0017-finance-mvp--receivables--revenue-tracking-only)).
- **Automated Cora reconciliation** (import of settled boletos) — Phase 2; #1 pick.
- **Pedagogical evaluation** — grades, assessments, test attempts, pass/fail rules, automatic progression, skill/content-level tracking, report cards, teacher evaluation — Phase 2 ([D-0022 amendment](./decisions.md#d-0022-class--enrollment--bones-now-brain-later)). Note: **structural** stage placement + progression history **is** in MVP via `PedagogicalProgress` ([D-0031](./decisions.md#d-0031-enrollment-is-operational-stage-placement-lives-on-pedagogicalprogress)); only evaluation is deferred.
- **Assisted / constraint-driven class generation** (availability solver, auto-suggest continuity, auto-split) — Phase 2 ([D-0022](./decisions.md#d-0022-class--enrollment--bones-now-brain-later)).
- **`SECRETARY` / `FINANCE` roles** and admin impersonation — Phase 2 ([D-0016](./decisions.md#d-0016-mvp-role-set--admin--teacher)).
- **In-app Legacy importer UI** — not planned; revisit only if repeated imports become a real operational need. MVP uses a short-lived ad hoc script ([D-0026](./decisions.md#d-0026-legacy-import--one-shot-script)).
