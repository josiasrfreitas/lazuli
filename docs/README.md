# Documentation

Start here before changing product scope, architecture, or implementation stack. This file is the **index** — it points at the authoritative docs; it does not duplicate their content.

## TLDR

Lazuli is a custom management system for one language school in Brazil. The wedge is attendance capture plus automated daily submission to the Portal. Legacy remains in parallel during the pilot.

## Layout

- **[MVP/](./MVP/)** — the build contract for the week-1 MVP: product scope, decisions, technical spec, ERD, and deferred work.
- **[sprints/](./sprints/)** — local markdown sprint plans, issue tracker files, and dependency maps.
- **[discovery/](./discovery/README.md)** — raw interview evidence, questionnaire data, query tooling, process maps. The "why" behind the MVP.
- **[agents/](./agents/)** — conventions for AI/automation work in this repo (issue tracker, triage labels, domain docs).

## Authoritative Docs

| Doc | Use it for |
|---|---|
| [MVP/PRD.md](./MVP/PRD.md) | Product scope, user stories, acceptance criteria, out-of-scope (§16), open questions (§15) |
| [MVP/decisions.md](./MVP/decisions.md) | Architecture, stack, data/workflow decisions, discovery-driven product decisions |
| [MVP/TECHNICAL_SPEC.md](./MVP/TECHNICAL_SPEC.md) | Formal implementation spec: data model, BFF/API, jobs, repo conventions, traceability |
| [MVP/ERD.md](./MVP/ERD.md) | Mermaid entity-relationship diagrams derived from the technical spec |
| [MVP/PHASE-2.md](./MVP/PHASE-2.md) | Full specs for deferred modules (expenses, leads/CRM, WhatsApp) |
| [MVP/CHANGELOG.md](./MVP/CHANGELOG.md) | History of how scope evolved through discovery |
| [sprints/SP-001-2026-06-18-mvp-week-1/README.md](./sprints/SP-001-2026-06-18-mvp-week-1/README.md) | **Sprint plan** — projects, issues, and dependency/blocker order for building the MVP |
| [discovery/README.md](./discovery/README.md) | Questionnaire data, query tooling, discovery artifacts |
| [discovery/unresolved-pains.md](./discovery/unresolved-pains.md) | Pains not solved by current MVP scope |

## Reading order

1. [MVP/decisions.md](./MVP/decisions.md#tldr) — stack and hard constraints.
2. [MVP/PRD.md](./MVP/PRD.md) — user stories and acceptance criteria (MVP).
3. [MVP/TECHNICAL_SPEC.md](./MVP/TECHNICAL_SPEC.md) — implementation contract after scope is understood.
4. [MVP/ERD.md](./MVP/ERD.md) — visual relationship map after reading the technical spec.
5. [sprints/SP-001-2026-06-18-mvp-week-1/README.md](./sprints/SP-001-2026-06-18-mvp-week-1/README.md) — how the work is split into projects and issues, and in what order.
6. [discovery/README.md](./discovery/README.md) — raw interview evidence when you need it.
7. [discovery/unresolved-pains.md](./discovery/unresolved-pains.md) — before declaring a pain out of scope.

## How to update docs

- **Product behavior change:** update [MVP/PRD.md](./MVP/PRD.md) and, if it changes a constraint, [MVP/decisions.md](./MVP/decisions.md).
- **Architecture/stack change:** update [MVP/decisions.md](./MVP/decisions.md) first, then any affected PRD acceptance criteria.
- **Discovery result:** add raw data under `docs/discovery/`, summarize the implication in PRD or decisions, add unresolved follow-up to [discovery/unresolved-pains.md](./discovery/unresolved-pains.md), and log the scope change in [MVP/CHANGELOG.md](./MVP/CHANGELOG.md).
- **Deferring / restoring a module:** update the canonical out-of-scope list ([PRD §16](./MVP/PRD.md#16-out-of-scope-for-mvp-phase-2)) and the matching decision, and move the story bodies to/from [MVP/PHASE-2.md](./MVP/PHASE-2.md).

## Canonical locations (don't duplicate these)

- **Out of scope / deferred:** [PRD §16](./MVP/PRD.md#16-out-of-scope-for-mvp-phase-2).
- **Open questions:** [PRD §15](./MVP/PRD.md#15-open-questions-need-answers-before--during-week-1).
- **Scope-change history:** [MVP/CHANGELOG.md](./MVP/CHANGELOG.md).
- **Sprint plan:** [sprints/SP-001-2026-06-18-mvp-week-1/README.md](./sprints/SP-001-2026-06-18-mvp-week-1/README.md).
