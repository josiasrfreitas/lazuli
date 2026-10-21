# Operation integration audit

Source snapshot: `056338910a1a183ee70d02fe7ff48308d496b7c1`. Main at inventory creation: `8c2e28c57fcf2ee261b8cf3af917fa354c70dd84`. Common base: `16f770907b19ffaa65b5b1e4da12204bed842934`.

The remaining scope belongs to exactly three PRs: pedagogical operations; entry/commercial/contracts; class and semester organization, activity log and final seed. There are no line limits. Security uses gpt-6.1-sol with medium effort after an active PR; functional QA is absent.

## Evidence states

Route enumeration is complete for the tracked page files in this source snapshot. Route variants and dependency coverage are **not yet audited**. Block assignments below are candidates, to be verified against real imports, actions and work items. Existing merged features are not being claimed again as newly delivered.

For each route, inspect layouts, components and conditional paths; record roles, path/query inputs, data states, tabs/filters, dialogs, actions, redirects and API/persistence/job dependencies in `operacao-pedagogica-routes.json`. Keep implementation and behavior evidence separate. Each intentional divergence needs its reason, authorizing requirement and final-head verification. Lint or review success alone does not establish behavioral equivalence.

## Routes

| Route                               | Candidate block  | Source page                                                        | Behavior audit |
| ----------------------------------- | ---------------- | ------------------------------------------------------------------ | -------------- |
| `/acompanhamento/intervencoes/[id]` | 1                | `apps/web/src/app/(app)/acompanhamento/intervencoes/[id]/page.tsx` | Pending        |
| `/acompanhamento/ocorrencias/[id]`  | 1                | `apps/web/src/app/(app)/acompanhamento/ocorrencias/[id]/page.tsx`  | Pending        |
| `/acompanhamento`                   | 1                | `apps/web/src/app/(app)/acompanhamento/page.tsx`                   | Pending        |
| `/ajustes`                          | 3                | `apps/web/src/app/(app)/ajustes/page.tsx`                          | Pending        |
| `/alunos/[id]`                      | 1                | `apps/web/src/app/(app)/alunos/[id]/page.tsx`                      | Pending        |
| `/alunos`                           | 1                | `apps/web/src/app/(app)/alunos/page.tsx`                           | Pending        |
| `/atendimentos/[id]`                | 1                | `apps/web/src/app/(app)/atendimentos/[id]/page.tsx`                | Pending        |
| `/atendimentos`                     | 1                | `apps/web/src/app/(app)/atendimentos/page.tsx`                     | Pending        |
| `/atividades`                       | 3                | `apps/web/src/app/(app)/atividades/page.tsx`                       | Pending        |
| `/aulas`                            | 1                | `apps/web/src/app/(app)/aulas/page.tsx`                            | Pending        |
| `/avaliacoes`                       | 1                | `apps/web/src/app/(app)/avaliacoes/page.tsx`                       | Pending        |
| `/configuracoes/presenca`           | 1                | `apps/web/src/app/(app)/configuracoes/presenca/page.tsx`           | Pending        |
| `/contratos`                        | 2                | `apps/web/src/app/(app)/contratos/page.tsx`                        | Pending        |
| `/estagios`                         | 1                | `apps/web/src/app/(app)/estagios/page.tsx`                         | Pending        |
| `/financeiro`                       | 2                | `apps/web/src/app/(app)/financeiro/page.tsx`                       | Pending        |
| `/interessados/[id]`                | 2                | `apps/web/src/app/(app)/interessados/[id]/page.tsx`                | Pending        |
| `/interessados`                     | 2                | `apps/web/src/app/(app)/interessados/page.tsx`                     | Pending        |
| `/materiais`                        | 2                | `apps/web/src/app/(app)/materiais/page.tsx`                        | Pending        |
| `/organizacao`                      | 3                | `apps/web/src/app/(app)/organizacao/page.tsx`                      | Pending        |
| `/`                                 | 1                | `apps/web/src/app/(app)/page.tsx`                                  | Pending        |
| `/planejamento`                     | 1                | `apps/web/src/app/(app)/planejamento/page.tsx`                     | Pending        |
| `/professor/acompanhamento`         | 1                | `apps/web/src/app/(app)/professor/acompanhamento/page.tsx`         | Pending        |
| `/professor/agenda/[id]/chamada`    | 1                | `apps/web/src/app/(app)/professor/agenda/[id]/chamada/page.tsx`    | Pending        |
| `/professor/agenda`                 | 1                | `apps/web/src/app/(app)/professor/agenda/page.tsx`                 | Pending        |
| `/professor/alunos/[id]`            | 1                | `apps/web/src/app/(app)/professor/alunos/[id]/page.tsx`            | Pending        |
| `/professor/alunos`                 | 1                | `apps/web/src/app/(app)/professor/alunos/page.tsx`                 | Pending        |
| `/professor/atendimentos`           | 1                | `apps/web/src/app/(app)/professor/atendimentos/page.tsx`           | Pending        |
| `/professor/chamada/previa`         | 1                | `apps/web/src/app/(app)/professor/chamada/previa/page.tsx`         | Pending        |
| `/professor/experimentais`          | 1                | `apps/web/src/app/(app)/professor/experimentais/page.tsx`          | Pending        |
| `/professor`                        | 1                | `apps/web/src/app/(app)/professor/page.tsx`                        | Pending        |
| `/professor/pendencias`             | 1                | `apps/web/src/app/(app)/professor/pendencias/page.tsx`             | Pending        |
| `/professor/turmas/[id]`            | 1                | `apps/web/src/app/(app)/professor/turmas/[id]/page.tsx`            | Pending        |
| `/professor/turmas`                 | 1                | `apps/web/src/app/(app)/professor/turmas/page.tsx`                 | Pending        |
| `/professores/[id]`                 | 1                | `apps/web/src/app/(app)/professores/[id]/page.tsx`                 | Pending        |
| `/professores`                      | 1                | `apps/web/src/app/(app)/professores/page.tsx`                      | Pending        |
| `/proximo-semestre`                 | 3                | `apps/web/src/app/(app)/proximo-semestre/page.tsx`                 | Pending        |
| `/recebiveis`                       | 2                | `apps/web/src/app/(app)/recebiveis/page.tsx`                       | Pending        |
| `/turmas/[id]`                      | 1                | `apps/web/src/app/(app)/turmas/[id]/page.tsx`                      | Pending        |
| `/turmas`                           | 1                | `apps/web/src/app/(app)/turmas/page.tsx`                           | Pending        |
| `/workshop/acompanhamento`          | Decision pending | `apps/web/src/app/(app)/workshop/acompanhamento/page.tsx`          | Pending        |
| `/workshop/materiais`               | Decision pending | `apps/web/src/app/(app)/workshop/materiais/page.tsx`               | Pending        |
| `/403`                              | 1                | `apps/web/src/app/403/page.tsx`                                    | Pending        |
| `/login`                            | 1                | `apps/web/src/app/login/page.tsx`                                  | Pending        |
| `/perfil`                           | 1                | `apps/web/src/app/perfil/page.tsx`                                 | Pending        |
| `/presenca`                         | 1                | `apps/web/src/app/presenca/page.tsx`                               | Pending        |
| `/presenca/previa`                  | 1                | `apps/web/src/app/presenca/previa/page.tsx`                        | Pending        |
| `/presenca/previa/projecao`         | 1                | `apps/web/src/app/presenca/previa/projecao/page.tsx`               | Pending        |
| `/presenca/projecao`                | 1                | `apps/web/src/app/presenca/projecao/page.tsx`                      | Pending        |

