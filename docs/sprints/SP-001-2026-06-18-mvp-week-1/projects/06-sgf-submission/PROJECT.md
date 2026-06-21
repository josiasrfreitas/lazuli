# [P06] Portal auto-submission

**Increment:** Increment 1 (Wedge) — **GATED**
**Status:** `blocked` (gated by Sprint-0 spike [P00-08])
**Depends on:** P05 (committed attendance), [P00-08] gate outcome
**Blocks:** P08 Portal failure alert + health dashboard depend on these facts

## Goal

The automated daily submission of attendance to the Portal — the wedge's payoff.
Implementation **mode is decided by the Sprint-0 Portal spike**: automated (Playwright), assisted, or
not-viable for MVP. Do not build production behavior before that gate resolves.

## Spec anchors

- PRD: S-Portal-1 (gated P0), S-Portal-3, S-Portal-4
- Technical Spec: §1.2(5–6), §6.2, §9.1, §7.1
- Decisions: D-0023, D-0027

## Gate

> **Blocked until [P00-08] records the Portal mode in `decisions.md`.** Authoritative model stays
> Playwright + Portal class names + student names (D-0023); the discovered JSON API / `cdAluno` IDs are
> spike evidence only and require a PRD/decision update before becoming implementation contract or
> core schema (§1.2(5), §13). No Portal roster snapshots or student-ID mapping until empirical operation
> requires them (§14).

## Issues

### [P06-01] `PortalClient` adapter boundary + `PortalRun` facts

- **Status:** `blocked` (gate)
- **Depends on:** P05-01, P00-08
- **Trace:** §9.1, §6.2
- **Goal:** `PortalClient` interface in `packages/integrations`; Playwright-heavy implementation in worker-only `packages/worker-handlers`; `PortalRun` records queue/attempt/outcome facts (`queuedAt`/`attemptedAt`/`succeededAt`/`failedAt`, `portalSubmittedAt`). No PII in worker logs.
- **Acceptance:**
  - [ ] Web/api never import Playwright; only worker runs Portal.
  - [ ] `PortalRun` is the only queue/attempt/outcome record (no separate snapshot tables).

### [P06-02] Nightly auto-submit workflow

- **Status:** `blocked` (gate)
- **Depends on:** P06-01
- **Trace:** §6.2, S-Portal-1
- **Goal:** Hatchet schedule submits each eligible session's committed attendance; **skips cancelled/untaken sessions**; payload carries IDs only (§6.1).
- **Acceptance:**
  - [ ] Cancelled/untaken sessions skipped; one `PortalRun` per session attempt.
  - [ ] Behavior matches the mode chosen by [P00-08].

### [P06-03] Manual re-submit / retry

- **Status:** `blocked` (gate)
- **Depends on:** P06-01
- **Trace:** §4.4, §5.3, §6.2, S-Portal-3
- **Goal:** Admin enqueues a manual retry; retry eligibility derived from `attendanceLastCommittedAt` vs last successful `PortalRun`.
- **Acceptance:**
  - [ ] Manual retry queues a job and records a session-linked `PortalRun` (E2E smoke, §10.1).

### [P06-04] Portal health card on dashboard

- **Status:** `ready-for-agent` (presentation works in any mode)
- **Depends on:** P06-01
- **Trace:** §7.1, S-Portal-4
- **Goal:** Dashboard health card with the §7.1 status sets + precedence (submitted / failed / pending / untaken), derived from `PortalRun` + commit facts.
- **Acceptance:**
  - [ ] Card precedence matches §7.1; no stored status column.

> Portal **failure email alert** (S-Portal-2) is implemented in [P08](../08-comms-dashboards-reports/PROJECT.md)
> since it shares the email infra; it consumes `PortalRun` failure facts from this project.

## Definition of done (project)

- [ ] Portal mode from [P00-08] implemented behind `PortalClient`; submit skips cancelled/untaken (worker tests, §10.1).
- [ ] Manual retry + health card verified; no PII leaked to logs.
