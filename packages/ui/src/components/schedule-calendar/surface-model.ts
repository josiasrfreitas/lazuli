import { useMemo } from "react";
import { calendarDateError, getScheduleCalendarRange } from "./date-window";
import type { CalendarGridProps } from "./grid";
import { calendarDateKey, calendarWallDate, clockTime, selectionError, zonedNow } from "./model";
import { dailyBlocks, weeklyBlocks, type WeeklyBlock } from "./weekly-blocks";
import { useWeeklyExpansion } from "./use-weekly-expansion";
import { useWeeklyHover } from "./use-weekly-hover";
import { weeklyDayLayout } from "./weekly-layout";
import type { CalendarInterval, ScheduleCalendarProps } from "./types";

export type SurfaceProps = ScheduleCalendarProps & {
  onSelectRange: (range: CalendarInterval) => void;
  onRejected: (message: string) => void;
};
export type SurfaceLayout = ReturnType<typeof useWeeklyExpansion> & {
  activeId: string | null;
  hover: ReturnType<typeof useWeeklyHover>;
};
export function useCalendarSurface(props: SurfaceProps): SurfaceLayout {
  const { view, date, events } = props;
  const { from, through } = getScheduleCalendarRange(props);
  const blocks = useMemo(
    () =>
      view === "week"
        ? weeklyBlocks([...events], { date, range: { from, through } })
        : dailyBlocks([...events], date),
    [view, events, date, from, through],
  );
  const expansion = useWeeklyExpansion(blocks);
  const activeId =
    expansion.displayed.find((block) =>
      block.lessons.some((event) => event.id === props.expandedEventId),
    )?.id ?? expansion.expandedId;
  const hover = useWeeklyHover({
    expand: expansion.expand,
    keepExpanded: Boolean(
      view === "day" ||
      props.keepExpanded ||
      props.rangeSelection ||
      props.expandEvents === false ||
      (props.status && props.status !== "ready"),
    ),
  });
  return { ...expansion, activeId, hover };
}
function backgroundBlock(range: CalendarInterval & { id: string; label: string }): WeeklyBlock {
  return {
    ...range,
    title: range.label,
    groupId: range.id,
    kind: "lesson",
    start: calendarWallDate(range.date, range.startTime),
    end: calendarWallDate(range.date, range.endTime),
    lane: 0,
    columns: 1,
    lessons: [],
  };
}
function backgroundEvents(props: SurfaceProps): WeeklyBlock[] {
  if (props.status && props.status !== "ready") return [];
  const selected = props.rangeSelection?.value;
  const events = (props.rangeSelection?.blocked ?? []).map((range) => backgroundBlock(range));
  if (selected)
    events.push(
      backgroundBlock({
        ...selected,
        id: "calendar-selected-range",
        label: `Horário selecionado · ${selected.startTime}–${selected.endTime}`,
      }),
    );
  return events;
}
function toRange(start: Date, end: Date): CalendarInterval {
  return { date: calendarDateKey(start), startTime: clockTime(start), endTime: clockTime(end) };
}
function slotError(
  props: SurfaceProps,
  { start, end }: { start: Date; end: Date },
): string | undefined {
  if (calendarDateKey(start) !== calendarDateKey(end))
    return "Escolha um intervalo dentro do mesmo dia.";
  return props.rangeSelection
    ? selectionError(toRange(start, end), props.rangeSelection)
    : undefined;
}
function blockClass(event: WeeklyBlock, activeId: string | null): string {
  if (event.id === "calendar-selected-range") return "lz-calendar-selected-range";
  if (event.lessons.length === 0) return "lz-calendar-blocked-range";
  return event.id === activeId ? "lz-calendar-expanded-block" : "lz-calendar-block";
}
export function gridBehavior(
  props: SurfaceProps,
  layout: SurfaceLayout,
): Partial<CalendarGridProps<WeeklyBlock>> {
  const ready = !props.status || props.status === "ready";
  const minimum = props.rangeSelection?.minimum;
  const activeDay =
    props.view === "week"
      ? layout.displayed.find((block) => block.id === layout.activeId)?.date
      : undefined;
  return {
    backgroundEvents: backgroundEvents(props),
    dayLayoutAlgorithm: weeklyDayLayout(props.view === "week" ? layout.activeId : null),
    selectable: props.rangeSelection && ready ? "ignoreEvents" : false,
    onSelecting: ({ start, end }) => !slotError(props, { start, end }),
    onSelectSlot: ({ start, end, action }) => {
      const duration = props.rangeSelection?.clickDurationMinutes;
      if (action !== "select" && duration && Number.isFinite(duration) && duration > 0) {
        end = new Date(start);
        end.setMinutes(end.getMinutes() + duration);
      }
      if (!props.rangeSelection || !ready) return;
      const error = slotError(props, { start, end });
      if (error) props.onRejected(error);
      else props.onSelectRange(toRange(start, end));
    },
    slotPropGetter: (slot) => ({
      className:
        minimum && slot < calendarWallDate(minimum.date, minimum.time)
          ? "lz-calendar-unavailable"
          : "",
    }),
    dayPropGetter: (day) => ({
      className: calendarDateKey(day) === activeDay ? "lz-calendar-expanded-day" : "",
    }),
    eventPropGetter: (event) => ({ className: blockClass(event, layout.activeId) }),
    getDrilldownView: (day) =>
      calendarDateError(calendarDateKey(day), props) ||
      (minimum && calendarDateKey(day) < minimum.date)
        ? null
        : "day",
    onDrillDown: (day) => {
      props.onDateChange(calendarDateKey(day));
      props.onViewChange("day");
    },
    onNavigate: (day) => props.onDateChange(calendarDateKey(day)),
  };
}
export function gridTimes(props: SurfaceProps): Partial<CalendarGridProps<WeeklyBlock>> {
  const times = [
    "08:00",
    "20:00",
    ...props.events.flatMap((event) => [event.startTime, event.endTime]),
  ].toSorted();
  const bounds = props.hours ?? { start: times[0]!, end: times.at(-1)! };
  return {
    date: calendarWallDate(props.date),
    min: calendarWallDate(props.date, bounds.start),
    max: calendarWallDate(props.date, bounds.end === "24:00" ? "23:59" : bounds.end),
    scrollToTime: calendarWallDate(props.date, bounds.start),
    getNow: () => zonedNow(props.timeZone ?? "America/Sao_Paulo"),
  };
}
