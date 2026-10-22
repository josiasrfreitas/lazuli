# V6 browser evidence — 11 October 2026

Issue #184. Tested in the integrated worktree through the public Orca browser CLI, using actual administrative and teacher magic-link sessions. All student records are synthetic local data. One web server served the branch at port 3004.

## Observed workflows

- Agenda loaded real October appointments, including makeup, PPT complement and assessment. The absence view returned 34 eligible absences, with search and shared DS balance filters. Fixed missing pagination metadata and verified pages 1/4 and 2/4 (1–10 then 11–20).
- Administration scheduled Alice Correia Moura with Camila Duarte on the current São Paulo day, 06:49–06:50, reserving one minute against her 8 October absence. Enter submitted the actual form. Recording remained unavailable before the end.
- After the end, Camila opened her own appointment. Empty actual content was rejected; the corrected UI focused `performedContent` and cleared its error on editing. Attempting two compensated minutes in a one-minute delivery was rejected by the server. Enter submitted the valid one-minute delivery with actual content.
- The resulting detail showed Camila's author/date, an unchanged source absence and two immutable versions. The student profile displayed 2,340 minutes present + 1 minute compensated in 2,610 confirmed minutes, leaving 269 absent minutes. Scheduling alone had contributed zero compensation.
- Administration corrected that record to no-show. A reason was required and focused on failed submission. The resulting third version preserved Camila's earlier attended record; the source absence returned to 90 available, zero compensated and zero reserved minutes.
- Registered one general student contact and one contact tied to the source absence. Both persisted with Clara Ribeiro's attribution; the former retained next contact on 16 October, and the latter appeared in the absence list. Confirmed initial focus, Enter validation/submission, required notes and masked date typing (`16102026` → `16/10/2026`).
- Rescheduled Júlia Moura Dias from 16 October 15:00–15:45 to 16:30–17:15. Required reason and first-field focus worked. The original became cancelled with its attribution and a link to the successor. The successor retained 45 minutes of coverage and linked back. Subsequent cancellation preserved both records and released the pending reservation.
- Read Helena Borges Sales's seeded completed appointment: 120 actual minutes cover two distinct source absences, 90 + 30 minutes, with separate planned and actual accounts.
- Teacher week included the independent appointment for Igor Borges Fontes at 15:00 on 16 October. The class encounter showed its three guest appointments separately from regular enrollment attendance and linked each guest to their appointment.
- The activity timeline displayed scheduling, teacher completion, justified correction, rescheduling, cancellation and contact events with their actual actors and São Paulo times.

## Interface and keyboard

Inspected 1280×800 and 390×844, including light/dark detail, history, agenda, absence list, contact and scheduling forms. The default scheduling dialog measured 531 px client height and 531 px scroll height at desktop; optional context stays collapsed. Four-option purpose/contact choices use wrapped DS pills. Initial student search receives focus by its actual control name; rescheduling focuses the date and cancellation focuses the reason. Escape closes pending-free dialogs.

Fixed narrow layout where the table's minimum width widened its grid track and pushed filters off-screen. The final section and toolbar are 347 px wide inside the 390 px viewport; only the table viewport contains its 864 px content. Document and main scroll widths remain 390 px. Screenshots in `evidence/` record the inspected states; the completed-teacher image predates singular-minute copy polish.

## Seed and remaining evidence

The official full seed completed with 250 students, 22 classes, seven teachers, 17 appointments and 14 contacts. This reconstruction removed earlier disposable V5 classes. Subsequent V6 browser operations left 19 appointments and 16 contacts, including the disposable Alice record and Júlia's cancelled successor. A later official full rebuild may replace those QA records; evidence remains historical.

Authored automated cases cover weighted/partial compensation, original attendance preservation, no-show/correction, stale writes, competing allocations, foreign sources, source correction, teacher/date scope, contact attribution, rescheduling, reciprocal class conflicts, non-PPT rejection, assessment separation and the exit-day boundary. Static form contracts protect labelled errors, direct option choices, date/time controls and required teaching evidence. They have **not run locally**, as requested. Concurrency, source-correction races, cross-semester compensation and all permission permutations are not claimed as browser-tested. Commit hooks formatted staged files and checked whitespace; no local lint, test suite, typecheck or build ran.

The integrated epic remains open: runtime encounter generation #183, V8 and the remaining V3 decomposition/CI findings still require work.
