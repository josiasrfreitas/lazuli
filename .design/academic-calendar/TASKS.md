# Build Tasks: Academic Calendar

Generated from DESIGN_BRIEF.md and INFORMATION_ARCHITECTURE.md, 2026-11-12.
User requested continuation of the flow; token reuse was already accepted.
Only the explicitly requested event foundation is implemented so far.

## Foundation and Visual Direction

- [x] **Basic event persistence**: AcademicEvent with title, description, start/end,
      standard lifecycle fields and database constraints. Migration applied locally.
- [x] **Reuse tokens**: Record current system contract in DESIGN_TOKENS.md.
- [x] **Interactive annual workshop**: Compare three annual compositions using the
      existing operational visual system and shared controls. Each supports year → month
      → day, holiday grid, timed event and return. Clearly label sample data and keep
      prototypes development-only. Implemented and inspected desktop/narrow in Orca;
      user selected the whole year grouped by semester. See WORKSHOP.md.

## Core UI and Behavior

- [ ] **Live annual/month/day consultation**: Add `visao=academico` to existing Agenda;
      query periods/closed dates/events by year, derive known vacations, preserve unknown
      coverage, and reuse ScheduleCalendar for daily detail. Includes loading/error/empty
      states and accessible legends. Depends on accepted workshop direction.
- [ ] **Basic event creation/edit/removal**: Add validated admin API and compact form
      with title, optional description and start/end; display timed events in daily detail.
      Server validates dates, deletion and authorization. Reuses AcademicEvent and forms.
- [ ] **Semester configuration with impact**: Reuse Period forms/data; preview edits,
      enforce assigned-semester boundaries and reconcile future sessions through worker
      requests. Preserve completed records; reflect pending/failure/retry states.
- [ ] **Academic interruption registration**: Add reason/description and interval
      editing, preview grouped class/appointment/trial impacts, confirm once and reconcile.
      Use shared dialogs/tables; cancel future activities without rewriting history.
- [ ] **Holiday suggestions**: Reuse BrasilAPI; year/geography, source coverage,
      selection and combined impact preview. Safe deduplication/retry and manual fallback.
- [ ] **Exceptional appointments**: Reuse appointment scheduling/rescheduling form;
      explicit out-of-period warning and server acknowledgment. Explicit suspensions and
      ordinary conflicts remain blocking. Date changes invalidate acknowledgment.
- [ ] **Capacity warnings**: Show real class duration/weekday capacity against known
      plan requirements. Allow saving deficits, label missing targets unknown; preserve
      separation from paused class organization and commercial workflows.
- [ ] **Edit/removal recovery**: Explain released dates, retain cancellations and
      rescheduling links, preserve other overlapping interruptions, handle stale previews.

## Validation and Delivery

- [ ] **Boundary audit**: Review late class starts, manual session paths, semester
      shrinking/extending and trial rules. Ensure membership in the assigned semester,
      not merely any semester. Do not broaden appointment exceptions to trials silently.
- [ ] **Browser acceptance**: Exercise each slice at 1280px/constrained laptop and
      375px, light/dark, keyboard, no horizontal overflow and reduced motion. Save evidence.
- [ ] **Final diff and scoped commits**: Inspect complete diff and whitespace; do not
      run lint/tests/typecheck/build per user instruction. Report deferred delivery gates.

Design review is separate and only runs if requested. Prototype acceptance is not
product completion. Keep unfinished slices unchecked across context compaction.
