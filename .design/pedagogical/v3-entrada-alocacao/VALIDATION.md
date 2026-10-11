# V3 browser evidence — 11 October 2026

Issue #168. Validated through Orca's browser against the integrated branch and its isolated
250-student seed. Clara Ribeiro's administrative session performed every action below.
All names and records are synthetic local data. Earlier conflict/attendance/permission evidence
remains in `TASKS.md`; this pass concentrates on the decomposed admissions forms.

## Observed workflows

- Captured Manuela Carvalho Barbosa as a lead with phone and source, without creating a student.
  Qualification first focused the name. Removing the only contact and pressing Enter showed the
  required-contact error and focused the phone. Restoring the masked phone advanced to availability.
- Selected regular, in-person Connect 2 and Tuesday/Thursday 14:00–16:00 availability through
  31 December. Enter saved the qualification and showed the two compatible regular classes.
  ArrowDown moved the class radio selection to REG 14:00 · 6.
- Scheduled an experimental lesson for 13 October. The selected class supplied the real
  14:00–15:30 meeting and Lucas Monteiro; the operator did not invent its teacher or interval.
- Scheduled an introductory lesson with Renata Cavalcanti. A 15:00 end before a 15:30 start was
  rejected, with focus on the end-time control. Correcting the end to 16:00 and pressing Enter saved.
- Rescheduling retained the previous date, teacher and guidance. Changing the start to 15:45
  created the replacement and preserved the cancelled original. Cancelling the replacement
  required a reason, focused the notes control and retained the reason in history.
- Enrollment in new-student mode with a minor's birth date required guardian information and
  focused the missing guardian name. Switching to existing-student mode allowed selecting
  Manuela's existing registration without completing that abandoned guardian draft.
- Confirmed entry into REG 14:00 · 6 for 13 October, then navigated to the class. Its current
  count remains ten, with one scheduled entry. The lead now shows Matriculado and retains all
  three visit records. The scheduled trial remains independent from enrollment.
- Opened the activity timeline and observed Lead matriculado with Manuela's name, Clara's
  authorship and the action time. Qualification and visit actions also remain visible.

Direct database reads confirmed 250 students and 220 contracts after conversion. Manuela received
no financial contract; academic entry and Connect 2 progression share the selected 13 October date.
The rescheduled visit links to its cancelled predecessor. These reads supplement the actual UI flow.

## Interface evidence

Inspected desktop 1280×800 and mobile 390×844, including light/dark converted lead views,
minor and existing-student enrollment, availability, trial and introductory forms. On mobile,
document and main widths both remain 390 px. At desktop the availability form body measured
444/444 px and the trial form 402/402 px (scroll/client height).

Initial focus, error focus, masked phone/date/time, Enter validation/submission and keyboard
class selection were exercised. The shared dialog focuses its real submit control when the
existing-student selection is already locked. Screenshots use `evidence/refactored-*.png`.

## Implementation and remaining verification

Contact/availability, visits and enrollment now separate field presentation, form control and
pure input models. Class allocation separates loading, matching results and radio interaction.
Known size/complexity and expression findings from the old draft CI were addressed; this is not
a claim that the integrated branch's CI is green.

Authored coverage protects Brazilian civil-date parsing, weekly availability mapping, guardian
requirements, existing-student payload isolation, explicit trial-meeting selection and accessible
label/error contracts. A plausible regression is carrying unfinished guardian data into the
existing-student request or scheduling the wrong meeting when a class has multiple options.
Expected values come from the selected civil dates, existing student and actual meeting IDs.

Only commit formatting/whitespace hooks and `git diff --check` ran. Lint, tests, typecheck and build
were **not run locally**, as requested. Automated coverage, concurrency and integration-wide gates
remain for CI. No new PR was opened; the stack follows the user's integrated product review.
