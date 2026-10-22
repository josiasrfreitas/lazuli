# Student profile — #171

The user added an individual student page with pedagogical and financial sections and requested a modern, premium interface. During the integrated review on 2026-10-13, they selected an editorial premium direction and explicitly limited this round to desktop.

Direction: a compact identity header with inline navigation, full-width content, a current-stage composition with attendance and the overall grade mean, and an integrated surface for appointments and pedagogical follow-up. Contact details live in the overview footer, with the complete record in a shared Sheet. Finance prioritizes overdue actions, actual payment progress, and payment behavior. Existing semantic tokens, typefaces, badges, tables, and controls support both themes.

Data contract: pedagogical reads are scoped to the exact student, use civil enrollment windows and the established attendance calculation. Finance scopes the existing ledger before totals, grouping and pagination, including contract and beneficiary links. Shared-payer orders for other students must not leak into the profile. Existing admin authorization is retained.

- [x] Route and active profile link from the students preview and class roster.
- [x] Real pedagogical and financial data, explicit empty/loading/error states.
- [x] Payment action composes the existing payment flow.
- [x] Validate real browser flows, narrow layout and both themes.
- [x] Inspect complete diff and commit incrementally.

No local lint, tests, typecheck or build per the user's explicit instruction. Integration coverage authored for the changed query contracts; execution left to CI. Commit/push hooks retained.

## Integrated review — 2026-10-13

Implemented in `josiasrfreitas/operacao-pedagogica`, starting from `0446f1a`, in the existing isolated worktree and database. The user invoked frontend-design and Impeccable craft, bolder, and polish. Their latest instructions supersede the original contact sidebar, separate tab row, and narrow-layout validation target.

- The header contains the name, status, contact actions, and section tabs. The decorative gold rule below the name was removed at the user's request.
- Enrollment format and modality are metadata beneath the stage title. The teaching-plan link sits with the enrollment context; the stage journey expands in place.
- The current-stage mean includes every recorded grade, including recovery, and excludes missing grades. It remains tied to the current stage when the assessment selector shows an older stage. Academic approval rules remain separate.
- Assessments show the graph beside the existing result table. The default Y-axis follows the recorded range, with a minimum 20-point span, explicit range caption, and a full 0–100 toggle. The approval reference is drawn only when it falls inside the displayed range.
- Competence badges match the chart series: Oral blue, Listening green, Written amber, and Participação purple. This is an explicitly requested categorical use of the existing Badge palette, independent of the separate result/status column. No new palette was added.
- User-facing assessment language now uses “Unidade 1” and “Unidade 2”; persisted phase identifiers are unchanged. “Concluir avaliação”, “Registrar aprovação”, and “Registrar repetência” name the actual decisions.
- Appointments use date anchors and visible status; upcoming appointments precede completed ones. Frequency-contact notes have readable text, channel, author, date, and follow-up date. Active interventions expose the next step and overdue review date alongside recent occurrences.
- Finance opens with overdue installments, oldest first, with the first receive action emphasized. Paid progress uses received money, including partial receipts, divided by received money plus the current collectible balance.
- Payment behavior uses the receipt that completes each adjusted installment amount. Recurrence counts distinct due months with late settlements or current overdue balances. The average delay includes settled late installments only. Summary values are calculated over all student-scoped ledger rows, independent of pagination.
- Contract duration, actual installment schedule, due day, term, and punctuality discount appear discreetly below the overview. The detailed link opens Recebíveis with `aluno=<studentId>`; clearing that filter returns to the complete ledger.

### Populated local example

