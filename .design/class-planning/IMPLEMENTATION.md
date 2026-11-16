# Semester-first class planning

## Accepted scope

The user confirmed the primary question: can the class finish its curriculum before
the semester ends, and what needs adjusting? Past, current and next content are
secondary. The accepted composition is recorded in `REDESIGN-BRIEF.md`.

The earlier numbered map, expandable encounter list and duplicate recorded-lessons
tab were rejected. Their earlier finish verdict does not apply to this replacement.

## Implemented behavior

- The main conclusion compares nominal remaining curriculum minutes with eligible
  future lesson minutes through the academic semester ending. It distinguishes
  margin, no margin, shortfall, completion, partial work and insufficient evidence.
- Calendar capacity excludes cancelled sessions and school closures. An ongoing
  session contributes only its remaining time. The semester owns the ending; the
  start is the editable date. This is a nominal-load comparison, not a prediction
  of teacher speed.
- Individual activities require explicit completion evidence. One lesson record
  can contain several activities, each partial or completed. Legacy single-activity
  records remain readable, and an explicit empty selection clears their coverage.
  Missing earlier evidence never implies completion. Partial work retains its full
  nominal duration as a conservative bound.
- A compact past/current/next region uses canonical units and lesson names. Videos
  and intermediate activities identify their lesson transition without inventing
  a topic. Unknown source abbreviations remain unknown.
- The shared content dialog selects a unit and lesson, then shows only that group's
  activities, statuses, planned dates and actual record links. Full lesson history
  stays in Aulas. Escape closes the dialog and restores trigger focus.
- When initial curriculum exceeds calendar capacity, a read-only preview displays
  all content and the deficit. Unsupported activities have `plannedOn: null` and
  visibly say they lack calendar time. No plan or invented dates are persisted.
  Saving a canonical schedule still requires enough capacity.
- Historical record editing compares against the lesson's own date, displayed as
  “Previsto até dd/mm/aaaa”. Negative date distance uses warning, without an
  arbitrary destructive threshold.
- Loading follows the outlook/content composition with the existing skeleton.
  Desktop content reserves room for overlay scrollbars; narrow layouts stack, and
  the selected navigation tab is brought into view.

## Documentation assessment

The fresh documenter inspected the source and documentation and confirmed an
ordinary Operate extension of Lazuli's inherited system. Shared Button, Badge,
Dialog, Checkbox, SelectControl and InlineSkeleton remain in use. Feature CSS
consumes existing surface, border, heading, muted-text, interactive, focus-ring,
radius and typography tokens. Native meters and disclosure support comparison.
No global visual specification or token changes are warranted; the absence of a
root DESIGN.md is pre-existing and is not repaired by this task. No shipping raster
assets were introduced. The documenter performed no independent browser review.

The documenter identified stale descriptions of the rejected composition and seed;
these documents were updated by the parent using that assessment.

## Evidence and limits

- 23 distinct focused tests passed across the journey (8), outlook (5), canonical
  labels (3), scheduling (2), start form (2), capacity form (1) and occupancy (2).
- Guarded rollback checks covered duplicate coverage rejection, foreign-class link
  rejection and preservation of an originally linked retired activity. Initial
  feasibility was also exercised against the real API: 40h source, 2h available,
  38 undated activities and no persisted plan. Its temporary QA class was removed.
- Orca exercised the running app at 1440×900, 1280×720 and 390×844, including all
  three examples, content dialogs, actual record navigation, and adding, removing
  and toggling record activities before cancelling the edit. At 1280×720 the main
  planning panel measured 575px for both client and scroll height, with no
  horizontal overflow. Mobile content reflows and scrolls naturally.
- The `use client` directive in `lesson-details.tsx` is first; the real route
  compiled and loaded after the correction.
- The source detector returned no findings. The fresh finish reviewer requested
  four corrections; the final verdict scored all four resolved, disposition
  **ship**. This verdict covers those corrections, not a new whole-surface review.
  See `FINISH-REVIEW-V2.md`.
- Final diff inspection and `git diff --check` passed. Full lint, typecheck, build,
  integration and transport suites remain deferred to PR/CI under AGENTS.md.
  No additional development server was started. Concurrent worker/calendar changes
  are outside this validation.

Captures are under `.impeccable/review/planning-v2-`: `desktop.png`,
`user-1280.png`, `tight-1280.png`, `far-1280.png`, `mobile.png`,
`mobile-content.png`, `mobile-dialog.png`, `desktop-dialog.png`,
`initial-deficit.png`, `undated-content.png` and `record-date.png`.
All eleven were opened and validated by the builder and finish reviewer.
