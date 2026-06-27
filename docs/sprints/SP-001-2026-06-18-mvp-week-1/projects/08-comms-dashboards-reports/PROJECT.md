# [P08] Comms, dashboards & reports

**Increment:** Increment 3 (Comms/Reports)
**Status:** `ready-for-agent`
**Depends on:** P05 (attendance), P06 (Portal facts), P07 (finance)
**Blocks:** —

## Goal

Transactional email, the admin/teacher dashboards, and the report/artifact generators that turn the
data from earlier projects into the things staff actually hand out and act on. Email is
transactional only — no rule engine, no WhatsApp (Phase 2).

## Spec anchors

- PRD: S-NOT-2 (P0), S-NOT-4 (P1); S-DASH-1..3; S-REP-1..4; S-Portal-2
- Technical Spec: §6.2, §7.1, §7.2, §9.3, §4.8
- Decisions: D-0007, D-0018

## Issues

### Email infra (Resend prod / Mailpit local)

- **Status:** `ready-for-agent`
- **Depends on:** P00-02
- **Trace:** §9.3, S-NOT-2, D-0007
- **Goal:** Email sending via Resend (prod) / Mailpit (local) from the worker; templates; no notification rule table (hardcoded triggers in code + Hatchet schedules, §1.2(7)).
- **Acceptance:**
  - [ ] Worker sends through Mailpit locally and Resend in prod; no PII in logs.

### Portal failure alert email

- **Status:** `ready-for-agent` (consumes P06 `PortalRun`)
- **Depends on:** P08-01, P06-01
- **Trace:** §6.2, §9.3, S-Portal-2
- **Goal:** Email alert on Portal submission failure (no Sentry in MVP), driven off `PortalRun` failure facts.
- **Acceptance:**
  - [ ] A failed `PortalRun` triggers exactly one alert email; recipient/content shape tested (worker test, §10.1).

### Overdue emails: D+30 + daily 07:00 digest

- **Status:** `ready-for-agent`
- **Depends on:** P08-01, P07-04
- **Trace:** §6.2, S-NOT-2 (S-NOT-4 opt-out is P1)
- **Goal:** D+30 overdue email (idempotent, no duplicate sends) and a daily 07:00 `America/Sao_Paulo` overdue digest. Per-student opt-out is P1 (no P0 schema, §4.2).
- **Acceptance:**
  - [ ] D+30 email idempotent (one per installment/threshold); digest fires at 07:00 BRT.

### Admin dashboard + teacher home

- **Status:** `ready-for-agent`
- **Depends on:** P05-02, P07-07; Portal card from P06-04
- **Trace:** §7.1, §8, S-DASH-1, S-DASH-3
- **Goal:** Admin dashboard cards (with deferred-card omissions per §8) and the teacher home; receivables + Portal health cards wired from their owning projects.
- **Acceptance:**
  - [ ] Cards match §7.1 sets/precedence; deferred cards omitted, not faked.

### Reports & artifacts (CSV + PDF)

- **Status:** `ready-for-agent`
- **Depends on:** P05-01, P07-04
- **Trace:** §6.2, §7.2, §4.8, S-REP-1..4
- **Goal:** Worker-generated artifacts: overdue receivables CSV, monthly accountant CSV (excludes expenses), class roster PDF, per-student attendance summary PDF (75% threshold formula). GCS artifact references, not signed URLs.
- **Acceptance:**
  - [ ] Each report produces an artifact with state transitions (worker test, §10.1).
  - [ ] Attendance summary uses the §7.2 formula; monthly CSV excludes expenses.
- **Open items:** PDF library + artifact retention policy still open (§1.3).

## Definition of done (project)

- [ ] Email digests, alerts, dashboards, and all four reports verified by worker + E2E tests (§10.1).
- [ ] Transactional-only: no rule engine, no WhatsApp, no expense data (§14).