## Dependency and branch leads

The JSON indexes link to JSONL records (one file/module per line), keeping the reviewable diff compact.
`operacao-pedagogica-route-graph.json` records the static import closure, inherited route boundaries,
source files, conditional expressions and tRPC calls. It was built from the pinned source while its
checkout was clean. The first pass found 587 reachable files and 6,387 conditional leads. These are
syntactic leads for manual review, not 6,387 tested product states. Computed imports, runtime data
combinations and unreachable branches require explicit review. Standard-library and third-party
imports remain in file metadata; API and persistence boundaries are listed for separate inspection.

## Catalog fidelity checkpoint

All 48 page modules and the authenticated/teacher layouts were read at the source SHA. Imported
feature variants remain pending except where individually recorded. `/estagios` has its source
variants enumerated, with runtime verification on the complete pedagogical block still pending.
The source's F1 default selection was restored during this comparison.

The catalog's 14 supplied PDF transcriptions produce identical import documents before and after
lint refactoring. Seventy differential domain cases (valid graphs and individual invalid mutations)
produce identical acceptance/error outcomes. The source validator's unknown-assessment-unit check
was restored before downstream activity validation after this comparison exposed a changed error.
Independent integration checks also passed 19 cases covering the catalog, existing planning and
existing class records, using a fresh migrated Postgres database removed afterwards.

