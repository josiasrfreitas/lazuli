# Schedule calendar

`ScheduleCalendar` from `@lazuli/ui` provides daily and weekly time grids, navigation,
overlap layout, event expansion, selection, and loading/error/empty states. See
**Components/ScheduleCalendar** in Storybook. `ScheduleCalendarDatePicker` is available separately
for existing toolbars. The class-records Agenda uses the same component with its domain cards.

## Responsibility boundary

| Consumer supplies                                  | Calendar renders or manages                                                    |
| -------------------------------------------------- | ------------------------------------------------------------------------------ |
| Controlled `date`, `view`, and their callbacks     | Date picker, today/previous/next actions, day/week switch                      |
| Events for the visible date range                  | Time axis, current-time marker, event geometry and overlap lanes               |
| Event title, supplementary text and semantic tone  | Default accessible event button                                                |
| Optional `renderEvent(event, context)`             | Available card area and expansion/selection context                            |
| `onEventActivate`                                  | Pointer and keyboard activation for the default card                           |
| Loading/error status and retry callback            | Stable grid skeleton or recoverable error state                                |
| Blocked intervals and a synchronous selection rule | Unavailable periods, selected range, validation feedback                       |
| `rangeSelection.onSelect`                          | Selection intent from pointer or built-in keyboard-accessible date/time fields |
| Optional filter and action nodes                   | Toolbar placement                                                              |
| Persistence, permissions, queries, conflict checks | No requests, routing, mutations, teacher/student knowledge                     |

Events are values, not API models. Adapt domain entities at the feature boundary. Extra fields on
an event are preserved and retain their inferred type in callbacks/renderers; putting a `lesson`
field on an event is fine. UI code never imports application or database types.

## Minimal contract

```tsx
import { ScheduleCalendar, type CalendarEvent, type CalendarView } from "@lazuli/ui";

const events: CalendarEvent[] = [
  {
    id: "meeting-1",
    date: "2026-10-19",
    startTime: "09:00",
    endTime: "10:30",
    title: "Reunião pedagógica",
    subtitle: "Equipe de professores",
    tone: "info",
  },
];

// date/view are state in the consuming screen; use URL state where appropriate.
<ScheduleCalendar
  date={date}
  view={view}
  events={events}
  onDateChange={setDate}
  onViewChange={setView}
  onEventActivate={(event) => openDetails(event.id)}
/>;
```

Give the component a bounded-height parent (for example `h-[38rem]`). The calendar fills that
space and scrolls its time grid internally, including short landscape viewports. Neither the
root nor the time viewport enforces a minimum height beyond its parent's available space.
`density="compact"` is intended for dialogs;
`comfortable` preserves the spacious Agenda layout. Week view keeps readable columns and scrolls
horizontally on narrow screens; day view remains available through the same controlled API.

The weekly grid starts on Monday by default. Set `dayCount` to anchor a consecutive batch at
`date` instead. Changing the date emits `onDateChange`; clicking a day heading also requests
`onViewChange("day")`. Fetch the range returned by `getScheduleCalendarRange` in the consumer.
Only events in that period are placed. IDs must be stable and unique in the event collection.

## Consecutive date batches and bounds

`view="week"` accepts `dayCount`: any positive integer, starting exactly at `date`. Seven days
starting on Tuesday display Tuesday–Monday; starting on Wednesday displays Wednesday–Tuesday.
Three or ten days use the same grid. Omit `dayCount` for the existing Monday–Sunday behavior.
`view="day"` always displays one day.

`minDate` and `maxDate` are inclusive limits on display, navigation and interval selection.
The calendar clamps an out-of-bounds controlled `date` for rendering without emitting a callback.
Batches are clipped at the limits, so the last batch can be shorter. Setting both bounds to the
same date restricts the entire calendar to that day. Invalid dates, reversed bounds and invalid
`dayCount` values are configuration errors and throw `RangeError`.

