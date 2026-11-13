# Academic calendar refactor — 2026-11-13

## Request and scope

The user rejected the calendar's visual and interaction quality and explicitly included the
entire academic calendar module: annual, monthly, daily, transitions, loading, hover, creation,
editing, period boundaries, holidays/recesses, and impacts on teaching. The purpose is to explain
academic events and their consequences for classes. The established Lazuli visual system remains.

Before this refactor, month cells were not actionable and the existing AcademicDayAgenda had
no reachable entry in the rendered calendar. Initial and year loading replaced the whole screen
with a spinner. The month name was repeated and most monthly cells had no usable information
or action.

## Composition decision

The user selected year-with-context at the Impeccable decision page (key 4088c51a) and in chat.
Surface seed 7867e447 offered month-first, year-with-context, and semester-sequence.
The selected HTML sketch is a composition reference; its sample dates are illustrative.

Follow-up decisions: remove Ano/Mês tabs, enter a month by clicking its heading, put year/month
navigation in the center of the title row, lift the calendar and context panel, put return
navigation in the breadcrumb with the current month/day, and preserve the app background gradient.
The user withdrew the request for an additional month hover animation.

The subsequent accepted refinement replaces civil-year navigation with the chronological
sequence of actual academic periods, such as 2026.1 → 2026.2. Periods may start and end on
configured dates and cross a year boundary. The user chose to keep twelve reference months,
with months and partial-month days outside the selected period dimmed.

Vacation context is an explicit exception to that dimming: earlier vacations remain visible
and dimmed with a label; subsequent vacations remain fully visible for every selected period.
The overview adds an adjacent boundary month if needed to show those vacations. The twelve
reference months remain, so a July–December 2026 period also shows January 2027. Cross-year
periods use a continuous month window. A period touching thirteen months retains all its days.
The context shows adjacent vacation ranges. An absent neighboring period leaves that boundary
open and visibly undefined; the UI does not invent a return date. This is a presentation rule
around an existing selected period, not a change to persisted scheduling rules.

## Scenarios to validate in the chosen composition

- A national or local holiday: explicitly shows no academic activities; date opens context.
- A multi-day recess crossing months: one named interval, visible in both months.
- A cultural event: date and time, without implying that lessons are suspended.
- A semester start/end: explicit boundaries and access to the same configured Period.
- A gap between two known semesters: academic vacation, distinct from unconfigured dates.
- No registered periods: unknown coverage, never fabricated semester or vacation dates.
- A semester starting in February: January and early February dates remain dimmed and usable.
- Vacations after a December ending: the following January remains visible and fully legible.
- Missing adjacent period: vacation context states the open boundary rather than a return date.
- Overlapping holiday, semester boundary and event: every meaning remains discoverable.
- A calendar change: review affected/preserved activities and planning capacity before applying.
- Failed loading/saving: local retry and preserved context/draft.
- Period/month edge navigation and browser Back: date and scope stay consistent.

## Constraints

Keep school-wide suspension, existing preview/confirmation, worker reconciliation, authorization,
and São Paulo business time. No changes to commercial dates or class continuity. Use Orca's
embedded browser at http://lazuli.lazuli.localhost and the existing running development server.
Other uncommitted workspace changes are outside this task.

## Visual evidence and limits

Orca browser inspection covered annual/month/day navigation, December–January and browser Back,
inline event creation/reopening/removal, keyboard focus and Escape, semester settings, holiday
import, interruption preview, both themes, and widths 1440, 1026 and 390. The temporary visual
event was removed. A 16–17 November recess preview showed 16 affected future activities; no
calendar change was confirmed. Year navigation invoked a 220 ms directional transition and
returning from a month restored the saved annual scroll position.

After the user's period/vacation refinements and development-server restart, fresh Orca
captures cover overview, January 2027, a selected vacation day, daily agenda and return through
both breadcrumb levels. The period ID and loaded page remain intact on return from the next
year. Earlier vacation days render at .45 opacity; subsequent vacation days at full opacity.
Widths 1440, 1026 and 390 showed no horizontal document overflow. A temporary light CSS
preview was captured and restored to the current app's dark theme; no theme setting or global
theme implementation was changed by this work.

The actual local data contains only 2026.2 (July 1–December 31), so both period arrows are
intentionally disabled. An earlier browser-only illustrative preview exercised February starts,
2028.1 → 2028.2 and a 2029–2030 period; it intercepted read responses and made no database
changes. That preview predates the final vacation refinements and is not evidence of those
new states. Final period/vacation evidence is the current 2026.2 data and named captures.

The independent review requested two corrections: holiday tooltip impact copy takes precedence
over vacation copy, and selected-day/daily context keeps compact adjacent vacation ranges with
undefined-neighbor information. Both were applied together. Fresh selected-day, daily and mobile
captures show those ranges. The holiday copy correction is source evidence; the attempted Orca
hover capture did not expose a tooltip and is not claimed as runtime validation of that text.

Final captures are in `.impeccable/review/academic-calendar/`. The user explicitly requested
visual-only validation: no lint, static checks, build or test suites are part of the final pass.
Four date-model unit cases passed before that instruction; an earlier typecheck did not complete
successfully and was not resumed. Backend reconciliation was preserved, not revalidated here.
