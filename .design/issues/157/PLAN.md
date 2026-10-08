# Issue #157 — Classes and enrollment

Source: [GitHub issue #157](https://github.com/josiasrfreitas/lazuli/issues/157), the V1 design brief and information architecture, `AGENTS.md`, `CONTEXT.md`, `docs/frontend/README.md`, and `docs/testing/README.md`.

Terminology: in this plan, an **enrollment action** means enrolling, pausing, returning, or ending a student's membership in a class. A transfer between classes is outside issue #157. A **past correction** changes the recorded effective date or details of one of these actions after it took effect.

## Scope and order

1. List, search, filter, paginate, create, open, and safely edit classes. Show the class roster and all loading, error, empty, and missing states. Preserve listing context on return.
2. Enroll a student now or on a future date; show current versus scheduled occupancy, permit capacity overrun, and cancel a future entry with history and authorship.
3. Pause, return, and end operational membership now or later; cancel a scheduled enrollment action; keep the pedagogical path and operational history. Return selects a destination class.
4. Preview and justify corrections to past enrollment actions; preserve the prior fact and apply the correction transactionally only under an owner-approved impact rule.

Each slice includes authorized API, persistence, PT-BR UI, tests, and browser validation before moving to the next. Do not add transfers, student tabs, teacher management, lesson or grade workflows, plans, or Finance behavior.

## Decisions and dependencies

- Use the accepted table-to-class-page navigation. Refine its composition in the app; the discarded prototype is not visual acceptance.
- Regular shares a stage; PPT stores individual placement. Class capacity informs and never blocks enrollment. Business dates use `America/Sao_Paulo`.
- A class hour is 60 minutes. V1 records one or more recurring weekday/time slots for each class; a two-hour meeting represents two class hours. Teacher workload summaries and attendance/meeting duration belong to their later verticals.
- Enrollment is operational membership; `PedagogicalProgress` owns stage placement (ADR 0009). Actions must not implicitly advance stage, approve students, bill, change student registration status, or extend a plan.
- Only safe class fields may be edited. Schedule and archive behavior with existing records are outside scope until their effects are decided.
- **Owner decision received:** a paused student's pedagogical return behaves like a new student's placement. The destination Regular class supplies its shared stage; PPT requires an individual stage. Preserve the earlier pedagogical record as history.
- **Owner decision received:** save a past correction even when related sessions, attendance, grades, or plans exist. Show the affected records before confirmation and preserve them as recorded. The correction changes the operational membership fact and its projections; it does not recalculate or delete related records.
- Existing `classes.create` and `enrollment.create/close` are starting points, not proof that current behavior meets the issue. In particular, the capacity override requirement conflicts with the issue and must change.

## Likely files and boundaries

- `apps/web/src/app/(app)/turmas/**`, `apps/web/src/features/classes/**`, and app navigation for the list, detail, forms, roster, and movement history.
- `packages/api/src/classes/**` and `packages/api/src/enrollment/**` for authorized queries and transactional commands.
- `packages/validators/src/**` for input contracts; `packages/db/prisma/schema.prisma` plus a **new** migration for durable movement and authorship data if necessary.
- `packages/api/test/classes/**`, `packages/api/test/enrollment/**`, and focused web form contract tests. Keep web free of Prisma and worker handlers; keep scheduled work across the worker boundary if a job is required.

## Test contract

The protected contract is that the displayed and persisted membership at a Sao Paulo business date matches effective, uncancelled movements, while capacity remains informational and pedagogical placement remains intact. Plausible defects include counting a future entry today, leaving a cancelled operation active, duplicating a concurrent enrollment, requiring an override reason, or closing progress on a future pause. The issue's acceptance rules and ADR 0009 are the independent oracle.

Inspect existing tests before editing. Use unit tests for date and validation rules, integration tests for transactions, constraints, history, projections and concurrency, transport tests for serialization and admin authorization, and one contract test per form. Review each touched test function as a whole under `docs/testing/README.md`.

## Validation and evidence

- Run focused tests per slice, then proportionate format, lint, typecheck, unit, integration, transport, and build checks. Inspect the entire diff and run `git diff --check` before commit.
- Exercise creation, search, direct URL, filter-preserving return, over-capacity enrollment, scheduled and current movements, cancellation, return, and correction in the actual browser. Verify keyboard use and persistence after reload.
- Capture real before and after desktop and narrow-viewport screenshots from the app; commit them under `.design/issues/157/evidence/` and link them in the PR. Never label a design mock or placeholder as evidence.
- Use the `pr` template, push the branch, and watch the PR with `babysit-pr` until checks remain green and delivered feedback is handled. Never merge.

## Review and owner refinements

- Reuse `TableFilters` and `TableFilterChips`; promote Organization, Format, and Teacher. Search also matches teacher names. Multiple options within a filter are combined with OR; different filters are combined with AND.
- Display compact numeric schedule codes using Sunday = 1 through Saturday = 7 and hourly shifts beginning at 06:00, 12:00, and 18:00. The owner-approved example is `3N2-5N3` for Tuesday/Thursday 19:00–20:30; tooltips preserve exact times. Use a compact numeric occupancy badge.
- The owner raised the component-file limit to 500 lines. Documentation, ESLint, pre-push, and the component check must agree.
- Pullfrog review: preserve temporal track windows, linked pause/return chronology, and half-open exit impacts. Serialize new entries and scheduled-action cancellations on one transaction-scoped student lock. A deterministic integration regression holds a new entry uncommitted and observes cancellation waiting before checking rollback.
- Full integration, transport, builds, and repository-wide checks remain with CI at the owner's request. Run only focused checks locally; the owner is validating the interface directly.