```tsx
import { ScheduleCalendar, getScheduleCalendarRange } from "@lazuli/ui";

const window = { date, view, dayCount: 7, minDate: today };
const { from, through } = getScheduleCalendarRange(window);
// Fetch commitments for the inclusive from–through range, even across calendar weeks.
<ScheduleCalendar {...window} events={events} onDateChange={setDate} onViewChange={setView} />;
```

Previous/next move by the configured batch size (or one day in day view), with unavailable
moves disabled. “Hoje” and the month picker also honor both limits. For `toolbar={false}`, use
`getScheduleCalendarNavigation(window, today)`: `previousDate`, `nextDate` and `todayDate` are
navigation targets, or `null` when unavailable. Pass the same bounds to
`ScheduleCalendarDatePicker`, which also supports `maxDate`.

`rangeSelection.minimum` continues to restrict time slots, including the elapsed part of today;
use `minDate` to hide earlier dates. Keep the calendar anchor separate from a selected event's
date if clicking an event should leave the displayed batch in place.

Appointment scheduling uses seven-day batches with `minDate=today`. Its availability query sends
`week=from` and `through` for the exact displayed range (one to seven days). Existing callers
that omit `through` keep the Monday–Sunday interpretation of `week`.

## Dates and intervals

- `date` is a valid Gregorian `YYYY-MM-DD` civil date.
- Times are `HH:mm`, within one civil day, with start strictly before end. End may be `24:00`.
- Intervals are half-open: 09:00–10:00 does not conflict with 10:00–11:00.
- `timeZone` defaults to `America/Sao_Paulo`. It controls “today” and the clock marker. Input
  civil dates/times already belong to that zone and are never parsed as UTC instants.
- Overnight and multi-day events must be split into daily intervals by the consumer.
- The default display includes 08:00–20:00 and extends to supplied events outside those hours.
  Set `hours={{ start, end }}` for an explicit display window. This is presentation, not availability.
- The component supports day and week views. It does not imply monthly layout or recurrence rules.

## Selection is not availability

An event's `disabled` flag prevents activation; `disabledReason` explains why in its accessible
label. It does not decide whether a new interval can be created at that time.

`rangeSelection` explicitly enables interval creation:

```tsx
rangeSelection={{
  value: selectedRange,
  onSelect: setSelectedRange,
  minimum: { date: today, time: currentTime },
  blocked: commitments.map((item) => ({
    id: item.id,
    date: item.date,
    startTime: item.startTime,
    endTime: item.endTime,
    label: "Professor ocupado",
  })),
  getError: (range) => validateStudentAndSchoolAvailability(range),
}}
```

`blocked` must contain all relevant commitments, even ones omitted by display filters. This keeps
a filtered grid from falsely advertising availability. `getError` returns an actionable message
or `undefined`/`null`; it must be synchronous and pure. Return an error when availability for the
requested date has not been loaded. While status is loading/error, event and interval selection
are disabled. Do not render stale data as a freshly available week.

Selection calls do not create or move events. The consumer owns the selected value and must
revalidate authoritatively when saving, including concurrent changes and the current time.
Changing filters/resources should clear or revalidate the controlled selection in the consumer.

The built-in date/time fields provide a keyboard alternative to pointer selection. Supply
`rangeSelection.controls` to reuse an existing form; that replacement must preserve a keyboard
path and render validation feedback. These controls do not introduce a nested HTML form.

## Custom event content

`renderEvent` replaces the entire card, not just its text. This permits multiple actions without
nested buttons. Its context contains `view`, `expanded`, `selected`, `disabled`, `activate`, and
`toggleExpanded`. The consumer owns button labels, keyboard operation and disabled semantics.
Use `activate` for the default event action. `onEventActivate` receives the original typed event.

Weekly pointer expansion uses the cards' current rendered bounds, including during transitions;
the browser's actual hit target resolves overlapping animated rectangles. It does not extrapolate
invisible lanes from the grid's earlier width. Pointer movement while a mouse button is held does
not retarget expansion, so pressing a card does not select a neighboring one. Focus moving between
cards in the same overlap group keeps it open, including when clicking a revealed overflow card.

