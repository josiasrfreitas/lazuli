# Planning review scenarios

The user requested synthetic local examples for validating planning. These records
live in the isolated `lazuli_lazuli` development database. A normal full workspace
seed may remove them; no independent incremental seed command was introduced.

## Current examples

All three use Adultos / English Main, Essentials 1, its canonical regular 40-hour
program, Camila Duarte, capacity 20 and 16 synthetic adult students. They start on
August 1, 2026; the academic period ends December 31, 2026. Each has 15 recorded
past meetings with attendance and 128 varied grades. The sample contains a central
majority with smaller high and low groups. No financial activity or makeup credits
were introduced.

At the November 12, 2026 review baseline, each example had 14 future lesson hours:

| Example         | Saturday    | Class ID                               | Explicitly completed | Remaining load | Outlook       |
| --------------- | ----------- | -------------------------------------- | -------------------- | -------------- | ------------- |
| Ahead           | 08:00–10:00 | `55999282-2422-4411-9fbf-7614360c7677` | 36 activities        | 4h             | 10h margin    |
| Slightly behind | 14:00–16:00 | `27907e19-168e-44dd-90c6-691a69ac0bad` | 26 activities        | 14h            | No margin     |
| Far behind      | 16:00–18:00 | `328c377e-e037-427a-98d3-8338de6a90b7` | 14 activities        | 26h            | 12h shortfall |

Open `http://lazuli.lazuli.localhost/turmas/{id}?secao=planejamento`.
These figures are date-dependent snapshots, not permanent status labels.

### Corrected record coverage

The first seed linked each record only to its last reached activity, leaving
artificial holes. Those sparse links were unsuitable for judging completion.
The examples now explicitly record every actually covered activity through the
continuous prefixes 36, 26 and 14, using application record corrections. Attendance,
grades, session identities and audit history were preserved. There are still 15
past records per example; no fictitious meetings were added and the production
calculation does not infer completion from sequence position.

## Product behavior to inspect

1. Read whether the remaining source workload fits the remaining calendar capacity.
2. Inspect the named past, current and next content without scrolling a long list.
3. Open a lesson's bounded dialog to compare planned dates and actual evidence.
4. Follow evidence to the existing Aulas module.
5. Edit only the start; the semester ending remains fixed. Source revisions and
   existing activity IDs remain pinned when redistributing a saved schedule.

One lesson can cover several activities. Each has its own completion status.
Video and intermediate activity labels identify their canonical lesson context.
Incomplete evidence suppresses a confident forecast; partial activities use a
conservative full-duration bound.

When a new curriculum cannot fit, the page shows a read-only preview and deficit,
with unsupported activities explicitly undated. Saving still requires a feasible
schedule; the system does not compress source hours or extend the semester.

## Verification

The three examples and desktop/mobile dialogs were inspected in Orca. A separate
temporary class proved the initial-deficit path: 40h source, 2h available, 38 undated
activities and no saved plan. That class and its one empty session were deleted
after validation. The three requested examples remain.

The record editor was exercised with several selected activities, independently
changing completion and removing/readding one item, then cancelling without saving.
Historical comparison showed the lesson date. Actual record navigation and Escape
focus restoration were checked. Focused tests, final captures and the scoped finish
verdict are recorded in `IMPLEMENTATION.md` and `FINISH-REVIEW-V2.md`.

## Earlier manual example and capacity work

The original illustrative class `4a43db89-40c1-4dde-a2de-026e368e1a36` remains as
provenance. It used 26 manual activities before the canonical Essentials 1 import;
it is superseded by the three examples above for reviewing the accepted flow.

The earlier authorized capacity change remains: each class exposes its saved
capacity in the overview and an “Editar capacidade máxima” action in Alunos. New
classes default to 25, continuation copies the source capacity, and lowering the
limit preserves existing enrollments. This does not create an enrollment admission
gate. The capacity form's keyboard, validation and persistence checks were performed
separately. Other-agent academic-calendar/worker changes are not claimed as tested.
