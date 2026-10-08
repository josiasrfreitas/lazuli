# Issue 158 — teacher operations

Source: [issue #158](https://github.com/josiasrfreitas/lazuli/issues/158), the V2 brief, information architecture, and token reference. This plan covers all three ordered deliveries in one issue.

## Scope and order

1. Register and edit teachers using the existing identity, with login opt-in independent of operational eligibility. List/search/filter them, select an eligible teacher in V1 class creation, and show a persisted weekly schedule and teaching-hour total.
2. Assign a substitute to one whole future class session, keep the usual teacher, expose the exception in both weekly views, and recalculate totals.
3. Schedule a teacher's departure today or later, preview the affected commitments, revoke future substitutions tied to the departure while preserving history, show uncovered commitments, and resolve them through a dated class assignment or one session.

Out of scope: availability, mass redistribution, pay, recorded hours, teacher portal or substitute access, retroactive corrections, reactivation, and unrelated V1 enrollment flows.

## Decisions and dependencies

- V1 [PR #159](https://github.com/josiasrfreitas/lazuli/pull/159) supplies `/turmas`, class creation/detail, and dated enrollment work. Its branch is not merged as of 2026-10-07. Stack V2 on that head and target the V2 PR at the V1 branch; check for V1 changes before editing shared files.
- Use the existing `User` identity. Operational eligibility and login authorization remain distinct; duplicate CPF/email does not silently convert an account. Effective dates use `America/Sao_Paulo` at reads and writes, without relying on a scheduled job.
- Store dated usual-teacher responsibility and per-session substitution/history separately. Reuse class calendar and session generation semantics; do not split a two-hour session into two records.
- Serialize assignment changes for a teacher's relevant interval and check half-open time overlap in the transaction. Return the conflicting class and interval. Recheck departure preview on confirmation.
- UI composition follows the existing compact operational system (Dieter Rams functionalist direction). Reuse `DataTablePage`, `DataTable`, filters, dialogs, fields, `SearchSelect`, feedback states, shell, and tokens. The only new composition is the weekly schedule and feature-specific dialogs. Extend `SearchSelect` narrowly for selection without creation.

## Expected files and seams

- `packages/db/prisma/schema.prisma` and one or more new migrations: teacher operation state, dated class responsibility, substitution audit/history and constraints.
- `packages/validators/src/`: teacher inputs, effective dates and substitute commands.
- `packages/api/src/teachers/`, `packages/api/src/classes/`, `packages/api/src/auth/` as needed: administrative reads/commands, weekly projection, conflict guard, class assignment integration, effective login block.
- `apps/web/src/features/teachers/`, `/professores` routes, class form/detail, `nav-items.ts`: administrative journey and week navigation.
- `packages/ui/src/components/search-select.tsx`: optional create action while preserving current behavior.
- Focused tests under the corresponding `test/` areas and committed real screenshots under `.design/issues/158/evidence/`.

## Test contract

The protected contract is that an operationally active teacher can be assigned without login, a session has one effective responsible teacher, and dated changes preserve past responsibility while preventing simultaneous commitments. A plausible defect is coupling eligibility to `isEnabled`, double-counting a substituted session, or accepting overlapping writes concurrently. The issue's worked examples and half-open interval rule independently determine expectations: Tue/Thu 60 minutes totals two hours, Sat 120 minutes totals two hours, adjacent intervals do not overlap, and a substituted Thu hour moves once from the usual teacher to the substitute.

Inspect existing class, auth, calendar, and form tests before adding coverage. Use unit tests for pure week/overlap rules; integration tests for identity, persistence, temporal responsibility, rollback, and concurrency; transport tests only for session/admin authorization and serialized errors; per-form contract tests for new forms. Exercise real class creation with a login-disabled teacher and future session generation.

## Validation and evidence

- Run focused tests while implementing, then proportionate format, lint, typecheck, unit, integration, transport, and build checks. Inspect the complete diff, test functions touched, component lengths and reused components; run `git diff --check` and changed-test quality gate.
- In the browser, complete teacher registration → class assignment → weekly view → substitution → departure → partial coverage at desktop and narrow width. Check loading/error/empty states, keyboard focus and Enter, field width, grid alignment, no overflow, and both light/dark legibility.
- Capture **real** before and after desktop and narrow viewport screenshots from the running app. Commit them and link the files in the PR. If the starting app has no teacher surface, the before evidence will show the existing administrative navigation/class teacher selection rather than a fabricated teacher page.
- Open a stacked PR with the required template and monitor it with `babysit-pr` until checks stay green and delivered feedback is addressed. Never merge.

## Session update — 2026-10-08

The user explicitly instructed: “nao conduz NENHUM CHECK, lint build nada, foca 100% na feature e qualidade da interface”. This suspended automated checks. The later instruction “valida no navegador sim / testa” explicitly reauthorized browser validation and functional testing. Lint, typecheck, and production build remain excluded. The validation/evidence section above records the original requested gates, not completed evidence. Formatting edits are source edits, not a validation claim.

Implementation decisions refined during construction:

- Teacher operations serialize on one transaction-scoped advisory lock for this single-school system. Class creation, cloning, substitution, reassignment, and departure use the same lock so a departure cannot race a new assignment.
- Recurring meetings keep their slot/date identity when sessions are later generated. Standalone materialized sessions use their session identity. Active substitutions are unique at the database boundary; revoked assignments retain authorship.
- A revoked substitution leaves an explicit coverage gap, including when the departing person was the substitute. New point coverage or a dated class assignment resolves that gap.
- A dated change today freezes responsibility for meetings that already started. Attendance confirmation also freezes usual responsibility. Existing recorded sessions are backfilled in the new migration; past attendance authors are untouched.
- The shared SearchSelect extension makes creation optional. Its existing creation behavior remains available to current callers; teacher selection supplies no creation callback. PersonDocumentField receives a CPF-required label mode while the existing CPF validator remains authoritative.
- Layout uses the existing semantic tokens, compact table/dialog primitives, a desktop weekly calendar, and day-by-day narrow layout. Browser evidence will be captured from the running application after functional testing; no placeholder evidence is accepted.

## Final desktop review scope

The user's subsequent instruction “foco 100% em desktop” directs the final visual pass to desktop. Browser results, concrete frontend-design findings, screenshots and remaining validation limits are recorded in [VALIDATION.md](VALIDATION.md). Shared responsive control sizes were introduced before this direction and preserve the existing compact desktop sizes.

The user subsequently authorized the checks present in commit and push hooks. Those hooks and whitespace checks passed; the broader lint/typecheck/build gates remain excluded.
