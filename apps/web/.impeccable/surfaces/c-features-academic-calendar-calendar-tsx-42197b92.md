---
version: 1
slug: "c-features-academic-calendar-calendar-tsx-42197b92"
primary_target: "apps/web/src/features/academic-calendar/calendar.tsx"
related_targets:
  [
    "apps/web/src/features/academic-calendar/workspace.tsx",
    "apps/web/src/features/academic-calendar/management.tsx",
    "apps/web/src/features/academic-calendar/period-model.ts",
    "apps/web/src/features/academic-calendar/use-period-data.ts",
  ]
---

# Academic calendar

Mode: Operate. Primary target: apps/web/src/features/academic-calendar/calendar.tsx.
Scope: period overview/month/day navigation, adjacent vacation context, contextual creation
and editing, academic periods, interruptions, holiday import, impact review, loading and
interaction states.

The user selected “Ano e contexto” on 2026-11-13 through the decision page and chat,
then refined navigation to registered academic periods (e.g. 2026.1 → 2026.2).
The HTML sketch is .impeccable/mocks/decision/academic-year.html (code-led).
Existing period, suspension, authorization and worker rules remain authoritative.

## Direction contract

THESIS: Read actual academic periods and act on a date without losing its academic context.
The detached legend and inert month cells are replaced by contextual information.

OWN-WORLD: Existing Lazuli typography and semantic controls. Neutral work surfaces;
blue marks period boundaries and event information, amber marks suspended activities,
and gold marks today. Keep the existing app gradient visible, explicitly requested by the user.
Both themes retain explicit labels and non-color cues.

STORY: Move between registered periods, inspect a month or day, add an event inline or configure an
interruption, then review the actual consequences for classes before applying it.

FIRST VIEWPORT: Title, centered period navigation and actions share the same header row.
The user explicitly removed the Ano/Mês selector and separate toolbar to move the calendar up.
Twelve reference months occupy the main column; a narrower context panel
holds period ranges, upcoming dates, selected-day details or an inline event form.
Clicking a month opens that month in the same main area. Novo evento is primary.
The breadcrumb follows the month/day and owns the back action, preserving the selected period
across year boundaries without a page reload; no duplicated back control.
The overview selector follows actual period records in chronological order, with their configured
dates, including cross-year periods. It does not navigate fixed semester groups or civil years.
Months and partial-month days outside the selected period remain visible and dimmed.
Earlier vacations are dimmed and explicitly labeled; subsequent vacations stay fully visible
for every period. Add a boundary month when needed to show vacations across the year edge;
July–December 2026 also shows January 2027. Cross-year periods use a continuous month window,
and a period touching thirteen months retains all its days.
Overview, month, selected-day and daily context expose both adjacent vacation ranges. A missing
neighboring period leaves that side of the range open and visibly undefined; do not invent
return dates. This contextual presentation does not create period records or alter scheduling
rules. Holiday suspension copy takes precedence when a holiday also falls within vacation context.

FORM: Multi-month calendar with contextual side panel, derived from ranked candidate 1,
seed 7867e447 and the subsequent period/vacation decisions.
Selection and navigation use brief directional transitions; shell and date grids remain
available during loading. At narrow widths the panel follows the calendar and selection
brings it into view. No new dependencies or invented school dates.

FINISH: Complete with the finish review and a surface outcome comparing the implementation
with the incumbent system. Preserve global design files for this ordinary extension. No raster
assets ship.

## Validation

Orca evidence at http://lazuli.lazuli.localhost covers the current 2026.2 overview, January 2027,
selected vacation date, daily agenda and breadcrumb returns at desktop and narrow widths.
Only 2026.2 exists in the current local data, so period arrows are disabled. The earlier
illustrative preview of partial starts, sequence navigation and cross-year periods predates
the final vacation refinements. The temporary light CSS preview is recorded separately from
the current dark theme. Earlier creation/edit/removal, settings and impact captures retain
their older provenance for unchanged flows.
Existing design-system files are preserved: this is a surface redesign in the established
world, not a system replacement. No shipping raster assets are needed.

## Completion — 2026-11-13

The fresh full period review supersedes the historical annual-view ship verdict. It matched
typography, material, background, composition and navigation, accepted the required captures,
and requested two fixes: holiday tooltip impact copy and retained vacation ranges in selected-day
and daily context. Both were corrected in one batch. The final verdict pass scored both
**resolved** and returned **ship** for those two corrections, not a new whole-surface approval.
Holiday tooltip text is source-confirmed; its rendering was not captured. Refreshed desktop and
selected mobile captures confirm the retained ranges and undefined-neighbor labels.
The additional month-hover request remains withdrawn.

The source comparison, preserved semantic-system evidence, capture inventory and validation
limits are recorded in `.design/academic-calendar/refactor/OUTCOME.md`, review scope in the
adjacent `REVIEW.md`, and runtime observations in `SCOPE.md`. The user requested visual-only
validation. No automated checks ran in the final pass; the earlier unsuccessful typecheck was
not resumed, and backend reconciliation was preserved without revalidation. The global design
system and product context remain unchanged.
