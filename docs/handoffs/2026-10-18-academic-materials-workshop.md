# Academic materials and programming workshop

Status: Catalog direction selected; initial visual finish rejected by the owner. Desktop refinement
has been implemented; owner review of the finish remains pending. This remains a local prototype with no production integration or approved finish.
Scope: English materials, the school's current two-hour weekly operation, and their connection to
stage planning. The parallel class-organization work retains ownership of placement, calendars,
class composition, navigation, and student intake.

## Confirmed requirements

- A stage uses a main material. PPT also uses supplementary material and Enter Key, owned by the
  school and lent to the student without a separate charge. Verify exact supporting editions per
  book during SGF collection; the prototype associations are illustrative.
- The school supplies a 40-teaching-hour regular program and a 50-teaching-hour PPT program.
  These are total teaching time, distinct from the two-hour weekly load. A teaching hour is 60
  minutes in the existing domain. A two-hour meeting can cover two program positions.
- The program must be resolved before the student starts studying the stage. Preparing it after
  the first classes is an adaptation/regularization case, not the normal entry flow.
- The owner explicitly clarified that six hours already taught belong to the same 50-hour total,
  leaving 44 hours. Creating a program must never restart that budget.
- PPT students may be on schedule or ahead. Falling behind is a condition requiring intervention
  to preserve the 50-hour completion target; hiding it or automatically extending the budget would
  misrepresent the school's rule. Completion still requires the academic decision.
- Initially register lessons and the ordered learning/assessment sequence. No lesson-to-page map.
  Teachers continue to record actual lesson, page and task.
- The SGF extraction comes after model/UI work. Use the owner's authenticated session, read only,
  collect English and the two-hour weekly variant only, and avoid manual re-entry for the owner.
- Propose track assignments for owner review; do not silently replace the existing catalog or
  assume equivalence across tracks.
- The owner confirmed that each book holds the final selling price charged to the student, not
  procurement cost or a markup formula. Saving an academic material must not issue a charge.
- PPT students follow their enrolled class schedule. Their content plan and stage progress remain
  individual; this does not require a second individual recurring timetable.
- Desktop is the review target. Operational density, clear typography and hierarchy, aligned rows,
  deliberate scroll boundaries and loading/empty/error states are explicit acceptance criteria.

## Evidence and limits

The supplied `PROGRAMAÇÃO 40H.pdf` and `PROGRAMAÇÃO 50H.pdf` each have one page and 12 grouped
columns: TE1/TE2, TC, TST1/TST2, TST3, TST4, TPI/TI, TUI/TA, TH1/TH2, ESS1/ESS2,
TRS1/TRS2, FLU1/FLU2 and IFC. They contain 40 and 50 numbered rows respectively.

A row can contain introduction, repeated lesson content, two lessons, review, video, supplementary
activities, or assessment. Preserve source codes rather than expanding unknown abbreviations by
intuition. Essentials includes A/B lesson parts. TH contains units and lesson numbers. IFC includes
MT1–MT4: do not impose a universal two-test structure on programming or equate these automatically
with the existing two grading blocks.

The prototype transcribes four grouped columns into seven sample books: Essentials 1/2,
Transitions 1/2, Fluency 1/2 and Fisk in Focus. Counts of ten main lessons reflect those sample
columns, not a universal rule or a verified inventory of every SGF book. Grouped columns share a
program but do not prove that the corresponding books share the same identity or edition.

The supplied SGF screenshot displays Fluency 1 at **2h30**, so it only establishes the shape of the
source: ordered rows may repeat lessons or combine them with activities and tests. It is not a
valid two-hour program for import. PDF agreement with SGF's two-hour variant remains unverified.

Current implementation evidence:

- `ProductLine → Track → Stage` already owns the academic hierarchy (decision 0008).
- `StagePlan`, `StagePlanItem` and `StagePlanRevision` already own dated plans and their history.
  PPT plans follow a stage attempt across transfers; class membership is separate (decision 0009).
- There is no material catalog model in the current schema.
- `FinanceSettings.materialPriceCents` is global. A per-book price is not currently wired to it.
- Existing class records distinguish planned work from actual teacher-recorded content.

