# Daily calendar direction workshop

Status: **Grade por professor selected by the user on 2026-10-13.** Selection message: “grade por professor. Registra isso vou construir com o contexto limpo. Aponta direcao do workshop no $handoff”. Desktop only. The previous compact weekly design was rejected; its SHIP review is not design approval.

Task: compare 4–6 simultaneous one-hour lessons with stage identity always understandable; move among days; inspect and open the intended lesson. Data shown in sketches is synthetic.

Grounded candidates ranked before presentation: (1) teacher lanes, (2) expanded selected day within week, (3) stage-family lanes, (4) agenda with fixed detail pane, (5) full-width hourly bands, (6) selected-hour comparison with day navigator, (7) compact week plus daily drawer. User day-first steering is applied to all candidates. Surface seed f12a5030 dealt 4, 5, 1; existing visual identity retained.

Compare the same 14:00–15:00 six-lesson scenario in each sketch. The sketches explore composition and native interaction; they do not change Aulas or persist records. The teacher-grid direction is now accepted for production implementation; the other two remain unselected alternatives.

## Selected direction

- Visual and interaction reference: [professores.html](../../../../.impeccable/mocks/decision/professores.html). Open this file in a browser before implementing. Live preview, while the local workshop server runs: http://127.0.0.1:49441/sketch/2?raw=1.
- Daily calendar with a time axis and stable teacher columns. Show 4–6 simultaneous one-hour lessons with stages readable directly in the grid, without expanding a group first.
- Keep a compact week/day navigator. Selecting a lesson preserves its peers and reveals a horizontal detail inspector below the grid; the production action opens that actual lesson.
- Preserve Lazuli's existing visual system and the selected sketch's composition. The earlier weekly stacked-block/popover composition is superseded.
- The sketch is synthetic and deliberately limited: native HTML/CSS interactions, sample empty days, six teachers, and a simulated clock marker. Production must use actual data, real date navigation and lesson links; do not copy illustrative states as business rules. Desktop is the explicit scope. Decide overflow for more teachers from real data without reopening the chosen direction.

## Workshop evidence

All three full-size HTML sketches were viewed at 1440×900. All six simultaneous lesson selections displayed exactly one matching detail region in each proposal. At 1280px, the document width matched the viewport and measured lesson/detail containers had no horizontal content overflow. Agenda uses a fixed right panel; bands expand inline; teacher lanes use a bottom inspector. Native keyboard controls are present; Orca's key injection did not change the focused radio, so keyboard behavior is not claimed verified. Week navigation shows the populated Tuesday scenario and explicitly empty illustrative samples for other days. These are local composition sketches, not integrated product routes or persisted data. No production code changed in this workshop turn; no application test-suite run was warranted.

## Production implementation — 2026-10-13

The daily teacher grid now replaces the weekly blocks in `/aulas`. Teacher IDs come from the existing responsible-teacher projection; week-wide columns retain their order across days. Simultaneous sessions remain individually selectable, including overlaps under one teacher. Stored start/end times determine geometry unchanged. The bottom inspector opens the selected session; pointer selection uses the existing 180ms motion token, keyboard selection is immediate, and reduced motion removes the transition.

Browser evidence: the real page at 1440×900 shows seven teacher columns, readable stages and the bottom inspector. Day navigation, the empty Saturday, keyboard ArrowRight selection and opening the matching actual session were exercised. At 390px the document remains 390px wide; the grid owns horizontal scrolling. Desktop screenshot: `teacher-grid-desktop.png`. No new synthetic six-session fixture or full accessibility audit was run.

The user explicitly asked to focus on the feature and defer checks and static tests. No lint, typecheck or automated tests were run for this implementation. The previous untracked calendar unit tests still describe the superseded grouping model and need adaptation in the deferred testing pass. Existing FullCalendar dependency and shared Popover edits remain untouched; this grid no longer consumes either the calendar dependency or the previous lesson-popover expansion.

Numeric positioning is emitted in a scoped stylesheet; all visual styling stays in the local CSS module and consumes existing semantic tokens. No global design-system changes or data migrations were made.
