# [P05] Attendance (the wedge core)

**Increment:** Increment 1 (Wedge)
**Status:** `ready-for-agent`
**Depends on:** P03 (sessions), P04 (enrollment roster)
**Blocks:** P06 (Portal submission), P08 (attendance reports/dashboards)

## Goal

The product's reason to exist: teachers mark and **explicitly confirm** attendance on a phone,
makeups flow as a separate workflow, and committed attendance becomes the source of truth for Portal
submission. Present/absent only; no server-side drafts.

## Spec anchors

- PRD: S-ATT-1..S-ATT-5
- Technical Spec: §4.6, §5.2, §5.3, §7.1, §8
- Decisions: D-0009, D-0010, D-0029

## Issues

### Attendance + makeup schema, commit facts

- **Status:** `ready-for-agent`
- **Depends on:** GRE-27, GRE-26
- **Trace:** §4.6, S-ATT, D-0029
- **Goal:** `Attendance` (present/absent), makeup model, `attendanceLastCommittedAt`, untaken-session derivation via `sessionEndInstant`; no stored attendance-percent column.
- **Acceptance:**
  - [ ] Roster-count check + session/enrollment class+window match enforced.
  - [ ] Committed attendance carries `lastModifiedById`/`lastModifiedAt` (§1.2(8)).
  - [ ] No server-side draft/autosave table (§14 guardrail).

### Mark + confirm attendance on mobile

- **Status:** `ready-for-agent`
- **Depends on:** GRE-34
- **Trace:** §5.3, §7.1, §8, S-ATT-1
- **Goal:** Mobile attendance UI; selections persisted **only** by `attendance.confirmSession`; explicit confirm; untaken sessions visible until taken.
- **Acceptance:**
  - [ ] Marking without confirm persists nothing; confirm commits all rows atomically.
  - [ ] Works on a mobile viewport (E2E smoke, §10.1).

### Makeups: schedule + visitor on roster + outcome

- **Status:** `ready-for-agent`
- **Depends on:** GRE-34
- **Trace:** §4.6, §5.3, S-ATT-2, S-ATT-3, D-0010
- **Goal:** Coordinator/admin schedules a makeup (advance-date constraint); makeup visitor appears on the target session roster; teacher captures the visitor outcome. Makeups do not affect attendance %.
- **Acceptance:**
  - [ ] Makeup must be scheduled in advance; visitor shows on roster; outcome recorded on target session.
  - [ ] Makeup no-show derived from `sessionEndInstant`.

### Same-day teacher edit window

- **Status:** `ready-for-agent`
- **Depends on:** GRE-33
- **Trace:** §5.2, §5.3, S-ATT-4
- **Goal:** Teacher may edit own-class attendance same-day via resource scope; outside the window only admin can.
- **Acceptance:**
  - [ ] Teacher edit allowed for own class, same day; blocked otherwise (tRPC integration test).

### Admin fixes past attendance

- **Status:** `ready-for-agent`
- **Depends on:** GRE-33
- **Trace:** §4.4, §4.6, §5.3, S-ATT-5
- **Goal:** Admin edits past attendance; edits update `attendanceLastCommittedAt` so Portal re-submission is derivable.
- **Acceptance:**
  - [ ] Admin edit re-stamps commit fact; downstream Portal retry derivation sees the change (consumed by P06).

## Definition of done (project)

- [ ] Confirm/all-present/absent and scope rules covered by tRPC + E2E tests (§10.1).
- [ ] Committed attendance is a stable source of truth for P06.
