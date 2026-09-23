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
Its type identifies its origin or purpose: Contract for a commitment arising from a contract,
or Material for learning materials.
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

**Makeup**:
A replacement session scheduled for a student in response to an absence. Its outcome counts
toward the student's attendance. A sub-concept of Attendance, not an area of its own.
_Avoid_: Reposição, make-up class, recovery session
