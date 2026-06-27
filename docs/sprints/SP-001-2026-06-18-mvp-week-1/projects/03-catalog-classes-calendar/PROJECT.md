# [P03] Catalog, classes, calendar & sessions

**Increment:** Increment 1 (Wedge)
**Status:** `ready-for-agent`
**Depends on:** P00, P01
**Blocks:** P04 (enrollment), P05 (attendance), P06 (Portal class names)

## Goal

The academic structure attendance hangs off: the seeded Track→Stage catalog, semesters, school
closed days, classes (with their Portal locator name), and auto-generated class sessions.

## Spec anchors

- PRD: S-CAT-1, S-CLS-1, S-CLS-2, S-CAL-1, S-CAL-2, S-CAL-4
- Technical Spec: §4.3, §4.4, §5.3, §6.2, §7.2
- Decisions: D-0021, D-0022, D-0030

## Issues

### Track / Stage catalog seed

- **Status:** `ready-for-agent` (codes confirmed by [P00-09])
- **Depends on:** P00-03, P00-09
- **Trace:** §4.3, S-CAT-1, D-0030
- **Goal:** `Track` and `Stage` with stage-level `sequence` ordering; independent tracks (no cross-track order/equivalence); legacy behavior; seed-only (no catalog CRUD UI).
- **Acceptance:**
  - [ ] Stages ordered by `sequence` within a track; tracks independent.
  - [ ] Seed matches confirmed production codes.

### Semesters (no-overlap exclusion constraint)

- **Status:** `ready-for-agent`
- **Depends on:** P00-03
- **Trace:** §4.4, S-CAL-4
- **Goal:** `Semester` windows with a Postgres exclusion constraint rejecting overlap; semester setup is the trigger for session generation.
- **Acceptance:**
  - [ ] Overlapping semesters rejected at DB level (exclusion constraint, §3.3).
  - [ ] Unbucketed-session setup surfaces an error (per §6.2/§7.2).

### School closed days + federal holiday import

- **Status:** `ready-for-agent`
- **Depends on:** P00-03
- **Trace:** §4.4, §5.3, S-CAL-1
- **Goal:** Closed-day calendar; federal-holiday import procedure; closing a future day affects generation; reopen regenerates.
- **Acceptance:**
  - [ ] Holiday import populates closed days.
  - [ ] Closing/reopening a future day adds/removes the matching sessions on regenerate.

### Class catalog (slots, format axes, lineage, clone)

- **Status:** `ready-for-agent`
- **Depends on:** P03-01
- **Trace:** §4.4, §5.3, S-CLS-1, D-0021
- **Goal:** `Class` with scheduleType/format axes, schedule slots, status, one-teacher rule, nullable class-stage, `portalClassName` storage, lineage, and clone-for-next-period.
- **Acceptance:**
  - [ ] Exactly one teacher per class; slot integrity enforced (composite/partial-unique).
  - [ ] Active `portalClassName` uniqueness enforced; REGULAR generated vs PERSONALIZED/PPT manual per §1.2(6).
  - [ ] Clone produces a next-period class preserving lineage.

### Auto-generate class sessions

- **Status:** `ready-for-agent`
- **Depends on:** P03-02, P03-03, P03-04
- **Trace:** §4.4, §6.2, S-CLS-2
- **Goal:** Session generation job: idempotent, skips closed days, rolling horizon, setup-error reporting; sessions carry the `sessionEndInstant` semantics (§3.1).
- **Acceptance:**
  - [ ] Re-running generation does not duplicate sessions (idempotent).
  - [ ] Closed days produce no sessions; regeneration reconciles after calendar edits.

### Cancel one session (teacher-absence MVP path)

- **Status:** `ready-for-agent`
- **Depends on:** P03-05
- **Trace:** §4.4, §5.3, S-CAL-2
- **Goal:** Per-session cancellation with reason; cancellation blocked after committed/submitted attendance.
- **Acceptance:**
  - [ ] Cannot cancel a session whose attendance is committed/submitted.
  - [ ] No substitute-teacher fields (S-CAL-3 is P2, excluded §1.1/§13).

## Definition of done (project)

- [ ] Exclusion + composite/partial-unique constraints covered by DB integration tests (§10.1).
- [ ] Generation idempotency and cancellation guards covered by worker/tRPC tests.
