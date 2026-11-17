# Planning flexibility outcome

Implemented as an extension of Lazuli's existing operational interface for the requested slice of
issues #275 and #278. This record does not close either issue or establish a new design system.

## Implemented experience

- The planning tab uses its existing availability and content cards. “Ajustar aulas” opens the two
  adjustment flows, with a recommendation based on known deficit or spare capacity. The duplicate
  planning banner is removed; content labels are “Último conteúdo trabalhado” and “Próximo”.
- Recurring collective lessons accept dates, weekdays, times and professor. The desktop form places
  a live capacity comparison beside the fields. Narrow layouts stack the details and keep a compact
  balance above the persistent actions. Loading, conflicts and uncertain content have explicit states.
- Existing encounters in the selected interval mark their weekdays and expose their actual hours.
  Opening the form refreshes the planning data; missing time values produce a loading message.
  The form explains that different weekday hours can be saved separately and accumulated.
- The final review identifies skipped closures and requires confirmation for dates outside the
  academic period. Subsequent adjustments preserve earlier encounters and add their capacity.
- Early ending previews future cancellations and requires the complete written confirmation.
  Recorded evidence is preserved. Start changes remain restricted to future starts.
- The program explorer presents units, completed work, partial work and projected dates. Pending
  content is projected against the available encounters; specific session assignments distinguish
  multiple lessons on one date. Existing records and earlier revisions remain available.

The implementation reuses shared dialogs, controls, badges and semantic colors. Body and caption
type, tabular hour values, divider-based grouping and restrained progress motion remain local
applications of the incumbent system. No global DESIGN.md or sidecar was changed.

## Validation evidence

The parent agent performed the following runtime validation; this documenter inspected the source
and recorded that evidence without rerunning browser actions or checks:

- Orca desktop and mobile captures are stored in
  `apps/web/.impeccable/review/planning-flexibility/`. The latest `current-schedule-desktop.png` and
  `current-schedule-mobile.png` show existing hours and the persistent narrow-screen balance.
- A browser save for Tuesday/Thursday/Friday, 06:00–08:00, from 18 November to 14 December 2026
  created ten encounters totaling twenty hours. It skipped the existing 20 November holiday and
  required confirmation for six encounters outside the period. The agenda showed the added lessons.
- The 19 November encounter snapshots contained four roster entries each and distinct planned
  content for the early extra encounter and the regular noon encounter.
- Separate browser saves added Tuesday 08:00–09:00 and Wednesday 09:00–10:00. All three series
  remained present: thirteen encounters in total, with cumulative capacity and updated projection.
- A browser-authenticated request to change the already-started demo's initial date returned HTTP
  400 with the future-start restriction. No revision was created by that rejected request.
- An earlier browser confirmation cancelled three future encounters in the ahead-of-plan demo,
  preserved its thirty-six recorded lessons, and produced an attributed audit event.
- Calendar reconciliation executed inside a database transaction that was rolled back: shortening
  the semester cancelled the ordinary 26 November encounter while preserving explicit extras;
  a 1 December closure cancelled the unrecorded extra encounter and removed that date from live
  projection; a historical 12 November closure preserved the lesson and all thirty-six records.
  Subsequent calendar generation did not reopen encounters cancelled through early ending.
- Rollback restored the calendar and session statuses. The thirteen browser-created demo encounters
  were subsequently soft-deleted with an attributed restoration revision; the original deficit
  scenario was restored without deleting its history.

## Limits

Calendar worker behavior was exercised directly in a rollback transaction, without dispatching an
external queue job. Full lint, typecheck, build, test-runner and detector passes were not run by the
implementing agent at the user's request; delivery-gate or CI validation remains deferred. Final
visual disposition belongs to the finish reviewer and is not asserted by this document.

The parent subsequently received the finish reviewer's `ship` disposition for the compact mobile
feedback fix. The final scoped diff was inspected and `git diff --check` passed.

Pre-existing PRODUCT.md storage wording was not promoted into a design rule or repaired: this
ordinary interface extension does not authorize changes to durable infrastructure documentation.