## Proposed model

These are implementation candidates, not accepted database changes.

| Concept                    | Responsibility                                  | Proposed contents                                                                                                   |
| -------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Material                   | Identity of a book or supporting resource       | Name, edition/source identity, main/supporting role, lesson references, active/archive status                       |
| Stage material association | Connect the existing stage to its resources     | Existing stage ID, main material, supporting resources; modality/use and school-owned lending policy                |
| Program version            | Reusable, undated distribution of teaching time | Material edition, 40h or 50h total, regular/PPT use, explicit 120-minute weekly source profile, source and revision |
| Program position           | An ordered allocation of teaching time          | Position, duration in minutes, one or more lesson/activity references, assessment marker, original source text      |
| Dated stage plan           | Concrete application of a program               | Reuse StagePlan; class or individual stage attempt, pinned source version, dates, deviations and revision reason    |
| Actual content record      | What happened in teaching                       | Reuse existing record; lesson, page, task and delivered teaching time, separate from intentions                     |
| Material price reference   | Proposed finance seam                           | Material ID plus final selling price/version; an order keeps its agreed amount                                      |

Use stable lesson references (including parts/unit identifiers), not a count as the only source of
truth. Derive the count from the confirmed lesson catalog once the import is reviewed. A program
position may reference several lessons, and one lesson may span several positions. Tests and
reviews occupy time and stay in sequence; they are not counted as additional book lessons.

The initial restriction is explicit: source program profile `weeklyMinutes = 120`. Total minutes
are separately 2400 or 3000. Do not make two hours a permanent property of the book or assume
`row count = meeting count`. Other weekly profiles remain outside this slice; do not silently
convert a 2h30/3h SGF program to 2h.

This catalog slice registers the main book only. Supporting materials, their associations and
lending management are deferred by the owner; no support registration, stock, checkout/return
inventory or purchase management belongs to this screen.
A book revision must not rewrite dated plans already in use: pin the source version, show changes,
and apply an attributed revision deliberately.

## Planning and adaptation

Normal entry: select the existing stage and reviewed material/program, use scheduled teaching
dates, inspect coverage of the full budget including assessments, then confirm the dated plan
before the first lesson. A student may be registered without a class, but that does not imply a
ready-to-start academic plan. The enforcement point for “ready before studying” must be selected
with the owner when integrating intake, scheduling and the teacher's class record; no new technical
blocking rule is implemented by this workshop.

For an existing attempt, preserve historical records and separately establish:

1. Teaching minutes already consumed from the same stage budget.
2. The content and assessments already completed (which may be ahead of that time position).
3. Remaining content, actual future class dates and remaining teaching minutes.

The prototype allows a prefix cut in the source program to demonstrate this distinction. It is
not the final adaptation algorithm: a production review must handle partial lessons, noncontiguous
completed work, assessment evidence and date exceptions. If remaining content exceeds available
time, present the conflict for coordination; never invent a compression ratio. “Behind schedule”
can exist as observed evidence even though it violates the target; retain it and support correction.
The policy for absence, makeup, cancellations and charging of the stage-hour budget is still open.
Do not infer it from attendance alone.

## Financial and catalog seams

The catalog price is the **final selling price** (owner-confirmed). It is initially empty in the
sample because no actual prices have been collected. Creating a material charge should select the
book, copy its price into the existing MATERIAL order flow, and let finance confirm payer,
beneficiary and payment conditions. Preserve the selected material identity and agreed price as an
order snapshot. Catalog edits must not silently reprice existing orders. The per-book price replaces
the global material default as the source for a selected book; the exact compatibility handling for
older flows without a selected material is still a production integration detail.

Current `Order` creation supports MATERIAL but has no catalog material relation or identity
snapshot. `FinanceSettings.materialPriceCents` is still a global default. Neither has been changed
by the prototype. Do not infer a pricing formula from historical glossary mentions of markup.

