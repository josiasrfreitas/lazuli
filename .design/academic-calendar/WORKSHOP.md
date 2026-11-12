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

Visual selection; live API integration; event editor/API; period impact previews;
interruption reconciliation; holiday import integration; appointment exception;
planning capacity warnings; complete boundary/authorization audit and real browser
acceptance. TASKS.md tracks these separately.

No lint, test, typecheck or build commands run. Commit hooks format and check staged
whitespace. This workshop is not the optional final design-review phase.
