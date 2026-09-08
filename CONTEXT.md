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
The person or organization responsible for paying an order. Distinct from the student who
benefits from it.
_Avoid_: Customer, guardian (as a synonym), responsável financeiro

**Order**:
A commitment to pay for one or more beneficiaries, split into installments.
_Avoid_: Contract, purchase, sale

**Installment**:
One dated amount of an order. Adjustments and waivers change what it owes without rewriting it.
_Avoid_: Parcela, invoice, charge

## Attendance terms

**Class Session**:
One scheduled meeting of a class on a date.
_Avoid_: Lesson, aula, meeting

**Makeup**:
A replacement session scheduled for a student in response to an absence. Its outcome counts
toward the student's attendance. A sub-concept of Attendance, not an area of its own.
_Avoid_: Reposição, make-up class, recovery session