PPT planning already scopes a plan to the student's stage attempt and fetches future class sessions.
The confirmed timetable rule fits that boundary. Build dates from actual sessions/calendar, retain
individual plan scope across transfers, and pin the source program revision. Existing teacher
records distinguish planned and actual content, but currently expose free-text reference/account
and page ranges, not structured lesson/task fields or complete PPT pace comparison. Comparing page
numbers cannot establish progression without a lesson-page map. Production needs explicit content
references and completion evidence for repeated/partial lessons, reviews and assessments before it
can reliably mark on-time/ahead/behind. None of that comparison is implemented by this prototype.

Keep the existing catalog IDs. Source codes differ (`ESS1` versus existing `E1`, `IFC` versus `FIF`),
so matching needs an explicit reviewed mapping, not a destructive rename. Keep language eligibility
separate from current product-line labels: “Adultos” includes Spanish in the existing seed.
Track assignments inferred from names must carry a review status; import names are evidence,
not permission to move historical stages between tracks.

## Chosen UI and refinement

Route: `/materiais`, with an admin-only Materials navigation entry, per the owner’s explicit
request to move out of `/workshop`. The old URL redirects. Feature: `apps/web/src/features/materials/`.
The route move does not add persistence: local sample state remains explicitly labeled. No shared
schema edits or production financial/academic mutations are included. The navigation change is a
minimal addition preserving the parallel organization work.

The owner selected **Catalog** (book list beside detail), and explicitly rejected the initial
finish: excessive white space, detached captions, weak hierarchy and row alignment. The previous
three-way review is historical evidence only; browser success did not mean user acceptance. The
Matrix/Guided implementations and floating picker have been removed after the choice.

The current catalog uses one desktop workspace: searchable book list with full-row selection,
selected book identity and final selling price in one row, then program controls and the ordered
40h/50h table. There are no detail tabs and no Apply to plan action or date simulator. Editing
identity, track review, lesson count and final selling price uses one form. Supporting-material
registration stays outside scope. The owner clarified that the bolder request targets the planning
tabs, not this catalog; the catalog received no further visual changes for that request.

Catalog edits remain local React state. Reloading or resetting restores the sample. The source
arrays remain review evidence, not a production seed. No SGF extraction has run.

## Validation scope

The source handoff requests browser-only validation in Orca, without lint, typecheck, build, automated
detectors or test suites. Existing form contract tests were inspected; no decorative tests of mock
catalog rows were added. The protected workshop behaviors are separating total/weekly load,
including already-taught hours in the total, preserving source sequences, and keeping edits local.
Browser observations and remaining limitations are recorded at the end after validation.

### Historical browser observations — initial alternatives

Exercised in Orca at 1280×800 for all three directions:

- Editing the main material, entering a reference price, and saving local changes.
- Editing the first 40h position and observing its changed content; filtering assessment positions
  and switching to the 50h program (or comparing both programs in Matriz).
- An initial PPT simulation with 50 remaining rows.
- Six hours already taught plus the first six source positions covered: 44 remaining rows,
  keeping the total at 50 hours.
- Six hours taught with no source content excluded: the 50h remaining-content/44h-budget conflict
  is shown, without generating a compressed schedule.
- Six hours taught with the first eight positions covered: 42 remaining rows and two unallocated
  hours, distinguishing content advancement from teaching time consumed.
- Creating a material, required-name validation, invalid-price validation, and Enter submission.
  Dialog opening focuses the name field; Escape dismisses it.
- No console errors or warnings appeared in these exercised paths.

The initial narrow-layout inspection at 390×844 found no page-wide horizontal overflow. The Matriz
now exposes facts/supports through a tab on narrow screens. Table content scrolls within its frame;
comparison columns can require horizontal scrolling. Browser inspection also caught the simulation
submit button becoming clipped after expanding adaptation: it now stays outside the scrolling form.

Limitations remain deliberate: local React state resets on direction switch/reload; seven sample
books, no SGF authentication/extraction, no production persistence, no actual calendar integration,
no borrowing inventory, no finance mutation, no production readiness enforcement, and no final
track classification. No lint, typecheck, build, detector or test suite ran, following the handoff's
browser-only instruction. Whitespace/diff inspection covered the workshop files and the two added
glossary terms; unrelated existing worktree changes were preserved.

The owner's final steering for this round is **desktop first**. Narrow captures are incidental
observations, not a separate mobile delivery. Final visual review and the choice between alternatives
are evaluated at desktop size. The workshop picker moves above an open dialog to leave form actions
uncovered; short lesson-count and price fields share a row on desktop.

