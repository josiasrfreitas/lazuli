import { monday, shiftDate, validDate, type CalendarLesson } from "./calendar-model";

const LAST_WEEKDAY = 6;

/** Dates in this adapter carry school wall-clock values, not instants to convert. */
export function calendarWallDate(date: string, time = "00:00"): Date {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return new Date(year!, month! - 1, day, hour, minute);
}

export function calendarDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function agendaDate(
  today: string,
  { day, week }: { day: string | null; week: string },
): string {
  if (day && validDate(day)) return day;
  if (!validDate(week) || monday(week) === monday(today)) return today;
  return monday(week);
}

export function schoolCalendarNow(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const part = (name: Intl.DateTimeFormatPartTypes): string =>
    parts.find((item) => item.type === name)!.value;
  return calendarWallDate(
    `${part("year")}-${part("month")}-${part("day")}`,
    `${part("hour")}:${part("minute")}`,
  );
}

export type WeeklyCalendarEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  lesson: CalendarLesson;
};

export function weeklyCalendarEvents(
  lessons: CalendarLesson[],
  date: string,
): WeeklyCalendarEvent[] {
  const from = monday(date);
  const through = shiftDate(from, LAST_WEEKDAY);
  return lessons
    .filter((lesson) => lesson.date >= from && lesson.date <= through)
    .map((lesson) => ({
      id: lesson.id,
      title: `${lesson.teacher ?? "Professor a definir"} · ${lesson.appointment ? "Atendimento" : lesson.className} · ${lesson.startTime}–${lesson.endTime}`,
      start: calendarWallDate(lesson.date, lesson.startTime),
      end: calendarWallDate(lesson.date, lesson.endTime),
      lesson,
    }));
}
