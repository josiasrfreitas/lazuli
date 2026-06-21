<!--
PROJECT TEMPLATE — copy into docs/sprints/SP-###-YYYY-MM-DD-<slug>/projects/NN-slug/PROJECT.md
A "project" is a cohesive, independently-reviewable slice of the MVP.
Issues live inline below as `### [PNN-MM]` sections. Promote an issue to a
standalone file under issues/ (using ISSUE.md) only when an agent/human picks
it up for AFK work. Do NOT add time estimates anywhere.
-->

# [PNN] <Project name>

**Increment:** Sprint 0 | Increment 1 (Wedge) | Increment 2 (Receivables) | Increment 3 (Comms/Reports) | Cross-cutting
**Status:** `needs-triage` | `ready-for-agent` | `ready-for-human` | `blocked` | `done`
**Depends on:** <project ids that must land first, or "—">
**Blocks:** <project ids that cannot start until this lands, or "—">

## Goal

<1–3 sentences: what capability this project delivers and why it is a unit.>

## Spec anchors

- PRD: <story ids, e.g. S-XXX-1>
- Technical Spec: <§ numbers>
- Decisions: <D-00xx>
- ERD: <section, if relevant>

## Issues

> Ordered by internal dependency. An issue is "one buildable, reviewable change".

### [PNN-01] <Issue title>

- **Status:** `needs-triage` | `ready-for-agent` | `ready-for-human` | `blocked`
- **Depends on:** <issue ids / "—">
- **Trace:** <S-XXX / §x.y / D-00xx>
- **Goal:** <what this issue produces>
- **Acceptance:**
  - [ ] <verifiable outcome>
  - [ ] <verifiable outcome>
- **Notes / open items:** <Sprint-0 unknowns, risks, or "—">

### [PNN-02] <Issue title>

...

## Definition of done (project)

- [ ] All non-deferred issues above pass acceptance.
- [ ] Quality gates green (see [../../ci.md](../../ci.md)).
- [ ] Trace back to PRD/spec holds; no scope drift.