Final desktop confirmation: the default material dialog's body measured 512px visible/512px content
(no internal overflow); focus opened on `material-name`, and Escape dismissed the dialog. The
picker moved above the dialog and returned below after closing. Keyboard selection and URL
persistence were observed (`2` selected Matriz; `?v=2` survived reload). Empty catalog search produced
the shared no-results state. Final captures are in `.impeccable/review/materials-workshop/`.

Independent finish review: **ship for presentation as disposable desktop alternatives**; no
blocking finding remained and no user direction was selected. The original Guiado screenshot had
captured the picker during its 250ms transition; its replacement shows the settled Guiado selection.
The replacement is 2889×1242 (the active desktop viewport had changed), while the other four final
captures are 1280×800. This is not a uniform-size visual comparison. The documentation review
confirmed separation of requirements/proposals/evidence and preservation of existing UI conventions.

## Catalog refinement validation

The two latest owner decisions are reflected in UI labels and the integration contract: final
selling price, and PPT class timetable with individual content. Validation below concerns the
refined local Catalog only; it is not evidence of production finance or academic integration.

Observed in Orca on `/materiais`, at 1280×800 and 1440×900:

- The former workshop URL redirects; page title, breadcrumb and admin navigation say Materials.
- At 1280×800 the main area was 744px visible/744px total, with document width 1280px: no
  outer vertical or horizontal overflow. Scrolling the program by 700px left the material
  heading fixed at 123px from the viewport top.
- Loading retains the list/detail composition and disables dependent controls. Global error
  and empty states have one message/action rather than duplicated messages in both columns.
  Retry restores the catalog; search with no matches uses the shared no-results state.
- Material editing, price formatting, required-name and invalid-price errors, first-field focus,
  Escape cancellation, Enter submission, and creation from the empty state were exercised.
  Editing a price does not implicitly approve the suggested track.
- Program filtering showed four assessment positions in the sample 50h program. Editing a
  source position with Enter updated its displayed content. Tabs expose associated panels.
- The PPT simulation produced 50 rows initially and 44 after six hours taught/six source
  positions covered. With six taught and no source prefix covered, the 50h-content/44h-budget
  conflict appeared. With adaptation expanded at 1280×800, the form had 461px visible/522px
  content and the preview 457px visible/2236px content; the submit action remained visible.
- The final reload and browser scenarios produced no new console warnings/errors. An intermediate
  import error was corrected by using the existing InlineSkeleton export before final validation.
- Source/whitespace review completed without whitespace errors. No lint, typecheck, build,
  automated detector or test suite ran, following the inherited browser-only instruction.

New captures: `.impeccable/review/materials-catalog/`. The sample was reset after validation;
entered test prices and edited source references are not defaults. Finish remains subject to owner
review; the actual material catalog, charge linkage, calendar application, structured teacher
record and pace comparison still require production implementation.

### Owner-directed compaction and selection

The 20:26 screenshot rejected four stacked header bands. The material workspace now uses two:
book identity/edit, followed by tabs and program filters. The weekly-source note moved beside the
program source in the table footer; track/price remain in the facts tab. Loading uses the same
composition. Supporting material registration was explicitly removed from this slice.

The owner also rejected arrow-only selection. Catalog selection now uses the existing shared
TableRow background via a controlled DataTable `selectedRowId`, plus an inset outline, bold book
name and `aria-selected`. The arrow is removed. The optional shared prop does not change unselected
listings or row activation. A Storybook selection scenario covers pointer and Enter transitions;
its runner was not executed under the browser-only constraint. Existing loadingRows work in the
shared table was preserved.

The Apply to plan simulator described in the observations above was subsequently removed at the
owner’s request. Those observations are historical and do not describe the current catalog.

The compact desktop layout was observed at 1280×800: program table begins at y=204px, compared
with y=284px in the prior layout. The document has no horizontal overflow. Clicking Essentials 1
and activating Fluency 1 with Enter both moved the single selected row and its matching detail.
The material dialog contains only main-book identity, track, lesson count and final price. No
support fields remain. These are Orca browser observations, not executed suite results.

