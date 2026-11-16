# Academic calendar outcome — 2026-11-13

The calendar retains the selected multi-month composition and context panel within Lazuli's
existing visual system, refined to navigate actual academic periods and their adjacent vacations.
The fresh full period review requested two corrections. The final verdict pass scored both
**resolved** and returned **ship**; this is approval of those corrections, not a new whole-surface
review. [REVIEW.md](REVIEW.md) records that scope and supersedes the initial annual-view verdict.

## Accepted surface decisions

- Overview navigation follows registered academic periods chronologically, such as 2026.1 →
  2026.2, with their actual dates, including periods crossing a year boundary. It does not
  navigate fixed semester groups or civil years.
- Twelve reference months remain visible. Months and partial-month dates outside the selected
  period are dimmed. Earlier vacations are dimmed and labeled; subsequent vacations remain
  fully visible. A boundary month is added when needed: July–December 2026 also shows January 2027. Cross-year periods use a continuous month window, retaining all days even when a period
  touches thirteen months.
- Both adjacent vacation ranges remain available in overview, month, selected-day and daily
  context. A missing neighboring period is explicitly undefined, leaving that boundary open
  without inventing a return date. These ranges present context around existing records;
  persisted periods and underlying scheduling rules are unchanged.
- Period/month navigation is centered in the title row. There is no Ano/Mês selector or
  separate toolbar. Clicking a month heading opens it. The breadcrumb displays the current
  month/day and owns return navigation, preserving the selected period across the year boundary
  without reloading the page. Returning to the overview restores its saved scroll position.
- The context panel supports period ranges, upcoming dates, selected-day details and inline
  event creation/editing. It follows the calendar at narrow widths and is brought into view
  when a date or creation action is selected.
- Events explicitly preserve lessons; holidays and recesses explicitly suspend academic
  activities. Holiday tooltip impact copy takes precedence over vacation copy. Semester settings
  and interruption changes retain the existing impact preview and confirmation flow. An absence
  of registered periods remains unknown coverage; no period records are fabricated.
- The app background gradient remains visible. The additional month-hover animation request
  was withdrawn; no further hover treatment is owed by that request.

## Continuity with the incumbent system

The comparison used `docs/frontend/README.md`, `semantic-colors.md` and `forms.md`, alongside
`workspace.tsx`, `workspace.module.css`, `event-form.tsx`, `management.tsx`,
`use-calendar-motion.ts` and the calendar branch in `app-breadcrumb.tsx`.
The final refinement also sampled `period-model.ts`, `use-period-data.ts`, `navigation.ts`,
`month-grid.tsx` and `context-panel.tsx`; it extends date context and presentation without adding
global design tokens.

| System evidence                      | Finished surface                                                                                                                                                                                                                                                                          |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Semantic surfaces and hierarchy      | Calendar and context use `card`, `border`, `border-subtle`, `heading`, `foreground` and `muted-foreground`; the page does not replace the app background.                                                                                                                                 |
| Semantic color meanings              | `accent`/`interactive` identify period boundaries and selection; `info` identifies events; `warning`/`warning-muted` identify suspended activities; `brand` marks today. Labels, borders and marker shapes supplement color.                                                              |
| Typography and shapes                | Headings and supporting text use the existing `--lz-text-*` roles, dates use `--lz-font-numeric`, and surfaces use `--lz-radius-*`. No new typeface or global scale was introduced.                                                                                                       |
| Shared controls and action hierarchy | Workspace and management use `@lazuli/ui` controls. `Novo evento` is primary, contextual controls are lower emphasis, and removal enters through `destructive-ghost` before a filled destructive confirmation. The editor retains the existing event fields and task-form infrastructure. |
| Interaction continuity               | The inline editor focuses its title, preserves a failed draft, and guards pending mutations. Directional navigation uses a 220 ms transition; the motion hook uses a 100 ms opacity transition without translation for reduced-motion preferences.                                        |

This is an ordinary extension of the incumbent system. Global token files, `DESIGN.md`,
`.impeccable/design.json` and `PRODUCT.md` were preserved. Surface composition and navigation
decisions remain in the calendar brief rather than becoming whole-product rules. No raster
assets ship; the captures are review evidence only.

## Evidence and limits

The runtime observations and earlier validation history are recorded in [SCOPE.md](SCOPE.md).
Final Orca evidence uses the actual sole period, 2026.2 (July 1–December 31), so both period
arrows are intentionally disabled. It covers the overview, January 2027, a selected vacation
day, daily agenda and both breadcrumb returns with the selected period preserved. Widths 1440,
1026 and 390 had no horizontal document overflow. Earlier vacation days appeared at .45 opacity
and subsequent vacation days at full opacity. A temporary light CSS preview was restored to
the app's dark theme; it did not change theme settings or the global implementation.

Current captures in `.impeccable/review/academic-calendar/` were recaptured after the correction
batch and opened:

| Evidence                           | Capture                                                                                                                                    |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Overview                           | `desktop.png` (1440×1000), `year-full.png` (1440×1900), `user-1026.png` (1026×812), `mobile.png` (390×844), `vacations-context-mobile.png` |
| January 2027                       | `month-desktop.png`, `month-mobile-light.png` (temporary light CSS preview)                                                                |
| January 5 context and daily agenda | `vacations-after-day.png`, `daily-desktop.png`, `vacations-selected-mobile.png` (390 px selected context)                                  |

`editor-mobile.png`, `settings-desktop.png` and `impact-mobile.png` retain older provenance for
unchanged flows. The earlier event exercise removed its temporary event; the 16–17 November
recess preview showed 16 affected future activities without confirming a calendar change.
An earlier browser-only illustrative preview exercised February starts, 2028.1 → 2028.2 and
a 2029–2030 period without database writes. It predates the final vacation refinements and
does not validate those final states. The holiday tooltip correction is supported by source;
its rendered text was not captured. The documenter used source and recorded evidence without
starting another browser or validation pass.

The user requested visual-only validation. No lint, static checks, build, test suites or
detectors were run for the final pass. Four date-model unit cases had passed before
that instruction; an earlier typecheck did not complete successfully and was not resumed.
Backend reconciliation was preserved and was not revalidated. The visual disposition does
not establish those deferred checks as passing.

## Existing drift left unchanged

`PRODUCT.md` still describes student PII as residing in Cloud SQL, whereas the current repository
guide specifies PostgreSQL and the AWS managed-infrastructure direction. This unrelated product
context was left untouched; the calendar documentation does not adopt it as an infrastructure
decision.
