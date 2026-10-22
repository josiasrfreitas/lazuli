# V8 browser evidence — 11 October 2026

Issue #185. Validated through Orca's browser against the integrated branch, with one web server
on port 3004 and one namespaced Hatchet worker with one slot. All records are synthetic local data.

## Observed workflows

- The future-semester overview shows class plans, selected publication, academic/availability
  blockers, unassigned students and teacher conflicts. The student pool searches and paginates
  the 250-student school; suspended students remain blocked for publication.
- Renewed Helena Moreira Siqueira's availability through 30 June 2027. An impossible date was
  rejected with focus on the invalid control. Masked typing and Enter then saved a valid confirmation.
- Selected only Helena for publication. The confirmation named the student, showed the 1 January
  entry date and the five proposals staying in preparation. Only her future enrollment was created;
  the actual new class automatically received 51 encounters through the real Hatchet worker.
- Invalidated Isadora's published PPT availability with a reason. Her proposal showed a review warning.
  Withdrew the publication, renewed availability and published again. The old future enrollment was
  soft-deleted and the source exit cancelled; the replacement has a new future enrollment and paired
  scheduled exit. The source enrollment remains open. Direct database inspection confirmed identical
  assessment and stage-plan IDs on the current and replacement future progress.
- Isadora's history retained four versions: proposal, first publication, justified withdrawal and
  republication, with authors and dates. Dependency changes are visible without rewriting history.
- Created a new PPT class plan for Lucas Monteiro. Empty required values were rejected. Both weekly
  intervals accept masked typing; Enter saved the plan. Added Luísa Oliveira Batista from the student
  pool as a new entrant, retaining the E1 stage suggested by her lead.
- Luísa's prior lead availability prefilled the confirmation with a visible instruction to reconfirm
  it for the target semester. Confirming it did not make an incompatible class eligible. Editing
  the draft class to Tuesday/Thursday 16:00–17:00 then made her proposal ready for publication.
- Created semester 2027.2 with masked dates and Enter. Its empty state appeared, and switching back
  restored the prepared 2027.1 view.
- Camila's teacher navigation omits organization. A direct request to `/proximo-semestre` now reaches
  the standard restricted-area page at `/403`; administrative operations also use the admin API boundary.

## Interface evidence

Inspected 1280×800 and 390×844, including light/dark overview, focused roster and availability.
The mobile document and main remain exactly 390 px wide. Mobile rosters use individual student
cards. Weekly interval controls keep the day together and the start/end on a coherent second row.
The format pills retain sufficient width rather than becoming a narrow vertical strip.

At desktop the class-plan body measured 474/474 px, availability 558/558 px and semester creation
208/208 px (scroll/client height). First-field focus, masked dates/times, Enter validation/submission,
Escape/cancel and visible confirmation focus were inspected. Publication focuses the actual submit
button. An initial `FieldError` rendered outside its field context crashed the interval form; it was
replaced by a labelled group error and all affected workflows were retried successfully.

Screenshots are in `evidence/`. Early desktop captures retain the development issue badge from
that initial crash; later reloaded captures show the corrected state. These are implementation
choices awaiting the user's integrated product review, not a claim of design approval.

## Seed and remaining verification

The official isolated seed rebuilt successfully with 250 students, 22 current classes, seven teachers,
220 contracts, 17 appointments and 14 contacts. V8 adds eight class plans, 32 proposals, 30 availability
confirmations, 46 placement revisions and 12 published enrollments in four future classes.
No future attendance, grades or teaching records are fabricated.

After browser operations the database retains 250 students, 27 actual classes, nine plans,
33 proposals, 13 published proposals and 34 availability confirmations. A second future semester
is the disposable calendar-creation result. Previous verticals' manual QA records were replaced by
this official seed; their screenshots remain historical evidence.

Authored coverage protects partial/atomic publication, stale versions, current membership and PPT
attempt preservation, paired withdrawal, teacher authorization, academic progression, validity-date
boundaries, due-date revalidation and invalidated availability. A source review also found that the
worker's 100-action batch could split a paired exit/entry. Batches now include both halves; a
101-action integration case covers that boundary. This case, concurrency and future-date execution
have **not been run locally**. Form coverage includes the interval error regression and labelled
masked controls; navigation expectations now include appointments and next-semester organization.

Only commit formatting/whitespace hooks and `git diff --check` ran. Lint, tests, typecheck and build
remain deferred to CI as requested. Once a semester starts, organization is read-only; proposals
returned for review must be regularized through the current class/enrollment flow. Financial
contracts and collections are unaffected by organization.