## Planning belongs to its owner — latest direction

The owner explicitly rejected a standalone teaching-plan screen. Regular planning now appears in
`/turmas/[id]?secao=planejamento`; PPT planning appears in
`/alunos/[id]?secao=planejamento&percurso=[progressId]`. Regular classes show the tab; PPT class
rosters lead to the student. Student profiles expose the tab for PPT enrollment history as well as
current enrollment, preserving access to historical stage attempts. The selector prefers an active,
already-started attempt to a future one. An explicit unavailable attempt never silently falls back
to a different student's plan.

The global teaching-plan navigation entry is removed. Existing `/planejamento` links resolve to
their owner; the bare route returns to Agenda. Current enrollment and historical links now point
directly at the appropriate tab.

The scoped **Impeccable bolder** work is in these tabs. A tinted, compact stage context column
contains period, objective and upcoming class dates. The main area holds the operational table and
one primary Add activity action. Version history replaces the table in the same area. In the class
planning tab, a compact class identity replaces the large overview so stage identity is not repeated.
The catalog is unchanged by this bolder pass. This composition remains subject to owner review.

Existing planning APIs, mutations, read-only rules and revision history are reused. Teacher route
rendering uses only the existing responsibility-filtered planning reads; it does not load the admin
student profile, financial summary or class administration APIs. No backend permission is widened.
The existing Agenda lesson links to class/student remain entry points for teachers.

This relocation does not integrate the sample catalog with StagePlan or implement 40h/50h budget
accounting, readiness enforcement, structured lesson/task records or pace comparison. Existing
fixture plans are dated activities and must not be presented as PDF-derived teaching programs.

Verification contract: regular and individual plans retain their owner and historical target when
navigating; administrative data stays outside the teacher view. Existing planning integration tests
were read. Navigation expectations were updated to the current menu. Automated checks remain
unexecuted under the owner’s browser-only instruction.

### Browser observations in the owner tabs

Observed in Orca on actual class/student URLs, at 1280×800 and 1440×900:

- The regular class plan retained 32 fixture activities. At 1280×800, the main area measured
  744px visible/744px total; the plan panel 576px/576px. Its table viewport measured 513px with
  1732px of content. Scrolling the table 500px kept the class title at y=76px.
- The PPT student plan retained 13 fixture activities. Its panel measured 655px/655px, with a
  576px table viewport and 725px of content. Both routes had document width 1280px.
- Version history and the Add activity dialog opened inside the class context; Escape closed
  the dialog. No planning mutations were submitted during this visual validation.
- A student with current, future and historical attempts defaulted to the already-started
  current attempt. Selecting the historical Essentials 1 changed the URL progress ID and showed
  eight activities, the Historical marker and Versions, with no edit/add/revise controls.
- Legacy regular and PPT URLs redirected to their corresponding class/student planning tabs.
- Captures are in `.impeccable/review/planning-context/`. The first class inspection caught the
  oversized overview; its compact planning-only replacement is the final captured version.

Source/diff inspection and whitespace verification completed. No lint, typecheck, build, detector
or test suite ran, per the inherited instruction. The teacher route was reviewed against existing
server authorization but was not exercised with a teacher login in this session. The observations
above are not evidence of 40h/50h program integration or completion of the broader materials model.

Additional navigation checks: PPT classes expose Alunos, Desempenho and Aulas, without a shared
Planning tab. A future regular class without a plan showed the empty state and Start planning
opened the existing period form. No draft was saved.

## Global book price — supersedes per-book pricing above

The owner now requests one price for all books, configured in `/ajustes` exclusively by
SYSTEM_ADMIN. The existing `FinanceSettings.materialPriceCents` is the source of truth; no new
pricing table or per-book override is introduced. The field is labeled “Preço único dos livros”
inside Livros. Saving remains the existing audited, system-admin-only settings operation.

The catalog consumes a narrow `finance.readMaterialPrice` read for ADMIN/SYSTEM_ADMIN. It returns
only the nullable price, never the rest of financial settings. Price fields are removed from local
book state and the book form; all sample books display the same persisted price in the detail
header. SYSTEM_ADMIN gets an “Alterar em Ajustes” link; ordinary administrators see the price only.
Settings save also refreshes this cached catalog price. Existing charges are not rewritten.