The layout continues to own size, positioning, overlap expansion and overflow. Weekly overlaps
show four events plus a `+Mais` control. Clicking it expands the day and reveals every event in
that overlap group, including the four already visible, in equal lanes with original durations.
The revealed group stays open throughout the day's vertical strip, including gaps and other time
blocks. Leaving the day horizontally or exiting the calendar closes it after a 255ms grace period;
pointer activation preserves the opening and closing transition without moving keyboard focus. Hover and focus expansion apply only to the weekly view and only when the resting card's
content is clipped or hidden by density rules. A card that already shows everything keeps its
width. Vertical gaps within the open day do not dismiss expansion; its expanded size is never used to
collapse it. Custom renderers mark meaningful text hidden by container queries with
`data-calendar-detail`, so the shared calendar can detect that missing content. Explicit guest
panels and overflow controls keep their own activation behavior. Daily mode displays every
overlap in a fixed-width lane: hovering, focusing, or opening event details never redistributes
its horizontal space. Custom daily cards can still use `toggleExpanded` for explicit detail
buttons. `expandedEventId` and `keepExpanded` allow detail dialogs or linked-event panels to
preserve that content state.

`expandedEventWidth` sets a preferred width in pixels for the expanded card in week view
(for example `expandedEventWidth={360}`). The calendar widens the day and accounts for overlapping
lanes, bounded by the available grid width while retaining space for neighboring days. It does not
change event height or duration. The pixel target is converted to a flex share using the grid's
available width, so opening, closing, and switching days retain the existing expansion transition.
Omit it to retain the default proportional expansion.

`widthBehavior="fit"` keeps the time axis, all visible dates and concurrent lanes within the
container width, without the default per-day or per-lane minimum widths. Combine it with
`density="compact"` for personal agendas and `expandEvents={false}` when lanes should stay
stable. Custom event content must adapt to narrow cells and retain complete accessible labels;
weekly headings still open a date in day view. The default `"scroll"` preserves readable minimum
lane widths for dense administrative calendars. See the `Fitted` Storybook example.

The Agenda's custom weekly card may reveal overflowing text in a taller overlay when individually
expanded. The event wrapper retains its original time position and duration; the overlay grows only
to fit the content. This does not apply to daily cards, selection dialogs, or groups revealed by
`+Mais`. Resting cards that already fit still do not expand.
Custom renderers receive `expandedDayWidth` and `expandedWidthShare` only for individually
expanded weekly events. These describe the destination geometry before the horizontal transition.
The Agenda measures its content once at that destination width, then transitions the content
surface's height with the same calendar duration and easing. It retains that text layout during
closing, so changing width does not repeatedly wrap the text. Keyboard expansion and reduced
motion continue to bypass the spatial transition.

Card content adapts to its own width and height using container queries. The default renderer
uses two columns in wide cards and one line for wide, short events, keeping subtitle and
description visible when they fit. Custom renderers can query the named `calendar-event` size
container or establish their own inner size container. Reveal supporting information as space
permits; do not require `expanded` just to show details that already fit. Temporal height and
overlap lanes remain unchanged.

## States and integration

- `status="loading"`: keeps the empty grid, weekday headings and time axis visible, with a centered
  `PencilLoader`; hides stale events and prevents selection. The indicator stays centered in the
  visible viewport even when the calendar scrolls horizontally.
- `status="error"`: displays `errorMessage` and `onRetry` when supplied; prevents selection.
- Empty ready state: preserves the grid, so users can create a new interval. `emptyMessage`
  customizes the explanatory sentence.
- `toolbar={false}`: use an existing application toolbar without duplicating navigation.
- `filters` and `actions`: optional toolbar content, with application-controlled behavior.
- `selectedEventId`: visual selection by stable event identity, independent of segmented layout.

Import the normal `@lazuli/ui/styles.css` stylesheet. Consumers never import react-big-calendar
or use its event/slot types; that dependency and its geometry remain implementation details.

Personal read-only agendas can set `scrollChaining` to let vertical gestures continue into the page at the grid limits. The default retains containment for dialogs. Set `emptyDisplay="message"` to retain navigation but omit an empty time grid (ignored with range selection). Use `hours` based on the visible events to trim unused hours at either edge of the day.
