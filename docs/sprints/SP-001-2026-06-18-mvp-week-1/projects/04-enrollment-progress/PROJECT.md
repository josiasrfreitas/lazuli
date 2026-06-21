# [P04] Enrollment & pedagogical progress

**Increment:** Increment 1 (Wedge)
**Status:** `ready-for-agent`
**Depends on:** P02 (students), P03 (catalog/classes)
**Blocks:** P05 (attendance roster), P07 (order beneficiary link — soft)

## Goal

The operational student↔class link (`Enrollment`) and the structural stage placement/history
(`PedagogicalProgress`), kept distinct per D-0031. This is what makes a roster exist and what
"advance a student" means.

## Spec anchors

- PRD: S-ENR-1, S-ENR-4 (P0); S-ENR-2, S-ENR-3 (P1)
- Technical Spec: §4.5, §5.3
- Decisions: D-0008, D-0022, D-0031

## Issues

### [P04-01] Enrollment + PedagogicalProgress schema & invariants

- **Status:** `ready-for-agent`
- **Depends on:** P02-01, P03-04
- **Trace:** §4.5, S-ENR-1, D-0031
- **Goal:** `Enrollment` (operational link) and `PedagogicalProgress` (structural placement/history); invariants: one active progress, per-track active-enrollment uniqueness, archive/legacy/capacity guards. Decoupled from semester windows (D-0008).
- **Acceptance:**
  - [ ] Duplicate active enrollment in the same track blocked; different tracks allowed (§13).
  - [ ] Exactly one active progress per student; progress-window exclusion enforced.

### [P04-02] Enroll a student into a class

- **Status:** `ready-for-agent`
- **Depends on:** P04-01
- **Trace:** §5.3, S-ENR-1
- **Goal:** Enrollment-create transaction: capacity override with reason, active-progress seeding, and the order-prompt boundary (prompts finance, does not auto-create billing).
- **Acceptance:**
  - [ ] Over-capacity enroll requires an override reason.
  - [ ] Creating enrollment seeds active progress in one transaction.

### [P04-03] Advance a student to the next stage

- **Status:** `ready-for-agent`
- **Depends on:** P04-01
- **Trace:** §4.3, §4.5, §5.3, S-ENR-4
- **Goal:** Next-stage lookup by `sequence`; advancement updates `PedagogicalProgress` only (progress-only, not enrollment churn).
- **Acceptance:**
  - [ ] Advance moves progress to the next stage in sequence; no cross-track jump.
  - [ ] No billing side effects.

### [P04-04] Transfer / drop / pause (P1)

- **Status:** `ready-for-agent` (P1 — after P0 path stable)
- **Depends on:** P04-01
- **Trace:** §5.3, S-ENR-2, S-ENR-3
- **Goal:** Move/transfer between classes; drop/pause. Academic close/drop/pause does **not** auto-mutate billing (resolved assumption §13); staff use manual finance tools.
- **Acceptance:**
  - [ ] Transfer preserves progress; drop/pause flips enrollment without touching installments.

## Definition of done (project)

- [ ] Enrollment/transfer/advance + progress invariants covered by tRPC integration tests (§10.1).
- [ ] One-active-progress and per-track uniqueness enforced and tested.
