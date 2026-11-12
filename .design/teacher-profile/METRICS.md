# Teacher monitoring: proposed calculation contract

Status: product direction accepted by the user ("otimo!", 2026-11-12); detailed calculation
contract still requires implementation verification. This is not a scientifically validated
teacher scoring standard. Scope: the individual teacher profile.

## Research and interpretation

The [OECD teacher-appraisal overview](https://www.oecd.org/en/topics/teacher-appraisal.html)
recommends multiple perspectives because a single score has reliability and validity
limitations. The [MET project final report announcement](https://www.gatesfoundation.org/ideas/media-center/press-releases/2013/01/measures-of-effective-teaching-project-releases-final-research-report)
describes combining classroom observations, student surveys and achievement gains.

Application to Lazuli is our design inference: existing student records support a useful
monitoring panel, but do not validate a causal teacher-effectiveness score. Neither source
endorses the weights or aggregation proposed here. Do not add unsupported statistical
precision, rankings or arbitrary composite weights.

## 1. Student health summary

UI label proposal: **Saúde dos alunos**. Population: unique students currently enrolled
in the teacher's currently assigned classes in an active semester. Show the semester/date
range and roster size. This is a current-cohort lens, not a historical teacher roster.

`group health = sum(available student health scores) / students with a score`

Deduplicate each student across classes. Weight students equally, not classes equally.
Example: one class of 2 students scoring 100 and one of 18 scoring 60 yields 64, not 80.
Round only for display. Exclude missing values from the calculation and show coverage as
both a fraction and percentage. Do not invent a confidence threshold from sample size.

The existing student model uses frequency 35, grades 30, occurrences 20, and follow-up 15;
weights are renormalized over available indicators. Thus a score with no grades is not
equivalent in evidence to one with grades. Show grade and attendance coverage separately.
Also show student counts by the existing health bands (80+, 60–79, below 60), so the mean
does not hide students needing attention. Identify these as student-health bands.

This summary intentionally includes the student's full existing health context. It must
not be relabeled as the teacher's own performance, nor duplicated into a new weighted
score with attendance and grades added a second time.

## 2. Academic outcomes

Container: **Aprendizagem**. Breakdowns by book/stage, class and student.

- Use grade assessment dates, semester boundaries, enrollment intervals and teacher
  responsibility intervals for the teacher-period view. Exclude deleted records and
  deduplicate grade IDs linked through transferred enrollments.
- Calculate each student's mean first, then the mean of students in the displayed
  book/stage. Show students assessed / eligible students and grade count. An overall
  mean, if displayed, must also give each student equal weight.
- Retain phase and competence breakdowns. Do not treat different books or assessment
  phases as interchangeable learning measures. The grade recorder is not necessarily
  the teacher who taught the student.
- Shared assessments linked to more than one class require unambiguous enrollment/date
  attribution. Ambiguous evidence must not be copied into multiple class totals.

Proposed follow-up metric: paired change in the same student's same-book, same-competence
assessments across comparable ordered phases. Average individual differences and display
the matched sample count. Both observations must be eligible for the teacher-period view.
Until comparability and phase semantics are verified, show results without an evolution
claim. A change from one unrelated book to another is not a learning-gain measure.

## 3. Attendance

Container: **Frequência**. Use confirmed attendance in held sessions and eligible enrollment
windows. Cancelled/future/unconfirmed sessions are not absences. Use duration-aware
student-minutes, consistent with existing attendance rules:

`gross absence rate = absent student-minutes / eligible held student-minutes`

Show gross absence and compensated absence separately; uncompensated absence is the
remaining eligible absence after applying existing compensation limits. Recovery does not
erase the original missed class. Label counts as student absences, not teacher absences.
Show absent/eligible student-minutes for rates. Count confirmed versus due calls once per class session, independently of the number of students; expose counts per class in details.

For class rows, compute attendance from that class's sessions, never from the student's
global attendance score. Distinguish current-class monitoring from sessions actually
taught by this teacher; responsibility/substitution history supplies the latter scope.

## 4. Pedagogical follow-up

Container: **Acompanhamento**. Show students needing attention and pending/accompanied
occurrences with links to the existing records. Follow-up coverage can use distinct
eligible occurrences with a linked intervention divided by eligible occurrences.
No eligible occurrences means “Sem ocorrências”, not an invented perfect teacher score.

Counts describe the students' situation. They are not teacher-authored actions unless
authorship/responsibility is explicitly verified. Avoid rewarding fewer logged occurrences:
the existing student's occurrence penalty would otherwise discourage accurate reporting.
Do not change that existing policy as part of this page redesign.

## Time, responsibility and evidence

- Current student health remains consistent with the student profile. Teacher-period
  outcomes are a separate, explicitly labeled lens bounded by semester, enrollment and
  responsibility periods, through today in America/Sao_Paulo.
- Teacher changes must not move old outcomes into the new teacher's period. A substitute
  receives the actual taught session in operational totals, not the entire class history.
- Recomputing old scores from mutable current records does not establish what was known
  at the time. There is no verified health snapshot history in this inspection. Defer
  historical health sparklines until a reproducible comparison contract exists.
- Always retain no-data, no-assessments, no-confirmed-attendance and partial-coverage
  states. Missing data must not improve or worsen a fabricated teacher grade.

## Draft defects to fix before implementation acceptance

`packages/api/src/teachers/metrics.ts` currently uses global student indicators for class
grades/attendance, does not lower-bound book grades by semester/responsibility, and averages
raw grade records for books. Its rounded mean of attendance complements is not a properly
weighted absence rate. These drafts cannot yet support the proposed labels.

Available building blocks: `calculateStudentHealth`, `readStudentHealthBatch`,
`teacherResponsibilityPeriods`, confirmed session attendance, `AssessmentGrade` phase,
competence and assessedOn, and `ClassSessionRecord.teachingTeacherId`.

## Targeted acceptance cases

Unequal class sizes; a student in two classes; an assessment reused after transfer;
mid-semester teacher change; substitution; cancelled/future/unconfirmed sessions;
compensated absence; students with no grades; an empty cohort; ambiguous class attribution;
and comparisons whose two observations are not actually comparable.

## Final presentation refinements

The health info dialog explains the live cohort arithmetic, existing domain weights, score bands, missing evidence and scope limitations. Current student scores exclude outside-class occurrences; the teacher follow-up container includes them. Follow-up uses mutually exclusive counts: open without intervention, open with intervention and closed. Student drill-down lives in Alunos, grouped by class.