[João Pedro Fontes Azevedo](http://operacao-pedagogica.lazuli.localhost/alunos/ed109528-32f1-1f06-fb75-381bb3ad838f) is the populated review example. Only the isolated local database was modified; no reseed, schema change, or external communication occurred.

- Current Essentials 2, previous Essentials 1, and a scheduled enrollment for 2027.1.
- Eight current grades, mean **84.25**. Unit 2 was entered and saved through the actual browser form. The original Unit 1 values were preserved.
- Attendance **95%**, 27 presences over 29 sessions, 135 missing minutes, and 45 compensated minutes.
- Three appointments: an attended makeup, attended PPT complement, and a scheduled makeup on 2026-10-16. Two frequency contacts, three existing occurrences, and one intervention in progress with an overdue review.
- Address, guardian, contact channels, and demonstration notes populated.
- Annual contract: 12 installments of R$250, due on day 5, 10% punctuality discount. A local material order adds six installments of R$120, including on-time, late, partial, overdue, and future examples.
- At the review date: **R$1,305 received**, **R$2,315 outstanding**, **36% paid**. Two overdue balances total **R$195**: R$75 remaining from September after R$45 received, and R$120 from October. Five installments settled on time and two late; average late settlement delay is eight days.

These additions are local review data, not changes to the official seed. Reseeding would remove them. Dates and overdue ages change with the school calendar.

### Visual and interaction evidence

Inspected the complete populated page in the Orca browser, including the lower support/history sections, at desktop widths 1280, 1440, and 1920. Light and dark themes were reviewed; the 1280 page had no document overflow.

- Saved Unit 2, observed the mean and chart refresh, and selected the previous stage while the hero retained 84.25.
- Exercised cropped/full chart scale, metric popover, stage-journey disclosure, and teaching-plan destination parameters.
- Opened and cancelled grade, assessment-decision, frequency-contact, and receipt forms. The oldest partial installment opened with the correct R$75 balance. No new financial receipt or academic decision was submitted in this visual pass.
- Opened the complete contact Sheet; Escape closed it and returned focus to its trigger. Arrow keys moved section-tab focus; Enter activated the focused tab, and Tab entered its panel.
- Finance filters displayed 18 total installments, seven paid installments, and two pending installments. Recebíveis opened with exactly 18 scoped rows; clearing the student filter removed the URL parameter.
- Reviewed Alice Santana Costa's punctual-payment state and Gabriela Rocha Moreira's no-enrollment/no-charge state. No fake grade, attendance percentage, or payment history was inserted into empty UI states.
- The final browser console sample contained log/info messages only. Full keyboard, screen-reader, and transport failure coverage was not attempted.

Evidence: [pedagogy dark](student-pedagogy-desktop-dark.png), [pedagogy light at 1280](student-pedagogy-desktop-1280.png), [support and history](student-support-desktop-dark.png), [finance dark](student-finance-desktop-dark.png), [finance light](student-finance-desktop-light.png).

The complete implementation diff was inspected. No manual code checks, lint, typecheck, build, or test suites were run, as explicitly requested. An earlier-authored mean unit test remains unexecuted. Commit formatting/whitespace hooks are retained; broader code verification remains for CI. Browser evidence demonstrates the exercised states, not final user approval.

## Complete attendance history — 2026-10-13

The attendance indicator now opens “Ver aulas e presenças”. “Ver frequência” in enrollment
history provides the same dialog without requiring a current enrollment. The dialog follows
the accepted desktop direction, using the shared Dialog, DataTable, selectors, badges, and
semantic colors. Its compact summary stays independent of the presence filter and pagination.

The history lists lesson date, time, class, semester, attendance, notes, and completed source-linked
makeup minutes. Dates link to lesson details. It opens on the current enrollment and supports all
enrollments, presences, absences, missing calls/records, and cancelled lessons. Ten rows per page
are ordered newest first. At shorter desktop heights, the rows scroll inside the table while the
filters and pagination remain visible.

The admin-only read scopes both enrollments and attendance rows to the student. Lesson dates
respect the enrollment/semester intersection, exclusive exit date, and today's school civil date.
Cancelled and unconfirmed lessons remain visible but do not enter the attendance denominator.
Confirmed calls without a student record display “Sem registro”, never an invented absence.
Only completed, non-deleted makeup coverage contributes minutes; compensation preserves the
original absence. The established domain calculation supplies the frequency summary.

Browser evidence from the populated João Pedro example:

- 30 lessons through October 13: 27 presences, two absences, and one pending call; frequency 95%.
- All three pages reached, from October 13 back to July 2.
- Absence filter showed September 8 with 45 of 90 minutes compensated and July 28 without
  compensation. The scheduled makeup was not counted as completed.
- Pending-call filter showed October 13; selecting the future 2027.1 enrollment showed an empty
  history, zero recorded counts, and no invented percentage.
- Dark desktop at 1440 × 1060 and light desktop at 1280 × 800 inspected. The final smaller-height
  layout had no dialog-body overflow, with pagination ending at y=704 inside the y=768 dialog.
- The close control returned focus to the trigger. Exhaustive keyboard, screen-reader, transport
  failure, and cancellation scenarios were not exercised in this pass.

Final compact-desktop evidence: [attendance history](student-attendance-desktop-light.png).
The source diff was inspected manually. No test suites, lint, typecheck, build, or manual code
checks were run, as requested; normal commit formatting/whitespace hooks remain enabled.

## Unified interventions and populated review example — 2026-10-13

The user removed frequency contacts as a separate product concept. The profile section, absence-list
column and contact action, contact form, active API reads/mutation, validator, and contact seed
writer are removed. The attendance agenda tab is now “Faltas e reposições”. Existing stored contact
records and their activity-event label remain historical data; no destructive migration was made.
This decision supersedes the frequency-contact UI described in the earlier review above.

“Nova intervenção” on the student profile and “Criar intervenção” in the absence queue open the same
student-bound form. An intervention can now start without an occurrence; optional linked occurrences
must still belong to that student and cannot repeat. The existing teacher responsibility, objective,
next step, deadline, follow-up history, and conclusion flow are retained. Details without occurrences
use the available content width and link back to the student.

João Pedro Fontes Azevedo is now the stress example: **15 appointments, 15 occurrences, 8 interventions,
and 33 follow-up records**, alongside the existing grades, lesson history, family details, enrollment
history, and 18 installments. The new appointments include attended, missed, cancelled, and scheduled
support. Interventions include open, in-progress, concluded, overdue, and undated examples with long
narratives. These additions exist only in the isolated local database; do not reseed during review.

Browser validation created “Combinar a retomada da frequência com a família” directly from João's
profile without selecting occurrences, then saved an example family conversation and revised next
step through “Registrar acompanhamento”. Both persisted and rendered in the intervention detail.
The populated profile no longer displayed frequency contacts. The light-theme form and detail were
visually inspected. The Orca runtime closed its connection while opening the absence agenda, so
validation of that entry point and the final small layout refinements remains pending. Existing tests
were synchronized only where removed APIs/components and the former two-occurrence requirement made
assertions obsolete; no test suite, lint, typecheck, or build was run at the user's request.

## Original browser evidence — 2026-10-10

Validated in the isolated `aluno-perfil` worktree with its seeded database and real magic-link login, on 2026-10-10 (school date).

- Alice Barbosa Costa: stage Connect 1, regular in-person class, Mon/Wed 14:00–15:30, 26 presences over 29 confirmed sessions (90%). Contact and guardian loaded from the student record.
- Financial: 12 installments, initially 2 overdue and 4 paid. Received the August installment through the existing dialog (R$213.20 including interest), using Enter from the initially focused date field. Overdue decreased to 1, paid increased to 5; reload retained the result. Escape closed the dialog without submitting in the preceding attempt.
- All/overdue/paid filters, pedagogical/financial tabs, direct URL reload and return to the filtered students list exercised. ArrowRight moved focus between section tabs; Tab entered the active panel.
- Created Lívia Andrade through the real student creation flow with no enrollment or contract. Both sections presented explicit empty states and missing contact data; no invented attendance or balance.
- Missing student ID displayed the existing not-found error with retry and list-return actions.
- Screenshots: light/dark 1440 px, light 1280 px, narrow 390 px; document width equals viewport width at 390 px. Operational tables scroll within their own viewport. Payment form inspected at 390 px.
- No local lint, test suite, typecheck or build. Commit hooks formatted staged code and checked whitespace; push hook parsed committed files and enforced component size.

PR: https://github.com/josiasrfreitas/lazuli/pull/172

## Bounded support sections and contact actions — 2026-10-13

The user requested an Impeccable critique and bolder refinement of appointments and pedagogical
follow-up, explicitly identifying unbounded height and asking for limited records with expansion.
They also requested moving WhatsApp/full registration into the main student card and leaving a
populated local student for review. This extends the previous accepted editorial desktop scope.

Independent design and detector assessments scored the old composition 26/40. The detector found no
mechanical anti-patterns, while the browser confirmed the empty appointment half stretched to match
unbounded follow-up content. The critique is archived at
[the critique snapshot](../../../.impeccable/critique/2026-10-13T12-42-16Z__res-students-profile-student-pedagogy-tsx-d9c6d963.md).
Considered route-only summaries, bounded expanding lists, and one combined tabbed surface. Implemented
bounded expanding lists in the existing visual language: a smaller appointment rail and a wider
follow-up section, with deadline-first records and separate intervention/occurrence tabs. This is an
implemented refinement for user review, not a newly approved workshop direction.

Protected UI contract: adding records or long narratives must not indefinitely increase the student
profile height, and a preview must not claim its loaded rows are the full active total. Existing API
pagination and form tests were inspected. No new source-shaped tests were added for this reversible
composition; real browser evidence exercises the contract. No backend contracts changed.

- Appointments initially show three records; interventions and occurrences show two. The latter
  limit was adjusted after the first browser pass showed a partially cut-off third record.
- Expanded lists scroll inside a 384 px maximum viewport. Initial lists shrink to fit. Counts and
  collapse actions stay outside that scrolling region; complete histories retain the student filter.
- Active totals combine the server totals for OPEN and IN_PROGRESS. Up to one page of each is loaded
  into the preview, ordered by deadline. The stress example truthfully shows 27 active records even
  though 23 are loaded; expanded footer says “Exibindo 23 de 27 · Ver todos”. The full history includes
  concluded interventions and retains its existing pagination.
- Next-step previews are clamped, with the full narrative accessible through the linked title.
- WhatsApp and Cadastro completo are inline actions beside contact facts in the main card, including
  the financial overview through the shared contact summary. WhatsApp was not opened or sent.

The local database initially contained only 0 appointments, 3 occurrences and 1 intervention for the
previously linked demonstration student, despite the earlier handoff counts. After verifying isolated
workspace ownership, added demonstration data through the application caller with existing scheduling
and conflict checks. No reset or reseed. The same review link above now has **12 appointments,
29 interventions (24 OPEN, 3 IN_PROGRESS, 2 CONCLUDED), 15 occurrences and 33 follow-ups**. Cases include
missed/cancelled/completed/scheduled appointments, overdue/undated interventions, long titles and an
approximately 3,000-character next step. All additions are local demonstration records.

Final browser pass:

- Measured 1280 × 800 dark and 1440 × 1000 light, with no document horizontal overflow.
- At 1280, collapsed appointment viewport 245 px / three records; intervention viewport 342 px / two
  records. Expanded viewports remained 384 px with 12 appointments and 23 loaded interventions.
- At 1440, two interventions fit in 314 px; two occurrences fit in 253 px.
- Opened the long intervention narrative successfully. Occurrence-history navigation retained the
  student and view, and showed all 15 records. Registration sheet opened inside the card and closed
  with Escape. Both moved actions were present inside the main enrollment card.
- A separate existing empty student rendered explicit empty states; appointment/follow-up section
  heights were 207/188 px, without a stretched shared background.
- Focus reached the scroll region. Orca's synthetic ArrowDown/PageDown did not change scrollTop, so
  native keyboard scrolling is not claimed as verified. Mobile, simulated network errors and writes
  through the unchanged creation form were not re-exercised in this refinement.

Evidence: [light support](student-support-bounded-light.png),
[expanded dark support](student-support-bounded-dark.png),
[contact actions](student-contact-actions-in-card.png).
Source diff reviewed, changed files formatted, and `git diff --check` passed. No tests, lint, typecheck
or build were run, preserving the user's explicit review-session preference recorded in the handoff;
those gates remain for CI. No push or PR creation in this pass.

Critique run notes: dual independent assessments; ignore list absent; CLI and injected browser
scan both clean; temporary detector server stopped and assessment tabs closed; temporary report
removed after archive write. First critique for this target, no trend yet. The primary review tab
remains open on the populated example.

## Default scrolling and aligned sections — 2026-10-13

The user rejected the “Ver mais” interaction and requested scrolling by default, plus alignment of
both sections. This supersedes the collapsed preview behavior above. Removed expansion state,
preview slicing and expand/collapse controls. Every loaded row is immediately inside the 384 px
scroll viewport; server totals and complete-history access remain explicit.

Both desktop sections now share three grid tracks through subgrid: heading, period/tabs, and content.
Matching insets align heading tops, list starts, footer rules and section bottoms without assuming a
fixed heading height. The existing distinct surfaces and unequal column widths are retained.

Browser validation measured exact matching positions at 1440 × 1000 light and 1280 × 800 dark:
section height 589 px, both list viewports 384 px, and zero difference in heading/list/footer/bottom
coordinates. Switching to occurrences preserved those alignments. All 12 appointments, 23 loaded
active interventions and 15 occurrences were present without an expansion click. Setting the
intervention viewport scrollTop to 800 succeeded while its height remained 384 px. No horizontal
page overflow or expand/collapse controls remained.

Evidence: [aligned light](student-support-aligned-light.png),
[aligned dark](student-support-aligned-dark.png). Reviewed the complete task diff, formatted changed
files and passed `git diff --check`. No new tests were warranted for this removal of presentation
state; no tests, lint, typecheck or build were run per the continuing review-session preference.

## Direct student navigation — 2026-10-13

The user removed the intermediate student preview. Clicking a student row or pressing Enter on the
focused row now opens `/alunos/<id>` directly. Successful student creation uses the same destination.
The return URL preserves listing filters and pagination, excluding the retired preview-selection
parameter. Removed the preview component, its selection/query hooks, selected-row state, and its
unused finance cache invalidation. The existing API procedure is unchanged.

Browser verification clicked the populated student from a name-filtered list and reached the profile
with no intermediate dialog. Returning restored the name query and search input. Enter on the row
also navigated directly. The separate WhatsApp action kept the list route unchanged; the external
anchor's default navigation was prevented for that check, so no external page or message was opened.
The post-creation callback was inspected but no additional student was created for this refinement.

Existing table-render coverage was adjusted only for the removed selection props and renamed open
callback; assertions and fixture identifiers were preserved and the touched test reviewed as a whole.
Diff inspection, formatting and `git diff --check` passed. Tests, lint, typecheck and build remain
unrun under the review-session preference recorded above.
