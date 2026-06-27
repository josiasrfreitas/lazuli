# [P02] Students

**Increment:** Increment 1 (Wedge)
**Status:** `ready-for-agent`
**Depends on:** P00, P01
**Blocks:** P04 (enrollment), P07 (finance beneficiary), P05 (roster names)

## Goal

The student record and the one-shot Legacy migration. Structured `Guardian` + shared `Address`,
fast search, profile aggregate, edits, and the status lifecycle — the people the whole system is about.

## Spec anchors

- PRD: S-STU-1, S-STU-2, S-STU-3, S-STU-4 (S-STU-5 deferred)
- Technical Spec: §4.2, §5.3, §9.2
- Decisions: D-0024, D-0033, D-0035 (field-level traceability deferred)

## Issues

### Student / Guardian / Address schema + constraints

- **Status:** `ready-for-agent`
- **Depends on:** GRE-7
- **Trace:** §4.2, S-STU-4, D-0033
- **Goal:** `Student` with `documentType`/`documentNumber`, status enum; single structured `Guardian`; shared `Address` entity; minor⇒guardian-required rule; no per-field attribution columns (D-0035).
- **Acceptance:**
  - [ ] Minor without guardian rejected (CHECK / tRPC invariant).
  - [ ] Address shared via FK; one structured Guardian per student.
  - [ ] No multi-guardian / household / discount fields (deferred, §1.1).

### Legacy one-shot import script + validation report

- **Status:** `blocked` (needs [GRE-10] outcome)
- **Depends on:** GRE-18, GRE-10
- **Trace:** §9.2, S-STU-1, D-0026
- **Goal:** `scripts/legacy-import-students.ts` — a short-lived script (no Legacy models/tables/adapters) mapping the export into Student/Guardian/Address, emitting a temporary validation report. Names preserved verbatim.
- **Acceptance:**
  - [ ] Idempotent enough to re-run during pilot; produces a diffable validation report.
  - [ ] No Legacy-specific schema added (§14 guardrail).

### Fast student search (trigram)

- **Status:** `ready-for-agent`
- **Depends on:** GRE-18
- **Trace:** §4.2, §5.3, S-STU-2
- **Goal:** Trigram search over name/document/contact fields; results fast enough for daily front-desk use.
- **Acceptance:**
  - [ ] Partial-name and document search return ranked matches.
  - [ ] Index defined via the raw-SQL constraint/index migration channel.

### Student profile aggregate + add/edit

- **Status:** `ready-for-agent`
- **Depends on:** GRE-18
- **Trace:** §5.3, S-STU-3, S-STU-4
- **Goal:** Profile aggregate (contact, guardian, enrollment/attendance/finance sections wired as those land) with `wa.me` URL; add/edit forms (pt-BR).
- **Acceptance:**
  - [ ] Profile renders identity + guardian + address; `wa.me` link built from phone.
  - [ ] Add/edit validates document type/number and minor/guardian rule.

### Status lifecycle (SUSPENDED cascade, no billing mutation)

- **Status:** `ready-for-agent`
- **Depends on:** GRE-18
- **Trace:** §4.2, §5.3, S-STU-4, D-0024
- **Goal:** Status transitions; `SUSPENDED` cascade behavior; status changes never auto-mutate billing.
- **Acceptance:**
  - [ ] Status is derived/stored per spec; SUSPENDED cascades to the defined dependents.
  - [ ] No automatic finance side effects on status change (manual finance tools only).

## Definition of done (project)

- [ ] Schema constraints covered by DB integration tests; lifecycle by tRPC integration tests (§10.1).
- [ ] Import script validated against a real export (gated by GRE-10).
