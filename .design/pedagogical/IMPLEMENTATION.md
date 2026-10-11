# Integrated pedagogical delivery

## Current user direction (2026-10-11)

Implement the complete requested feature set in one working branch, `josiasrfreitas/operacao-pedagogica`, with incremental commits and real browser validation. This supersedes opening one PR as each vertical is implemented.

After the user reviews the complete product experience, split the work into a simple dependency-ordered stack using the installed `gh stack` extension (`github/gh-stack`, v0.1.1). Each PR should target the preceding branch, starting from main. Choose reviewable feature slices without adding unnecessary layers. Do not submit new PRs before that product review.

Previously opened PRs #169 (entry/allocation) and #172 (student profile) remain drafts and are not the final stack. Their work is consolidated here. Refinement of Turmas (#170) continues here too.

The user specifically requests a modern, premium UI; Professores is the current visual reference for Turmas. The individual student page has distinct Pedagógico and Financeiro sections. Occurrences can relate to each other; an intervention groups motivating occurrences that require a teacher's action.

## Delivery constraints

- No local lint, tests, typecheck or build: the user's “sem checks” explicitly means these commands, not browser inspection.
- Preserve commit/push hooks, inspect diffs and validate actual workflows in the browser on desktop and narrow screens.
- Do not mistake placeholders or historical documents for completed product behavior.
- Work items #156, #168, #170 and #171 describe the accepted scope; remaining vertical issues will record concrete implementation choices.

## Consolidated progress

- V1/V2 baseline is on main.
- V3 entry/allocation: main workflows browser-validated; draft implementation consolidated from 2033bf0. Remaining decomposition and CI findings still need resolution. The entry/return date now uses the shared Brazilian masked-date standard. Browser inspection confirmed text input, numeric keyboard hint, `dd/mm/aaaa`, masked typing and a single date control; the existing form contract was updated and awaits CI. Correction to the earlier checkpoint: issue #157 explicitly excludes transfers from V1; the absent UI is not an unfinished V1 acceptance criterion. The older transfer API is not authorization to expose an additional movement workflow.
- Student profile: pedagogical/financial data, payment flow, contact/guardian, list/roster navigation and responsive light/dark UI implemented and browser-validated. Consolidated from aluno-perfil through c215183.
- Turmas (#170): visual refinement implemented using Professores as reference; class information, teacher, schedule, roster and enrollment actions retained. Responsive light/dark evidence is in `turmas-ui/VALIDATION.md`.
- V7 academic assessment (#175): two blocks and competency-specific recovery, pedagogical confirmation, justified corrections, student progression and class comparison implemented. Browser evidence includes the confirmed-grade correction flow; the complete seed supplies incomplete, sufficient, below-threshold and recovery cases. Student/class chart evidence is recorded in `assessments/VALIDATION.md`. Local automated checks remain deferred.
- V10 occurrences/interventions (#179): related reports, teacher responsibility, attributed follow-up, conclusion/reopening, student context and activity log implemented. Browser validation covers admin/teacher permissions and desktop/mobile; see `occurrences/VALIDATION.md`. Commits `530e1af`, `5e27995` and `dbf6293`.
- V9 manual stage planning (#180): shared regular plans, individual PPT plans, immutable versions, attributed revisions and continuity through same-stage pause/return implemented and browser-validated; see `stage-planning/VALIDATION.md`. V6 and V8 remain pending. This checkpoint does not mark the pedagogical epic complete or treat the open hypotheses in the module brief as implemented behavior.
- V5 student declarations (#182): public QR/link, bounded name identification, optional teacher location reference, required in-person student location, immutable repeat receipts, revoked/expired links and attributed teacher review implemented. Anonymous online, manual close/rotation, natural expiry, same-day teacher closure overriding a declaration, GPS failure recovery and responsive light/dark UI were exercised in the browser; see `student-attendance/VALIDATION.md`. Live GPS success and concurrency await automated execution.
- Runtime encounter generation (#183): browser creation exposed an existing no-op queue. Wire real worker dispatch and visible retryable status before completing the integrated delivery; see `session-generation/SCOPE.md`.
- V4 class records (#181): weekly agenda, regular/shared and PPT/individual actual content, manual attendance, explicit closure, attributed corrections and immutable history implemented. Browser validation covers required fields, prior-call preservation, presence/content correction, no-present/cancelled/future encounters, teacher/substitute reads and scope, Log, desktop/mobile and dark mode; see `class-records/VALIDATION.md`. Current-day teacher writing was subsequently exercised during V5 QA; concurrent V4 submissions and later-plan edits remain covered by authored tests awaiting CI, not browser execution.

## Additional direction

- Recharts financial analytics (#173) and the complete 250-student baseline seed (#174) are implemented. V7 now supplies real academic records for the student and class charts.
- Monthly contract closings (#178) answer the user's commercial question with projected nominal value of contracts closed in the month, equivalent monthly amount and count. The complete bar includes the monthly segment; labels are selectable and the monthly table lists recent months first. Cash receipts remain separate. See `analytics/CONTRACT-CLOSINGS.md`.
- Important actions (#177) are saved in the same business transaction with time and actor. Sistema → Log de atividades presents an infinite-scroll timeline, search, area/period/author filters and expandable context. No Hatchet queue is introduced. See `activity/VALIDATION.md`.
- Leads follow-up (#176) includes owner, dated next step, contact history, overdue/today views and the shared design-system filter component. Return conditions can be combined. See `leads/VALIDATION.md`.
- Shared radius tokens now make the design squarer. Operational tables retain their blue palette with improved cell inset and row density.
- Keep only one development server active: the integrated workspace, port 3004. Old root/V3/student servers were stopped and process exit verified on 2026-10-11.
- Product vocabulary is now Leads. The user asks for simple commercial follow-up before a future discussion with sales: fast capture, owner, dated next step and contact history; avoid speculative sales stages, scoring, targets or automated messages.

## Checkpoint on 2026-10-11

Recent integrated commits:

- `53f9b5d`: academic assessments and progression.
- `a67e3d9`: atomic activity recording across the important action catalog.
- `afcb07e`: shared Leads filters and combined follow-up queries.
- `9c4d719`: complete academic/activity seed and nine monthly closing cohorts.
- `c26a2db`: activity timeline and browser evidence.
- `0a3aca4`: monthly contract-closing analytics and browser evidence.

The official full seed was applied to the isolated workspace database and bucket on 11/10/2026:
250 students, 22 classes, 7 teachers and 220 annual contracts. October's 10 agreements produce
R$ 28,200 nominal projected tuition and R$ 2,350 equivalent monthly amount. Those are synthetic
commercial values, not cash receipts. The latest V5 official rebuild removed earlier manual lead/V10/V9/V4 validation records, including REG 07:00, Arthur’s manual pause/return and the earlier V4 corrections. Its baseline has 61 stage plans and 74 snapshots, plus 87 completed class records and 89 class-record revisions. V5 adds 31 declarations across six historical encounters. Subsequent V5 browser QA added two disposable Sunday classes, three enrollments and one class closure while retaining 250 students; see `student-attendance/VALIDATION.md`. Earlier V4 screenshots remain historical evidence.

Preview: http://operacao-pedagogica.lazuli.localhost (port 3004). One web server remains active.
The original checkout's unrelated edits are untouched. Work remains in the integrated branch;
no new PRs or final stacked branches have been created.

Commit hooks formatted files and checked whitespace. No local lint, tests, typecheck or build were
run per the user's instruction. Authored automated coverage still needs CI execution. Contract
cancellation and guaranteed-revenue calculations are outside the current financial implementation;
its projection is explicitly subject to discounts and cancellation.
