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
Initial browser acceptance exercised the reconciliation handler in a separate local
process because the workspace's Hatchet token was empty. Final acceptance also exercised
the normal worker entrypoint and Hatchet delivery, as recorded below. No cancellation
work runs in the web request.

Integration/transport coverage was updated for preview confirmation, stale edits,
idempotency, overlapping recesses, preserved manual dates and authorization; form contract
coverage was added, together with generation-window and assigned-semester regression cases.
These suites were **not executed**, following the user's instruction.
Lint, typecheck, build and full test gates remain deferred to PR/CI. Scoped formatting and
`git diff --check` were run. This is browser/manual evidence, not a passing CI claim.

## Follow-up: detail and completed-work refresh

Interruption descriptions now appear in the selected date's month panel and daily Agenda,
preserving line breaks. The annual overview remains compact. Successful reconciliation
invalidates affected activity, planning and metric queries, so an already open day reflects
the worker result without a reload.

Orca validation created a temporary one-day recess on November 22, with a two-line
description. Preview and final worker counts were zero for every activity type. Network
evidence showed a fresh `classRecords.list,classRecords.experimentalSessions,appointments.list`
request after the completed calendar query. Inspected the description in the daily view
and narrow month panel; main client/scroll widths both measured 375px. Evidence is in
`live-recess-description-day.png` and `live-recess-description-mobile.png`. Removed the
temporary interruption, projected day, request and audit records after verification.
No automated suites were run.

## Final calendar acceptance

Delivery covers the academic calendar described in the brief. Class continuity,
organization, renewals and other requirements of issue #235 remain outside this slice.

| Requirement                                        | Current implementation and acceptance evidence                                                                                                                    |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Configurable semester boundaries                   | Period forms, change preview and assigned-semester generation guards; temporary period creation and shortened-period preview exercised above.                     |
| Annual view, semester groups, month/day navigation | Live Agenda route and URL navigation; current desktop/narrow views inspected with twelve months and the actual 2026.2 dates. Main client/scroll width both 375px. |
| Sticky legend and contrasting vacations            | Semantic calendar CSS and contextual markers; light/dark sticky-vacation captures and computed positions recorded above.                                          |
| Holidays and ad hoc interruptions                  | BrasilAPI suggestions, SE 2026 source, state selector and manual entry; live import dialog rechecked. Operator confirms before applying.                          |
| Reason and description                             | Stored interruption fields, month/day descriptions and full-day schedule background; desktop/narrow evidence saved.                                               |
| Consequences and reconciliation                    | Fingerprinted preview, durable requests and worker preservation rules; cancellation, overlap, stale-preview and retry scenarios recorded above.                   |
| Capacity warnings                                  | Actual durations versus known plan requirements; missing targets remain unknown and deficits permit confirmation.                                                 |
| Ordinary lessons and exceptional appointments      | Assigned-semester bounds plus date-bound appointment acknowledgment; successful scheduling/rescheduling and rejection cases recorded above.                       |
| Basic timed events                                 | AcademicEvent persistence, validated CRUD and daily rendering; create/edit/remove and stale-edit acceptance in WORKSHOP.md.                                       |

The local Hatchet service was healthy on the existing Colima context. Configured a local
token in ignored `.env`, stopped the temporary direct poller and started the normal worker
with `pnpm exec dotenv -e .env -- pnpm -F @lazuli/worker start`. The current worker registers
calendar reconciliation as a recurring Hatchet task. This runtime registration is part of
the separate worker refactor; its files are not included in this follow-up commit.

Confirmed a temporary November 22 interruption through the browser API after a preview
with zero affected activities and plan items. Request
`d43b9f80-87d3-47fd-9d97-823c35a52593` reached SUCCEEDED through Hatchet at
2026-11-12T20:15:10.380Z, with zero cancellations and zero generated sessions. Inspected
the completion state, multiline description and full-day background in the live daily
Agenda (`screenshots/live-hatchet-reconciliation.png`). Removed the temporary interruption,
projected date, request and associated audit records after verifying those counts.
The normal local worker remains running. No temporary validation script remains.

Final diff and whitespace were inspected. Automated delivery gates remain deferred to
PR/CI by the user's explicit instruction; this does not claim passing automated checks.

## Configuration flow polish — November 12

Configuration now keeps one dialog mounted through list, form, holiday import and
impact preview. Tabs separate semesters from interruptions; desktop holiday selection
uses a three-column grid. Short date fields share a row with the title. Loading uses
structural skeletons and action-specific pending labels; background failures retain
previously loaded calendar data. The sticky legend has padding and a complete border.

Orca validation confirmed the same dialog node through editing and impact preview,
with focus on the title then confirmation action. Desktop import measured 992px wide
with no horizontal or vertical overflow. At the narrow viewport the dialog measured
341px wide with no horizontal overflow; vertical scrolling stayed in the body with
footer actions available. Screenshots: configuration-tabs-desktop.png and
holiday-import-mobile.png. A final repeat after hot reload remained in loading and
timed out, so the final loading-to-data transition was not revalidated in that repeat.
No further persistent calendar changes were made during these visual checks.
Automated checks were not run, per user instruction. Reviewed scoped diff and
ran git diff --check.

## Follow-up: motion, icons and reduced calendar surface

Added missing action icons and a 280ms interruptible WAAPI resize on the configuration
surface, using the existing duration/easing tokens. Only the background scales; expansion
reveals content with clip-path. Keyboard interaction and reduced-motion preference skip
resizing. Observers and animations are disposed with the dialog.

Removed the day-detail panel and embedded daily agenda from the academic calendar.
Monthly events remain editable below the month. Replaced the large skeleton with a compact
loading status and heading after direct user rejection of the skeleton design.

Final browser validation is blocked: the previous Orca tab disappeared and a fresh pinned
tab rendered blank. The local academic-calendar URL returned HTTP 404 from Caddy on
November 12 at 21:20 UTC. The final animation and loader are not visually accepted or
claimed validated. Scoped diff reviewed; git diff --check passed. No automated gates run.