Full typecheck passed at this checkpoint. The last full lint found only the newly imported seed
adapter's structure; it was refactored and the focused script/domain lints passed. Full lint and
build of the complete first block, transport, browser implementation checks, security and PullFrog
remain required. No PR for this block exists yet. A prior build attempt failed on readonly table
props, corrected afterwards; it is not recorded as a passing build.

## Outside routes

Workers, imports, schema, permissions, seed, shared UI and operational configuration also require explicit destinations. Workshops and preview routes remain listed until a reviewed decision assigns or excludes them; they are not implicitly dropped or counted as product completion.

## Completion gate

Before each PR is complete, every assigned route variant must have implementation and behavior evidence on its final head. Before the full goal is complete, every source delta file and work-item requirement must be reconciled with the observed merged main, with justified exclusions and no unassigned scope. The current inventory is an audit starting point, not a completion claim.

## Assessment route started

`/avaliacoes` belongs to block1 (#175/#186/#191). Source page/workspace, grade rules/validators and
core API/file boundaries were read; the remaining descendants and their variants are still pending.
The pure grade rules and validator are being carried forward, preserving #175's independent cutoff
and recovery rules. Two unit cases from those requirements and 864 comparisons with the source
cover missing grades, all four competences, boundary values and recovery; outcomes are identical.
This does not establish completion of the assessment API, uploads, UI, progression or seeded data.

## Assessment and appointment backend checkpoint

The next checkpoint adds the real schema and APIs for grades, appointments and private assessment
files. It does not finish these routes: frontend variants, progression/continuity, frequency,
teacher agenda, legacy makeup endpoints and the complete attachment lifecycle remain pending.

Prisma generated `20261021052429_assessments_and_pedagogical_appointments`. Unsupported CHECKs and
the historical makeup backfill were appended before its first application. Existing makeup IDs,
authors and dates survive; absent performed content/minutes and absence links are not invented.
The common lifecycle `deletedAt` is present on AssessmentFile for the main client's soft-delete policy.

The accepted source ADR0025, dated 2026-10-19, supersedes the GCP provider choice for new file
storage. This checkpoint brings its S3 module and local S3Mock service, leaving existing bootstrap
resources in place. Production requires an explicit bucket and region, uses the SDK credential
chain, and never creates a bucket. No cloud resource was provisioned. The local probe verified
put/read/remove, stable database-derived isolation, production guards and removal of its own bucket.

The appointment APIs retain the shared teaching-schedule and class-record locks. The source's
EntryVisit/student/teacher conflict dependency is explicitly assigned to block 2, where experimental
visits are introduced; it must be reconciled there. Main currently has no entry-visit feature.

Five selected new integration cases protect changed contracts: teacher access and administrative
confirmation, no-op save preserving authorship/approval, concurrent corrections withdrawing approval
once, competing reservations for the same absent minutes, and atomic rescheduling with historical
snapshots. Thirteen existing catalog/record cases also passed in the same fresh PostgreSQL run:
18/18, with full migration deploy, zero drift and database cleanup. Broader frequency/continuity
and upload transport cases will be selected when their remaining wiring lands; no API-only success
is being counted as completed route behavior. The preexisting source tests were inspected; stale
Bloco/Unidade text and unimplemented downstream dependencies were not used to redefine expectations.

Appointment validator refactoring preserves all accepted values and complete validation errors
in 272 differential cases against the pinned source. Earlier grading differential evidence remains
864 identical cases. Lint-driven parameter grouping changes helper signatures, not the API schemas.

Occurrences/interventions have a real requirement conflict: #179 requests states with completion
and reopening, while source uses a dated narrative treatment. The owner question is pending;
independent work continues without choosing either dependent behavior.

The broader unit run exposed an eager Prisma import from the source search helper; using the
existing `@lazuli/db/prisma` entry point preserves schema utilities without initializing the
Postgres singleton at module load. The production build now succeeds without DATABASE_URL.
Navigation expectations were expanded for the already-imported administrative /estagios route;
the teacher exclusion and breadcrumb are explicitly checked. Across the completed package runs,
631 unit cases passed (including 214 web cases after that expectation update); the root scripts
passed 64 cases plus component/style gates. Initial fail-fast cancellations are not counted as
passes. The prospective quality gate reported zero errors and zero contextual warnings.

Legacy historical teacher attribution remains a reconciliation lead before the PR: the source
SQL backfill uses usual-teacher/class fallback, while current main can use substitutions and
frozen class-record responsibility. Verify this against real historical cases before claiming
legacy parity; any correction must use a new migration, never rewrite an applied one.

## Assessment interface and persistent upload checkpoint

The assessment route, sixteen source feature modules, proof lists and authenticated upload queue
are implemented over the prior backend checkpoint. Main's existing class-record and permission
behavior remains in place. Source functions were split into meaningful controllers, fields and
rendering components to satisfy existing lint rules without suppressions. The picker and pencil
loader are shared UI exports with Storybook examples; the generic placement attachment dialog and
base64 adapter remain explicitly assigned to block 2.

A controlled comparison of actual source/current component rendering and file-selection callbacks
passed 473 cases. It checks text, props, conditional layouts, status/permission branches, chart
ranges and batch acceptance. Framework providers, network and effects are controlled dependencies;
this comparison is not browser or end-to-end evidence. Its expected source tree has an explicit
form-policy overlay for the following independently required main standards:

- Grade/recovery/correction/removal fields use the existing `sm` control size, `name`,
  `autoComplete="off"` and meaningful placeholders. Correction now has a placeholder.
- Confirmation choices and reason are disabled during submission. The existing TextControl forwards
  that disabled state; previous callers retain their behavior.
- The first grade field receives initial focus. The existing trigger remains the final focus target.

Other intentional adaptations: saving grades invalidates the current tRPC query cache, including
the teacher workspace once it lands, instead of referencing an absent router. The upload provider
is keyed by authenticated identity, so account changes discard React queue state and abort the old
transfer while IndexedDB remains partitioned by user. Camera, additive selection, file limits,
queue persistence, retry/resume, progress and receipt/processing distinctions remain source behavior.
Pencil colors use semantic tokens with identical values; attribution is retained in LOADERS-LICENSE.

Two selected form tests protect required names, autofill controls, placeholders, masked dates,
recovery/correction fields and a real coordinator decision form, using real components/controllers.
CSS is replaced at its module-loading seam only for static form markup; browser checks own layout.
The full web unit tier passed 216 cases. UI/Storybook typechecks, focused lints and component/style
checks passed; existing contextual lint warnings remain nonblocking and are not suppressed.
The prospective test-quality gate reports zero errors and nine contextual warnings from the
parameterized form assertions. Every variant asserts its exact nonzero field count before
checking all controls; the placeholder assertions also reject emptiness. These paths were reviewed
for execution and are not weakened or suppressed.

Browser implementation checks used only Orca, the isolated integration database and synthetic
teacher/admin users signed in through real local Mailpit magic links. The teacher sees its assigned
class, empty grades and comparison selector. Enter rejects 101; saving 59,9 updates the table.
Recovery requires its narrative. Dirty close opens discard; continuing retains the draft, and
confirmed discard closes and returns focus to the original edit button. At 390x844, the 358px
recovery dialog and app have no horizontal page overflow; camera is available. Screenshots were
inspected, not merely generated. These are implementation checks, not a functional QA round.

Two synthetic proofs survived a server restart/reload in the IndexedDB queue and were explicitly
resumed. Actual HTTP upload, S3Mock storage and Hatchet worker processing produced READY for a
PDF-signature fixture and REJECTED/INVALID_FILE for non-PNG bytes declared as PNG. The authenticated
PDF download returned HTTP200 and an attachment disposition, with the exact 51 sent bytes and
SHA256 `eadef7418e14af08d4dab416d408d94121199f49e60eed1caa7a6bec3b16ebe0`.
This verifies the implemented signature/size/checksum inspection, not full document parsing.
The local worktree initially lacked a Hatchet token; its existing local source credential was
configured only in ignored .env. No credential, real student data or file bytes were logged by jobs.

The route is not complete merely because this checkpoint exists. Historical student entry points,
progression and continuity, teacher workspace and broader role variants still need integration.
Removal/identification, network/permission errors and final-head checks must retain their own evidence; an imported renderer is not counted as every variant tested.

An administrator also signed in through a real local magic link and opened the completed synthetic
assessment. The confirmation form focused its reason, rejected an empty reason, disabled choices,
reason and footer while submitting, then displayed `Aprovação confirmada` in the actual interface. At 1280x800 the observed page has no horizontal overflow. The confirmed-grade
editor exposes a correction reason and rejects a changed grade without it; justified correction
then saves with the reason, withdraws confirmation and retains sufficient scores. Remaining grades for this fixture were
prepared through the real assessment API, not claimed as eight manually exercised UI submissions.

Final checkpoint verification also passed eight shared-UI unit cases, the duplication gate
(0.39% duplicated lines), full format check and an uncached production build of all three build
tasks. Targeted web lint reports zero errors with 75 contextual warnings; shared UI and changed
Storybook examples lint cleanly. Development browser tab and owned web/worker processes were
closed after verification; the user's main2 server and shared infrastructure remain running.
Full first-block acceptance, CI, security and PullFrog remain required before delivery.

## Assessment continuity and advancement checkpoint

Issue175's remaining enrollment boundary is now wired: same-stage transfers and returns reconnect
the same StageAssessment, retaining grades, original start date and confirmation. A changed stage
opens fresh assessment scope; it does not copy the prior stage's grades or decision. PPT advancement
requires an active, confirmed APPROVED assessment, and shares the existing student enrollment lock
with corrections and transfers. Regular advancement and end-of-track behavior remain unchanged.
The implementation follows the pinned source while retaining main's extracted return helper.

The existing advancement integration case now first rejects missing/unconfirmed approval, then
confirms through the real assessment API and verifies successful advancement, fresh next-stage
scope and retained prior approval. Its HTTP success fixture now obtains that approval through the
same real API rather than bypassing the new requirement. A single additional integration journey
covers transfer, pause, return and a subsequent different-stage transfer, with identity, grade,
confirmation, start-date and student-history deduplication assertions. Shared fixture cleanup
removes only assessments owned by its existing test prefix; no fixture identifiers were changed.

Selected checks passed 28 integration cases and three HTTP transport cases in a fresh PostgreSQL
database with all migrations, zero drift and removal afterwards. Twelve existing enrollment role
gates, API typecheck and focused lint passed. No frontend completion follows from these backend
checks: profile/roster entrypoints and their frequency metrics still need their source dependencies.

## Minute-based frequency and historical calls checkpoint

Issue184 defines the new frequency rule: present teaching minutes plus completed, source-linked
compensation, divided by confirmed noncancelled teaching minutes in the enrollment/semester window.
Original present/session counts remain separate; reservations, support without an absence and
unlinked historical makeups do not add attendance. Source corrections to PRESENT suppress their
compensation contribution while retaining the linked historical records. The exit date is excluded
from the old enrollment's window. The 75% flag and no-data denominator remain unchanged.

The source's pure compensated-attendance calculator and bounded query are now wired into the
existing percentage API, student listing and pedagogical profile. Main's dated teacher visibility
and other profile behavior were retained. The source historical-call read API is added with its
original administrator gate and shared identifier validator. It includes pending/cancelled calls
for explanation while excluding them from the percentage, scopes enrollment choices to the
student, keeps unfiltered counts/summary when filtering rows, and clamps pagination. Refactoring
extracts the query, row construction and summary without changing those behaviors.

One added real appointment journey distinguishes minutes from session counts: a 120-minute absence
and a 60-minute presence produce 60/180 before the scheduled replacement; delivering 45 minutes
produces 105/180, with the original row still ABSENT. Correcting that source to PRESENT yields
180/180 and zero counted compensation without deleting its linked coverage. The same journey
checks the profile and filtered historical call. A second added case checks exclusive exit-day
boundaries, cancelled/pending explanations, foreign-enrollment rejection and no-data before entry.
The existing profile expectation now explicitly derives 360/270 minutes from its four 90-minute
sessions, preserving its original 75% result.

Selected PostgreSQL checks passed 26 cases with all migrations, zero drift and database removal.
The existing 145 domain unit cases passed. API/web typechecks and focused API/domain lints passed.
In a separate fresh Postgres database, actual source/current history read functions produced
identical complete output/errors in 143 cases: filters, pagination, date windows, missing and
soft-deleted attendance, cancellation, empty histories and foreign enrollment identifiers. These
are backend comparisons and do not claim that the frontend variants have been exercised.

Profile/roster components and history dialogs still need their complete UI integration. Legacy
makeup endpoints must be moved onto the appointment allocation/outcome rules, and historical teacher
attribution needs its previously recorded reconciliation. No issue184 completion is claimed here.

The existing profile HTTP case and one selected new history transport case also passed. The latter
checks signed-out and teacher denial with serialized error codes, plus the administrator's empty
history and São Paulo date without inventing a frequency denominator. Full production build passed
all three tasks (one cached); Turbo's worker-output warning remains a build-configuration warning,
not a failed task. Prospective test quality reported zero errors and contextual warnings.

## Shared appointment-calendar dependency checkpoint

The frozen source calendar dependency is imported with its exact resolved versions: date-fns 4.4.0,
react-big-calendar 1.20.0 and its 1.16.3 type declarations. The lockfile change is restricted to this
new dependency tree and the existing Base UI optional date-fns peer resolution. UI and Storybook
now include ES2023.Array, matching the shared TypeScript base instead of hiding unresolved array
operations. The internal TimeGrid import has a small local runtime/type boundary rather than a
consumer-visible ambient declaration. No generated dependency code was edited.

The component preserves controlled civil dates, day/week and anchored batches, inclusive bounds,
loading/error/empty states, generic original-event callbacks, temporal geometry, overlap overflow,
keyboard access, filtered-out blockers and authoritative-consumer validation. Large source
functions were separated into selection, viewport, dimension/style and navigation responsibilities;
no lint rule was disabled. The source Storybook variants and calendar contract are included.

Three selected source regression tests protect observable overlap behavior: equal daily lanes,
weekly expansion without changed temporal geometry, and revealing all six overlapping meetings.
Their expected widths and identities are explicit rather than derived by the production layout.
The existing UI unit suite plus these cases passed 11 tests. Separate source/current pure-function
comparisons passed 3,991 cases covering bounds/navigation, overlaps/reveal and interval errors; they
are preservation evidence and do not certify effects, application APIs or source requirements.

UI/Storybook typechecks, focused lint, styles and component-size checks passed. Storybook production
build passed with bundle-size warnings. In the built Storybook through Orca, both pointer and
keyboard opened all seven concurrent events; keyboard focus reached the first revealed event.
A bounded 20–29 October window stopped at the shortened 27–29 final batch with Next disabled.
A hidden 13:00–15:00 commitment rejected a 13:30–14:30 request, while 15:00–16:00 produced the selected
range and feedback. Desktop 1280x800 and narrow 390x844 were explicitly measured with no page overflow;
screenshots were inspected. The first narrow daily render exposed a clipped fourth text line. The
calendar now hides supporting descriptions when a card is below 5.5rem in either view; the existing
wide two-row layout can still show them when space permits, and complete accessible labels remain.
This intentional CSS divergence follows the frontend visibility standard; source temporal geometry
and interaction are unchanged. These are component checks, not completion of the appointment route.

Appointment detail, scheduling/record forms, #187 rescheduling identification, class guest read/UI
and profile/agenda entrypoints are still being integrated in the same block. Admissions/trial guests
belong to block 2. Legacy makeup API reconciliation, historical attribution and #179's pending owner
choice remain open as recorded above. No PR or security agent has started for this incomplete block.