This supersedes the proposed per-book final-price/version seam described earlier. Catalog identity
and programs still remain local sample data. Material order creation/identity linkage remains
outside this slice; no charge was created or repriced. The existing saved price was left unchanged.

Validation: the authenticated ADMIN browser read only `{ materialPriceCents: 12000 }` (HTTP 200),
while the full settings read returned HTTP 403. Catalog editing no longer contains a price input.
New integration/transport cases cover nullable versus zero price, exact read projection and role
restrictions; suites were not executed under the owner’s browser-only instruction. No SYSTEM_ADMIN
session was used to submit a changed setting in this validation.

Final browser confirmation: ADMIN received HTTP 403 on `finance.saveSettings`, and opening
`/ajustes` displayed the restricted-area page. The catalog rendered the existing R$ 120,00 price;
its material form exposed name, track and lesson count, with no price control. Desktop capture:
`tmp/materials-workshop/catalog-global-price.png`. No stored price was changed for validation.

## Final owner corrections: stages, pricing bands and external review

The owner renamed the catalog to **Estágios**. Navigation, metadata, search, empty states and
edit/create labels use the new term at `/estagios`; `/materiais` and the old workshop URL redirect
there. The book price remains information attached to a stage. The catalog still uses local sample
identities/programs; this change does not complete persisted stage-to-book integration.

There is no in-app review workflow: the “Percurso conferido” checkbox, review status and SGF
review reminder were removed. Import will be performed later using scripts/computer use; the owner
reviews outside Lazuli. Supporting-material registration remains excluded.

The single-price decision above is superseded by two global bands in Ajustes, writable only by
SYSTEM_ADMIN: Infantil starts at 6 × R$123 (total R$738), Adulto at 6 × R$136 (total R$816).
Installment count and unit price are independently configurable per band. One configurable cash
discount starts at 10%; cash price is derived from the full installment total, rounded once to cents
(R$664.20 and R$734.40 respectively). Existing charges are unchanged. The legacy single-price
column remains for compatibility, but the current UI does not read or edit it.

The narrow catalog read exposes only the two quotes and cash discount. The price display has no
reload button and no “Alterar em Ajustes” shortcut; the adjacent pencil edits the stage. Pricing
configuration is reached through Ajustes in navigation. Sample Adultos tracks map to Adulto and
Infantil maps to Infantil; teen tracks do not silently inherit an unconfirmed band.

Migration `20261018220000_book_pricing_by_category` was applied to the isolated local
`lazuli_operacao_pedagogica` database and the generated Prisma client was regenerated. The local
preview required a restart because its cached Prisma singleton still used the old model.

Updated source tests cover quote rounding, configurable terms, invalid/overflowing inputs,
form controls, persistence preserving pricing on older-client saves, and the restricted HTTP
projection. Test suites, lint, typecheck and build remain unexecuted per the owner's browser-only
instruction. Formatting and `git diff --check` completed.

Review examples:

- Regular: `/turmas/1bf6c4d1-8eaa-a69d-6761-1afaa0402e18?secao=planejamento` (REG 14:00).
- PPT: `/alunos/ed109528-32f1-1f06-fb75-381bb3ad838f?secao=planejamento&percurso=fcdfb1ca-42c2-1197-d68c-7b1575cb3a4f`
  (João Pedro, Essentials 2). These are existing fixture plans, not imported 40h/50h programs.

Final browser observation after restarting the preview: `finance.readMaterialPrice` returned
HTTP 200 with both expected quotes (Infantil 66420 cash cents; Adulto 73440 cash cents).
At 1280×800 the stage header displayed 6 × R$136.00 and R$734.40 cash; its only button was
“Editar estágio”. Document width matched viewport width (1280px). The ADMIN session still received
HTTP 403 on full settings reads. The stage dialog had name, track and lesson count, with no review
checkbox. Capture: `tmp/materials-workshop/stages-final-prices.png`. Settings submission with a
SYSTEM_ADMIN session remains unverified in the browser; no account role was changed for validation.

