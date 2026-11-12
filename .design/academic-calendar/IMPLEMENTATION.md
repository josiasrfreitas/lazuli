# Academic calendar implementation

The accepted design is connected to the real Agenda at `/aulas?visao=academico`.
The design-flow build phase is implemented; this record concerns the calendar slice,
not completion of unrelated epic requirements or paused class continuity work.

## Behavior

- Annual view groups twelve months by semester, with month/day drill-down and the real
  daily Agenda. The applicable legend stays at the top of the main scroll container.
  Vacation dates and their legend use a filled, contrasting surface in both themes.
  The desktop header stays on one line; narrow screens use two compact rows.
- Semester dates belong to Period. The same configuration forms are reused from class
  organization. The old direct calendar mutation routes were removed so edits cannot
  bypass impact preview and confirmation.
- Interruption reasons are holiday, recess, maintenance or other, with a description and
  inclusive date interval. They suspend academic activities throughout the school and
  do not describe administrative opening hours.
- Confirmation compares a fingerprint of the preview against current evidence while
  holding the teaching schedule lock. A durable request carries identifiers/date range;
  the worker cancels future activities without evidence and preserves existing records.
  Appointment cancellations retain revision snapshots and synchronize legacy makeups.
- Status, completion and retry are visible in Agenda; older failures remain visible
  even after newer requests finish. Removing an interval preserves
  overlapping intervals; releasing a date never resurrects an already cancelled lesson.
  Existing legacy calendar dates are adopted by migration, preserving unknown authors.
- National suggestions come from BrasilAPI, with fixed national dates as an explicitly
  labeled fallback. The state selector adds the sourced Sergipe July 8 holiday for 2026;
  other state/year combinations explicitly require manual entry. Municipal dates are manual.
- Capacity uses actual schedule durations, existing sessions and known program activity
  durations. Missing targets remain unknown. Deficits warn without blocking confirmation;
  conflicting plan dates remain linked for review after saving.
- Regular session generation stays within its assigned semester. Independent visits
  require a configured period. Independent pedagogical appointments can be outside a
  period only with acknowledgment tied to the selected date; suspensions still block them.

## Browser and persistence evidence — 2026-11-12

All browser operations used Orca's embedded browser against the running local app.
Temporary validation records were removed after inspection; no school semester dates
were invented as defaults and the real 2026.2 period was not changed.

- Created a temporary semester through the live form and confirmed its preview. The
  reconciliation request completed; its gap to the next semester produced vacation days.
- Inspected sticky legend at scroll offset 380: legend top and main top were both 56px.
  Vacation foreground/background were white / rgb(96,108,124) in light mode and dark
  foreground / a filled light neutral in dark mode. Both cell and legend are distinct
  from unconfigured dates. Inspected desktop and narrow layouts. Fixed narrow header
  overflow; main scroll width and client width then both measured 375px.
- Created a one-day interruption through the form. Preview showed one regular lesson,
  one appointment and one trial to cancel, and one session with existing attendance
  evidence to preserve. Worker result was exactly 1/1/1 cancellations and zero generated
  lessons; the protected session stayed scheduled. Appointment version advanced to 2
  with a cancellation revision.
- Added an overlapping interruption through the browser API. Confirming an older preview
  returned HTTP 409. Removing the first interval released no dates; removing the last
  released only November 22. Repeating the same confirmed command returned the same request.
  The cancelled lesson stayed cancelled after release.
- A controlled failed request exposed the retry action. Clicking it returned the request
  to processing and then SUCCEEDED, without cancellations or new sessions.
- Read BrasilAPI suggestions in the live import form and checked the SE 2026 response,
  including the state source. Changed the form's year to 2027 and verified the returned
  dates and first-field focus. Did not import the school's real holiday choices for it.
- Previewed shortening the existing semester to November 15: displayed 248 future
  activities, 30 affected plan items and a capacity warning with confirmation enabled.
  Cancelled the preview; no actual period or school activities changed.
- Scheduling an independent appointment on January 11, 2027 without acknowledgment
  returned 400; adding the matching date succeeded. Rescheduling to January 12 while
  retaining the old acknowledgment returned 400 and preserved the original booking;
  acknowledging January 12 succeeded and retained the rescheduling link. Both temporary
  appointments and their validation evidence were subsequently removed.
- Checked first-field focus, Enter validation/submission, masked dates, details expansion,
  active error text, and narrow form layout. Existing daily/event acceptance is recorded
  in WORKSHOP.md.

Screenshots under `screenshots/`: `live-sticky-vacations-light`,
`live-sticky-vacations-dark`, `live-calendar-mobile-fixed`,
`live-interruption-form-mobile`, `live-interruption-impact-dark`, and
`live-semester-capacity-warning`. These are live app captures using explicit temporary
validation data where indicated.

## Runtime and delivery

Three new migrations were applied locally; Prisma/Kysely clients were regenerated.
The full local worker could not start because its Hatchet token was empty. For browser
acceptance, the real `startCalendarReconciliation` worker poller ran directly in a separate
local process with the workspace environment. The normal worker entrypoint also starts
this poller. No cancellation work runs in the web request.

Integration/transport coverage was updated for preview confirmation, stale edits,
idempotency, overlapping recesses, preserved manual dates and authorization; form contract
coverage was added, together with generation-window and assigned-semester regression cases.
These suites were **not executed**, following the user's instruction.
Lint, typecheck, build and full test gates remain deferred to PR/CI. Scoped formatting and
`git diff --check` were run. This is browser/manual evidence, not a passing CI claim.
