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
Periods and closed days that bound when classes meet. Academic windows and commercial
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
periods, class membership dates and payment due dates.

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
A negotiable charge for early contract termination, defaulting to 20% of all unpaid principal,
including overdue and future installments; amounts already paid and late charges are excluded from its base.
_Avoid_: Late fee

**Contract Termination**:
An irreversible closure of a contract and its selected active enrollments, preserving receipts and
replacing open installments with an agreed settlement of overdue principal, negotiated late charges and cancellation fee; future principal is released.

**Late Payment Interest**:
Simple interest on overdue tuition at one agreed monthly rate (initially 2%), prorated by
actual days of delay using a 30-day month. Partial payments cover charges before reducing
the principal on which further interest accrues; interest is never capitalized.
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

**Teaching Hour** (hora-aula):
An ordered 60-minute block in a Teaching Program. A dated Class Session can cover one or more Teaching Hours.
_Avoid_: Lesson, Class Session (as synonyms)

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

## Class organization terms

**Period**:
An academic window with a start and end date, normally six months long. Every class belongs to one Period.
_Avoid_: Semester (as the entity name)

**Continuity Confirmation**:
A student's intention to continue in a class for a specific Period. It is independent of contract renewal and of applying the student's class membership.

**Contract Preconfirmation**:
The default continuity indication when an unterminated contract covers the first three calendar months of the target Period. An explicit intention to change classes or leave takes precedence.

**Contract Renewal**:
A new contractual agreement extending the student's commercial commitment. Confirming continuity for class planning does not renew the contract.
_Avoid_: Rematrícula (as a synonym for continuity confirmation)

**Lead Class Interest**:
A lead's proposed class while awaiting entry. Future entrants remain leads until entry in a current Period.

## Pedagogical terms

**Pedagogical Appointment**:
A scheduled teaching encounter for an existing student, either as a guest in an existing Class
Session or at a separately scheduled time, with the explicit purpose of Makeup, PPT hour complement,
reinforcement or assessment. Its attendance and actual content are distinct from grades and
academic progression.

**Schedule Code**:
Weekdays in schedule codes use 1 = Sunday through 7 = Saturday. Schedule display codes number occupied one-hour blocks within each shift: M1 = 06:00–07:00, T1 = 12:00–13:00, N1 = 18:00–19:00. Partially occupied blocks are included; exact meeting times remain available. Equal time slots on multiple weekdays are grouped, e.g. Tuesday/Thursday 19:00–20:30 → `3N2-5N3`.

**Recurring Class Schedule**:
The weekdays and start/end times on which a class normally meets. A class may meet on one or more weekdays, and each meeting may have a different duration.

**Pedagogical Progress**:
A student's stage placement over time, separate from operational class membership.

**Class Plan**:
A proposed class within a Period, with its schedule, format and intended teacher.
Its students can be published in separate groups as their placements become ready.

**Period Placement**:
A student's proposed destination and academic step for a target Period: a new entry,
PPT continuation, stage advancement or repetition. Publication schedules the future membership
and any related departure without ending the current membership early.

**Learning Material**:
A book or supporting resource associated with a stage. The main book provides lesson references;
PPT supports belong to the school and are lent to the student without a separate charge.

**Track**:
An ordered path of Stages within a Product Line. Every track has a pedagogical Age Group.

**Track Age Group**:
The catalog classification Adult or Child. Teens belong to Adult; Child is reserved for the young children's tracks, independently of a student's legal age.

**Stage**:
One step in a Track, with its learning material and teaching programs. Its position is defined within its own track.

**Book Lesson** (lição):
A numbered content unit in a stage's book. One lesson can span several Teaching Hours, and one Teaching Hour can cover parts of several lessons.

**Teaching Modality**:
The weekly teaching load, currently two Teaching Hours by default and extensible to other weekly loads. It is independent of Regular/PPT scheduling and in-person/online delivery.

**Teaching Program**:
The externally supplied, undated curriculum for a stage and teaching modality, organized into Program Units, Teaching Hours and structured activities. A revision preserves the curriculum that earlier plans and records referenced.

**Program Unit** (unidade):
The consecutive portion of a Teaching Program ending with its assessment. Units can contain different numbers of Teaching Hours.

**Program Assessment** (prova da programação):
A planned assessment closing a Program Unit, possibly spanning more than one teaching-hour segment. It is distinct from a student's grade or an Assessment Block.

**Program Activity**:
A structured portion of a Teaching Hour belonging to a Program Unit, with a duration and references to book lessons or a program assessment. A source abbreviation is provenance, not a substitute for its meaning.

**Stage Plan**:
The planned dates and learning activities for completing a stage. Regular classes share a
period plan; personalized students each have an individual plan and duration limit. The individual
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
A lead's opportunity to experience a course modality, either as a guest in an existing Class Session
or in an individually scheduled meeting with a teacher.
_Avoid_: Introductory Session (as a separate kind of experience)

**Experimental Session Participation**:
Whether an Experimental Session takes place in an existing class or individually. This choice is
independent of the course modality and whether the meeting is online or in person.

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
A scheduled Experimental Session remains a separate appointment with its own outcome.

## Curriculum and records

**Planned Program Activity**:
A Program Activity assigned a planned date within a class-wide or individual Stage Plan. It identifies the intended work; reaching the planned date does not establish completion.

**Performed Program Activity**:
The work actually reported by the teacher against a Program Activity, for the regular class or an individual PPT student. It may be partial, repeated or performed on another date; it is separate from attendance and grades.
