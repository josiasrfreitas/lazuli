# [SP-001] MVP Week-1 Sprint Plan

**Sprint code:** `SP-001`
**Planning date:** `2026-06-18`
**Folder:** `docs/sprints/SP-001-2026-06-18-mvp-week-1/`

The build plan for the week-1 MVP. The work is split into **projects** (cohesive, reviewable
slices); each project holds **issues** (single buildable changes). This file is the index and the
**dependency map** — read it before picking up any project.

> **No time estimates, on purpose.** Per the MVP philosophy
> ([decisions.md](../../MVP/decisions.md), [PRD](../../MVP/PRD.md)) the plan optimizes for
> _logical separation and blocker order_, not scheduling.
> Sequence is driven by what unblocks what, not by hours.

## How this folder is organized

```
docs/sprints/SP-001-2026-06-18-mvp-week-1/
  README.md            <- you are here (index + dependency map)
  visao-geral-gestao.md <- Portuguese management overview + conceptual mockups
  ci.md                <- minimum CI triggers (TECHNICAL_SPEC §10.2)
  _templates/
    PROJECT.md         <- shape of a project file
    ISSUE.md           <- shape of a promoted standalone issue
  projects/
    NN-slug/PROJECT.md <- one project, with its issues inline
```

- Issues live **inline** inside each `PROJECT.md` as `### [PNN-MM]` sections.
- When an issue is handed to an AFK agent or a human, **promote** it to a standalone file at
  `projects/NN-slug/issues/<PNN-MM>-<slug>.md` using `_templates/ISSUE.md` — this mirrors the repo
  convention in [docs/agents/issue-tracker.md](../../agents/issue-tracker.md).
- Triage state is the `Status:` line on each project/issue (see
  [triage-labels.md](../../agents/triage-labels.md)).

## Projects

| #                                                      | Project                              | Increment     | Depends on               | Status               |
| ------------------------------------------------------ | ------------------------------------ | ------------- | ------------------------ | -------------------- |
| [P00](projects/00-foundation-derisk/PROJECT.md)        | Foundation & de-risk                 | Sprint 0      | —                        | `ready-for-agent`    |
| [P01](projects/01-auth-rbac/PROJECT.md)                | Auth & RBAC                          | Inc 1         | P00                      | `ready-for-agent`    |
| [P02](projects/02-students/PROJECT.md)                 | Students                             | Inc 1         | P00, P01                 | `ready-for-agent`    |
| [P03](projects/03-catalog-classes-calendar/PROJECT.md) | Catalog, classes, calendar, sessions | Inc 1         | P00, P01                 | `ready-for-agent`    |
| [P04](projects/04-enrollment-progress/PROJECT.md)      | Enrollment & pedagogical progress    | Inc 1         | P02, P03                 | `ready-for-agent`    |
| [P05](projects/05-attendance/PROJECT.md)               | Attendance (the wedge core)          | Inc 1         | P03, P04                 | `ready-for-agent`    |
| [P06](projects/06-portal-submission/PROJECT.md)        | Portal auto-submission               | Inc 1         | P05 + Sprint-0 gate      | `blocked` (gate)     |
| [P07](projects/07-finance-receivables/PROJECT.md)      | Finance / receivables                | Inc 2         | P02 (P04 soft)           | `ready-for-agent`    |
| [P08](projects/08-comms-dashboards-reports/PROJECT.md) | Comms, dashboards & reports          | Inc 3         | P05, P06, P07            | `ready-for-agent`    |
| [P09](projects/09-infra-deployment/PROJECT.md)         | Infra & deployment                   | Cross-cutting | P00 (host decision open) | `blocked` (decision) |

## Dependency map

```text
P00 Foundation & de-risk ──┬─> P01 Auth & RBAC ──┬─> P02 Students ───┐
   (scaffold, CI, spikes)  │                     ├─> P03 Catalog/    ├─> P04 Enrollment ──> P05 Attendance ──> P06 Portal*
                           │                     │   Classes/Cal/Sess┘                                   (│ gated by
                           │                     │                                                        │ Sprint-0
                           │                     └────────────────────────────> P07 Finance ──┐          │ spike)
                           │                                                                   │          │
                           └──> P09 Infra/Deploy** (parallel)                                  ▼          ▼
                                                                          P08 Comms · Dashboards · Reports
                                                                          (needs P05 + P06 + P07)

 *  P06 Portal: implementation mode (automated / assisted / not-viable) is GATED by the Sprint-0 Portal
    spike [P00-08]. Do not build P06 production behavior before that gate resolves.
 ** P09 Infra: deploy steps are BLOCKED on the open web-host + Cloud SQL connectivity decision
    (TECHNICAL_SPEC §11 / PRD §15). Pulumi resource definitions can proceed; cutover cannot.
```

## Critical path (what unblocks the wedge)

`P00 → P01 → (P02 ∥ P03) → P04 → P05 → P06`

Everything else (P07 finance, P08 comms/reports, P09 infra) hangs off this spine and can be
worked in parallel once its own dependency lands. The **single most important external blocker** is
the Sprint-0 Portal spike [P00-08]: its outcome decides whether P06 is automated, assisted, or dropped
for MVP ([S-Portal-1](../../MVP/PRD.md#8-portal-auto-submission--the-wedge), TECHNICAL_SPEC §1.2/§9.1).

## Hard blockers carried from Sprint 0

These are open items
([TECHNICAL_SPEC §1.3](../../MVP/TECHNICAL_SPEC.md#13-open-items-carried-into-sprint-0))
that gate specific issues — they must be resolved _in_ Sprint 0, not assumed:

| Open item                                                       | Gates                                        | Resolved by                      |
| --------------------------------------------------------------- | -------------------------------------------- | -------------------------------- |
| Portal credential / API / Playwright feasibility                | P06 (all), P05 Portal-retry derivation       | [P00-08]                         |
| Legacy export schema / encoding / sample                        | P02 import [P02-02]                          | [P00-07]                         |
| Production course/stage codes + Portal naming                   | P03 catalog seed [P03-01], class Portal name | [P00-09]                         |
| Web host + Cloud SQL connectivity                               | P09 deploy cutover                           | infra decision (PRD §15.9)       |
| Multa rate/policy, justified-absence policy, artifact retention | finance multa, attendance %, artifact TTL    | product decisions during Inc 2/3 |
