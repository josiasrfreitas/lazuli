import { calendarDateKey, calendarWallDate, monday, shiftDate } from "./model";
import type { CalendarDateRange, CalendarDateWindow } from "./types";

type Bounds = Pick<CalendarDateWindow, "minDate" | "maxDate">;

function assertDate(date: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || calendarDateKey(calendarWallDate(date)) !== date)
    throw new RangeError(`Invalid calendar date: ${date}`);
}

export function clampCalendarDate(date: string, { minDate, maxDate }: Bounds): string {
  if (minDate && date < minDate) return minDate;
  if (maxDate && date > maxDate) return maxDate;
  return date;
}

/** Inclusive visible dates; use the same range when fetching calendar data. */
export function getScheduleCalendarRange(window: CalendarDateWindow): CalendarDateRange {
  const { dayCount, minDate, maxDate } = window;
  assertDate(window.date);
  if (minDate) assertDate(minDate);
  if (maxDate) assertDate(maxDate);
  if (minDate && maxDate && minDate > maxDate)
    throw new RangeError("minDate must precede maxDate");
  if (dayCount !== undefined && (!Number.isSafeInteger(dayCount) || dayCount < 1))
    throw new RangeError("dayCount must be a positive integer");
  const date = clampCalendarDate(window.date, window);
  if (window.view === "day") return { from: date, through: date };
  const start = dayCount === undefined ? monday(date) : date;
  const end = shiftDate(start, (dayCount ?? 7) - 1);
  return {
    from: minDate && start < minDate ? minDate : start,
    through: maxDate && end > maxDate ? maxDate : end,
  };
}

export function calendarRangeDates({ from, through }: CalendarDateRange): string[] {
  const dates: string[] = [];
  for (let date = from; date <= through; date = shiftDate(date, 1)) dates.push(date);
  return dates;
}

/** Navigation shared by the built-in toolbar and consumer-owned toolbars. */
export function getScheduleCalendarNavigation(window: CalendarDateWindow, today: string): {
  previousDate: string | null;
  nextDate: string | null;
  todayDate: string | null;
} {
  const range = getScheduleCalendarRange(window);
  const step = window.view === "day" ? 1 : (window.dayCount ?? 7);
  return {
    previousDate: window.minDate && range.from <= window.minDate
      ? null : clampCalendarDate(shiftDate(range.from, -step), window),
    nextDate: window.maxDate && range.through >= window.maxDate
      ? null : clampCalendarDate(shiftDate(range.through, 1), window),
    todayDate: calendarDateError(today, window) ? null : today,
  };
}

export function calendarDateError(date: string, { minDate, maxDate }: Bounds): string | undefined {
  if (minDate && date < minDate) return "Escolha uma data a partir do início do período permitido.";
  if (maxDate && date > maxDate) return "Escolha uma data até o fim do período permitido.";
  return undefined;
}
