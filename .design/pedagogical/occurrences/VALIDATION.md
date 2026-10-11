# V10 browser validation — 11 October 2026

Issue: #179. Integrated workspace only; http://operacao-pedagogica.lazuli.localhost.

## Recorded flows

- Applied the additive V10 seed to the already populated isolated database, without reset: exactly 38 occurrences and six interventions. Four pairs relate without an intervention. Existing student, financial, academic and lead data stayed available.
- Administration: created two reports for Arthur Pereira Farias, for the real REG 19:00 · 5 sessions on 6 and 8 October. Enter submitted the form; an empty account showed the inline error and moved focus to that textarea. At 1280×800 the default dialog body measured 526 px client/scroll height (no inner scrolling), focused on Turma.
- Added an attributed clarification without replacing the original account. Related the two reports independently of an intervention. A single selected report could not advance to creating an intervention; the explicit minimum-two error appeared. Found and fixed a FieldError outside its Field context; authored a focused rendering regression case.
- Selected two motivating reports, assigned Camila Duarte, entered objective/next step and a masked 20/10/2026 deadline. Enter submitted the real form. The second step focused its title and measured 412 px client/scroll height at 1280×800.
- Logged in as Camila in an isolated browser profile, leaving the user's default session untouched. Camila could see the assigned intervention and its administrative reports. Assignment/creation controls were absent. A direct URL for Renata's unrelated intervention returned “Intervenção não encontrada ou sem acesso.”
- Camila started work, could not conclude with an empty outcome, then concluded with a written result. Reopening preserved that conclusion in the timeline, required a reason, restored Em andamento and recorded the next-step/deadline change from 20 to 22 October with Camila's authorship.
- Camila registered a third occurrence for the real 1 October session. Administration included it as another motivating occurrence. The active DB now has 41 occurrences and seven interventions; the official seed remains 38/six.
- Student Pedagógico shows Arthur's three reports, active intervention, Camila and next step. Search finds those three occurrences. Before manual entries the deadline filter returned the seed's two overdue interventions.
- The real activity timeline shows creation, relation, clarification, opening, teacher follow-up, conclusion, reopening and another motivating report, with Clara/Camila and business date/time. Reopening is shown explicitly in event context.
- Desktop light/dark and 390×844 were visually inspected. Document and main scroll widths were 390 px, matching the mobile viewport. The mobile overview and intervention retain hierarchy, readable narratives and accessible actions. Screenshots are in `evidence/`; early screenshots show the original two-report intervention before the third was added.
- The isolated teacher session also opened V7 Avaliações: its own PPT 17:30 class, competency bars and 2 sufficient / 2 below threshold / 6 incomplete students rendered. This extends the earlier admin-only chart evidence; it does not assert a teacher grade-write flow.

## Implementation protections and remaining execution

Integration coverage authored for same-student/minimum-two rules, symmetric idempotent relations, immutable reports with attributed addenda, conclusion/reopening history, version conflicts with rollback, unauthorized roles/teachers, future/cancelled sessions, enrolled roster and substitutions keyed by recurring slot. UI rendering coverage protects narrative errors, deadline input and the motivating-report field context. These tests were **not run**, per the user's direction. No local lint, typecheck or build was run.

Prisma deployment and client generation were necessary runtime setup. The existing web server was restarted once for the new model delegates; the old Next process exit was verified before starting its replacement. Only port 3004 remains in use for this workspace.

Manual review and commit hooks check formatting/whitespace. Final stacked PRs still await the user's integrated product review. Other pending epic verticals are not treated as completed by V10.
