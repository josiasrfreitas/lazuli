# Lazuli

School operations for a language school: students, classes, calendars, enrollment, attendance,
finance and reporting, operated by staff. One bounded context; the areas below are its main
clusters and name the first-level folders under `packages/api/src` and `packages/api/test`.

## Areas

**Students**:
People who study at the school, with their guardians, contacts and addresses.

**Classes**:
The academic catalog (product line, track, stage) and the groups that meet on a schedule.
_Avoid_: Course, group, turma

**Calendar**:
Semesters and closed days that bound when classes meet. Academic windows and commercial
installment schedules are separate concepts (decision 0005).

**Enrollment**:
A student's operational membership in a class. Stage placement over time is Pedagogical Progress,
not Enrollment (decision 0009).

**Attendance**:
Who was present at each class session, and the makeups that respond to absences.

**Finance**:
Everything the school charges and collects: payers, orders, installments, adjustments, payments
and finance settings.
_Avoid_: Receivables (as a name for the whole area), billing, financeiro

**Reports**:
Generated artifacts requested by staff.

**Dashboard**:
Aggregated views for the admin home and the teacher home.

## Finance terms

**Receivables**:
The derived, payer-scoped ledger of what is still owed: snapshots, overdue lists and balances
(decision 0007). A view inside Finance, never the name of the area.
_Avoid_: Ledger (alone), accounts receivable, contas a receber

**Payer**:
The person or organization responsible for paying one or more orders. Distinct from the student
who benefits from each order.
_Avoid_: Customer, guardian (as a synonym), responsável financeiro

**Contract**:
An agreement between the school and a payer for one beneficiary over an agreed term.
An educational contract defines tuition and the conditions for payment and early termination.
_Avoid_: Order (as a synonym)

**Order**:
A financial commitment owed by a payer for one beneficiary, payable through installments.
Its type identifies what is charged: Tuition for educational service, or Material for learning
materials. A separate optional association identifies the related Contract.
_Avoid_: Contract, purchase, sale

**Installment**:
One dated amount of an order. Adjustments and waivers change what it owes without rewriting it.
_Avoid_: Parcela, invoice, charge

**Tuition**:
The price of the student's educational service for an agreed period, commonly paid monthly.
The service period and payment schedule are distinct.

**Tuition Price Range**:
The authorized tuition range defined by a price ceiling and a maximum discount percentage.
Its derived floor applies to the final on-time price; the negotiated monthly terms cover the whole plan.
_Avoid_: Profit margin, markup

**Commercial Term**:
The agreed start and end of an individual educational commitment. It is distinct from academic
semesters, class membership dates and payment due dates.

**Payment Schedule**:
The agreed amounts and due dates of a financial commitment. Its timing is independent of the
academic calendar and the duration of the commercial term.

**Material Markup**:
The percentage added to the acquisition base to obtain the selling price of a material order.
_Avoid_: Profit margin, card fee

**Punctuality Discount**:
A percentage reduction in tuition conditional on payment by the agreed deadline.
_Avoid_: Fixed discount, waiver

**Cancellation Fee**:
A charge arising from early termination of an educational commitment that is not fully paid,
calculated as the agreed percentage of future installments' nominal amounts, before punctuality discounts.
_Avoid_: Late fee

**Late Payment Interest**:
Simple interest accrued on an overdue installment for each day and each completed month of
delay, counted at monthly anniversaries of the due date, under the agreed rates. After partial
payment, interest applies to the remaining amount; accrued interest is not capitalized.
_Avoid_: Late fee, cancellation fee

## Attendance terms

**Class Session**:
One scheduled meeting of a class on a date.
_Avoid_: Lesson, aula, meeting

**Class Record**:
The confirmed account of a Class Session: attendance and work actually performed, shared in a
regular class and individual for each present PPT student. A correction preserves the previous
account and its authorship. Planned work remains a distinct intention.

**Attendance Declaration**:
A student’s own report of presence for one Class Session, submitted for the teacher’s review.
It is separate from the final attendance confirmed by staff.
_Avoid_: Confirmed attendance, check-in approval

**Attendance Window**:
The teacher-opened period during which students can submit presence declarations for a Class Session.
Closing or replacing the window preserves declarations already received.

**Teaching Hour**:
A unit of 60 minutes of teaching time. A two-hour Class Session comprises two Teaching Hours.
_Avoid_: Class Session (as a synonym), hora-aula (in code)

**Makeup**:
A Pedagogical Appointment that replaces missed teaching time from identified absences. Confirmed
coverage compensates attendance while preserving the original absences.
_Avoid_: Reposição, make-up class, recovery session

**Makeup Coverage**:
The portion of an original absence addressed by a Makeup, measured in teaching minutes.
A planned allocation reserves that portion; confirmed delivery compensates it.

**Absence Contact**:
An attributed record of contact with a student or responsible adult about attendance, including
its outcome and any planned follow-up.

## Pedagogical terms

**Pedagogical Appointment**:
A scheduled teaching encounter for one student, with the explicit purpose of Makeup, PPT hour
complement, reinforcement or assessment. Its attendance and actual content are distinct from grades
and academic progression.

**Class Hour** (hora-aula):
A 60-minute unit of instructional time. A class meeting may contain more than one class hour; a two-hour meeting contains two class hours.
Weekdays in schedule codes use 1 = Sunday through 7 = Saturday. Schedule display codes number occupied one-hour blocks within each shift: M1 = 06:00–07:00, T1 = 12:00–13:00, N1 = 18:00–19:00. Partially occupied blocks are included; exact meeting times remain available. Equal time slots on multiple weekdays are grouped, e.g. Tuesday/Thursday 19:00–20:30 → `3N2-5N3`.

**Recurring Class Schedule**:
The weekdays and start/end times on which a class normally meets. A class may meet on one or more weekdays, and each meeting may have a different duration.

**Pedagogical Progress**:
A student's stage placement over time, separate from operational class membership.

**Stage Plan**:
The planned dates and learning activities for completing a stage. Regular classes share a
semester plan; personalized students each have an individual plan and duration limit. The individual
plan follows the same stage attempt across class transfers and pause/return. A new stage starts a
new plan. Planned activities and the target end date are intentions, separate from actual class
records, grades and stage completion. Attributed revisions preserve earlier versions.

**Competency**:
An individually assessed dimension of learning: oral, listening, written or participation.

**Assessment Block**:
One of the two assessment groups within a stage, containing one grade for each competency.

**Pedagogical Occurrence**:
A teacher's report of an atypical situation after a class, including the initial response.
Occurrences may relate to one another independently of an intervention.

**Pedagogical Intervention**:
A series of related occurrences that requires a teacher’s action. It groups the motivating
occurrences and identifies the responsible teacher, with follow-up and an outcome.

**Experimental Session**:
A prospective student's participation in a scheduled meeting of an existing class.

**Introductory Session**:
A separately scheduled meeting between a prospective student and a teacher to introduce the
personalized course and its materials and operation.

## Lead terms

**Lead**:
An enrollment opportunity for a prospective learner or an existing student seeking a new placement.
The person contacted may be the learner or someone acting on their behalf.
_Avoid_: Student (as a synonym), interested person, candidate (in product language)

**Lead Contact**:
The person with whom the school discusses an enrollment opportunity, such as the learner or a parent.
A lead contact is not automatically the student's legal guardian or payer.

**Next Step**:
The next agreed action for an open lead, with a due date and an owner when assigned.
A scheduled introductory or trial class remains a separate appointment with its own outcome.
