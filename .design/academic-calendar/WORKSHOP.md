# Academic Calendar Workshop

Phase 6 started; production calendar is not complete. Tokens and task plan are
recorded. Route: `/aulas/calendario-workshop`, development-only and admin-only.
All dates and the cultural event are illustrative; this route performs no writes.

## Alternatives

- A: three-column annual grid with a contextual highlights panel. Details remain
  close, but the extra column makes the annual overview longer.
- B: two groups of six months; focused-month details sit below the grid. Emphasizes
  semester boundaries but takes more vertical space.
- C (recommended): four-column annual overview and dedicated focused-month screen.
  Gives the year more space and separates overview from day-level detail.

Accepted: the user chose the full year separated by semester, retaining month/day
drill-down. No further workshop requested. Removed the alternatives selector and
fixed the composition to semester groups. Sample data remains clearly labeled.

## Browser Evidence

Orca, 2026-11-12, desktop 1280×800 and narrow 375×812:

- All alternatives render twelve months without page-wide horizontal overflow.
- Exercised year → September → holiday → day → month → timed event → day → year
  in each alternative. Holiday grid renders and ScheduleCalendar displays the event.
- Verified light/dark presentation, inspected screenshots, and activated September
  using focus + Enter. CSS disables the only custom transition for reduced motion.
- Fixed selection-null handling, narrow control wrapping, navigation scroll position,
  and semester heading alignment during inspection. Aligned short-month contents
  to the top of equal-height month cards.
- Native pointer automation initially did not change some controls; DOM click
  activation was used for repeated scenarios, and keyboard activation was verified.
- Screenshots are in `screenshots/`; earlier dark screenshots precede final alignment
  refinements. Browser scenarios used sample data, not real holiday mutations.

## Remaining Work

Period impact previews; interruption reconciliation; holiday import integration;
planning capacity warnings; complete boundary/authorization audit and remaining browser
acceptance. TASKS.md tracks these separately. The selected composition is settled.

No lint, test, typecheck or build commands run. Commit hooks format and check staged
whitespace. This workshop is not the optional final design-review phase.

## Live Integration Progress

The accepted calendar is now available at `/aulas?visao=academico` through Agenda.
It queries real Period, SchoolClosedDay and AcademicEvent records. Header is a
single row; semester dates moved into group headings; annual legend filters itself
by categories present; expanded month uses date descriptions. Multiple category
markers can coexist on a date. Unknown coverage is explicitly labeled.

Browser evidence on 2026-11-12: created a temporary event through the form for
20 November 18:00–20:00, observed its annual marker, opened November/day and its
edit form with the same title/times, then removed it through explicit confirmation.
Confirmed form closed and temporary title disappeared. No validation event remains
active. Save-after-edit itself still requires browser acceptance.

Inspected real-data calendar at desktop and 375px: header stays one row, no stacked
subtitle/summary, month grids readable. Refined desktop controls into a right-side
cluster afterward. API initially hit a stale Prisma singleton; restarting the dev
server loaded AcademicEvent and the creation/removal flow succeeded.

## Daily Agenda and Event Acceptance

The live day now reuses the ordinary Agenda queries, lesson cards and dialogs, including
linked appointments/trial guests. Day navigation updates year/month/date in the URL;
refreshing a deep link restores the same date. One compact day toolbar replaces the
repeated month/back/date controls. Suspensions use a shared ScheduleCalendar background
interval, preserving access to existing records and timed events above it. The shared
contract and AcademicSuspension Storybook example document this behavior.

Browser evidence on 2026-11-12:

- Opened the real November 12 agenda through a deep link and observed the same regular
  and personalized lessons as the ordinary Agenda.
- Created, edited, reopened and removed a temporary event. Verified persisted title/time
  through the API. A stale event update returned HTTP 409 without overwriting it.
- Event edits/removals now use an immutable original timestamp and transactional activity
  logging. Removal retains a soft-deleted record.
- Replaced native datetime inputs with masked dates/times. Checked first-field focus,
  Enter validation, date/time masking, one Tab transition between title and date, Enter
  submission and a desktop body with equal scroll/client heights (356px). Added the
  required form contract coverage but did not execute it, per the user's instruction.
- Registered a temporary suspension on an unused date, inspected the full warning-colored
  grid at constrained desktop and 375px, then removed it. No temporary suspension or active
  validation event remains. Screenshots explicitly contain validation content.
- Opened the out-of-period appointment confirmation for January 11, 2027. A request without
  the acknowledgment returned HTTP 400 with the confirmation requirement. Did not confirm
  creation of a temporary appointment. Successful exceptional scheduling/rescheduling is
  still part of final acceptance.

Evidence: `screenshots/live-day-desktop.png`, `live-suspension-narrow.png`,
`live-event-masked-desktop.png`. Narrow layout had no document-wide horizontal overflow.
Full narrow keyboard traversal and theme coverage of the final event form remain for acceptance.

Still incomplete: period/recess management with preview/reconciliation, import,
capacity warnings, and the final scheduling-boundary audit. The design-flow and overall
epic remain active. No lint, test, typecheck or build commands run; only scoped formatting,
browser exercises, diff inspection and whitespace validation.
