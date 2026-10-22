# Activity timeline — issue #177

## Accepted direction

On 2026-10-11 the user requested broad coverage of important actions, with date and authorship,
without deep field-by-field auditing. The user explicitly replaced the table proposal with an
infinite-scroll timeline. The final composition groups events by São Paulo civil day, connects
entries with a quiet vertical line, and places actor, subject, time and context in each entry.
Long descriptions expand inline. Search, period, area and actor filters remain available.

The list/table, separate cards and continuous timeline were considered. The continuous timeline
is the user's selected direction. It keeps chronological reading clear without repeating card
frames or hiding every description behind a dialog.

Events are persisted in the business transaction. No Hatchet workflow is introduced. Read access
is restricted to ADMIN/SYSTEM_ADMIN. The explicit action catalog covers student/enrollment,
assessments, attendance, leads, finance, teachers/classes and calendar operations. Reads and
navigation are not events. Confirmed-grade corrections include the previous score/author, new
score, correction reason and withdrawal of the previous confirmation.

## Browser evidence

- Integrated workspace only, port 3004. Full school seed applied successfully on 2026-10-11.
- The initial seeded snapshot loaded 247 activities for the last 30 days. Scrolling loaded 20 → 40 entries;
  all 40 IDs were unique. Cursor ordering uses occurrence time and ID with a fixed time bound.
- Selecting Comercial returned 58 activities and restarted the timeline at its beginning.
- Inspected desktop dark 1280×900 and mobile light 390×844. Mobile document/main width both
  measured 390 px; event text wraps and the timeline owns vertical scrolling.
- Before rebuilding the seed, a real academic grade correction created an event with actor,
  timestamp and previous value. Those manual records were intentionally removed by `pnpm seed`.
- Search for “Notas” returned 42 matching entries; filtering by Camila Duarte retained her entries.
  An unmatched search displayed the empty state.
- After the latest full seed, a contact registered through the lead screen produced a new event
  for Amanda Queiroz Barros with Clara Ribeiro, 01:25 and the complete conversation. Searching
  Amanda showed that contact plus the two existing records.
- Opened and closed its long context using Enter on the native disclosure. Inspected the expanded
  text and visible focus indicator at 1280×900 and 390×844 in dark mode.
- Integration coverage authored for atomic rollback, idempotency, filtering, stable cursors and
  same-time ordering; unit coverage for permissions and São Paulo date boundaries.

No local lint, tests, typecheck or build were run, as requested. Commit hooks format and check
whitespace. Browser evidence does not claim that every producer mutation was exercised end to end.
