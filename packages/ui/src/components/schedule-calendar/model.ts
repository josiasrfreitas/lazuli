import type { CalendarInterval, CalendarRangeSelection } from "./types";

const MINUTES_PER_HOUR = 60;
const LAST_WEEKDAY = 6;
const DAYS_PER_WEEK = 7;

export function calendarWallDate(date: string, time = "00:00"): Date {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return new Date(year!, month! - 1, day, hour, minute);
}
export function calendarDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function clockTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
export function timeMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours! * MINUTES_PER_HOUR + minutes!;
}
export function shiftDate(date: string, days: number): string {
  const value = calendarWallDate(date, "12:00");
  value.setDate(value.getDate() + days);
  return calendarDateKey(value);
}
export function monday(date: string): string {
  return shiftDate(date, -((calendarWallDate(date).getDay() + LAST_WEEKDAY) % DAYS_PER_WEEK));
}
export function zonedNow(timeZone: string, instant = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const part = (name: Intl.DateTimeFormatPartTypes): string =>
    parts.find((item) => item.type === name)!.value;
  const date = calendarWallDate(
    `${part("year")}-${part("month")}-${part("day")}`,
    `${part("hour")}:${part("minute")}`,
  );
  date.setSeconds(Number(part("second")));
  return date;
}
function intervalError(range: CalendarInterval): string | undefined {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(range.date) ||
    calendarDateKey(calendarWallDate(range.date)) !== range.date
  )
    return "Informe uma data válida.";
  const clock = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!clock.test(range.startTime) || !(clock.test(range.endTime) || range.endTime === "24:00"))
    return "Informe início e fim em hh:mm.";
  if (range.endTime <= range.startTime) return "O fim precisa ser depois do início.";
  return undefined;
}
export function selectionError(
  range: CalendarInterval,
  selection: CalendarRangeSelection,
): string | undefined {
  const invalid = intervalError(range);
  if (invalid) return invalid;
  const minimum = selection.minimum;
  if (minimum && `${range.date} ${range.startTime}` < `${minimum.date} ${minimum.time}`)
    return "Este horário não está disponível. Escolha um horário posterior.";
  const blocked = selection.blocked?.find(
    (item) =>
      item.date === range.date && item.startTime < range.endTime && range.startTime < item.endTime,
  );
  if (blocked)
    return `${blocked.label} · ${blocked.startTime}–${blocked.endTime}. Escolha outro horário.`;
  return selection.getError?.(range) ?? undefined;
}