## Planning correction: preserve owner headers and support complete reading flows

The owner rejected replacing the horizontal class presentation with a compact header and the
vertical planning sidebar. The shared class overview now stays above every class tab. Student
planning retains the same current-enrollment presentation used in Pedagógico, beneath the unchanged
student identity/navigation header. Other product sections were not redesigned.

The planning area uses horizontal context followed by two labeled page-position meters. Expected
position is the furthest page scheduled through the current São Paulo date. Recorded position is
the latest past, ended, non-cancelled lesson with a page reference. A later page-free review does
not erase the last page position; no record is represented as unknown, not completed content.
These are positions on the same page scale, not percent completion, lesson mastery or proof that
all intervening pages were covered. The common scale covers the largest planned page or latest
recorded position. The sample records remain independently authored fixture accounts. Imported
lesson/page associations and 40h/50h accounting are still not implemented.

The planning read projects performed content for its owner. Regular plans use the shared account;
PPT uses only the selected student's present entry in the selected progress, or a previous progress
carrying the same plan through transfer. Teacher access also respects responsibility for each
recorded session. No peer/student attendance snapshots are returned with the projection.

Review flows:

1. Open Turma → Planejamento, with the original presentation card intact. Scan expected and last
   recorded pages and the date of that evidence. The initial list prioritizes today/future work when
   available. Switch to all or prior dates when reviewing history.
2. Search the roteiro by topic, reference or formatted date. Pagination shows eight activities at a
   time and the visible range/total. No matches has a specific search state instead of implying the
   plan is empty. Add/edit activities retains the existing versioned forms and revision reasons.
3. Select Aulas registradas (also reachable from Consultar aulas). Read date, content type, pages,
   the teacher's account and reference. For a regular class, Abrir aula goes directly to the selected
   lesson in Aulas. Content appears before attendance; the lesson list previews content/page range.
4. Open Aluno PPT → Planejamento. Keep enrollment context, select the desired stage, and use the
   same compare/filter/record flows. Historical scopes stay read-only. Recorded content belongs
   only to this student/stage, even in mixed-stage PPT classes.
5. Open Versões and return to the roteiro without leaving the owner page. No separate teaching-plan
   screen or apply-to-plan workflow was reintroduced.

Loading now mirrors the horizontal overview, thin two-meter comparison, toolbar and actual table
columns. Current-enrollment loading mirrors identity/schedule, attendance/grades and contact strip;
large block placeholders were removed. Requests in error keep the existing retry/error controls.

Source tests added for expected-vs-recorded position, missing/future/page-free evidence, PPT content
isolation and transfer continuity. An integration case exercises a real saved record projected into
planning while preserving different planned pages. Suites and static gates were not executed under
the owner's browser-only constraint. Whitespace and source-diff review completed.

Browser observations for the restored composition: regular expected page 31 versus last recorded
page 9 (30/09); PPT expected page 11 versus last recorded page 9 (08/10). Four real fixture accounts
were shown in each selected context. Regular record navigation opened the exact selected class
session and exposed its recorded review before attendance. Pagination advanced from 1–8 to 9–12
of the future twelve activities; unmatched search showed the specific no-results state. Versions
opened and returned; Add activity focused `plannedOn`, and Escape closed without a mutation.
Desktop captures are `tmp/materials-workshop/planning-class-final.png` and
`planning-student-final.png`. Narrow inspection found cramped student metric links and selector
intrinsic width; the same layout correction batch stacks those metrics only on narrow screens,
constrains the selector grid and permits horizontal navigation scrolling. Desktop header arrangement
is preserved. Loading layouts were source-reviewed; delayed-response screenshots were not forced.

Confirmation after the single correction batch: the student narrow main measured 379px visible
and 379px scroll width, with the planning section contained at 336px. Regular desktop measured
1280px viewport/document width and retained the original overview. Its meters exposed accessible
labels and values 31/47 expected and 9/47 last recorded. The objective is expandable and the
redundant visible planning heading was removed; upcoming work is the initial filter when present.
No saved plan or class record was mutated during browser review. Teacher-session access and actual
loading timing remain unexercised; the safeguards and skeleton composition were inspected in source.
