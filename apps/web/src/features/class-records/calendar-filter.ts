import type { SearchSelectOption } from "@lazuli/ui";
import type { CalendarLesson } from "./calendar-model";
import { lessonFormatLabel } from "./lesson-format";
import { EVENT_TYPES } from "./calendar-event-filters";

export type LessonFilters = { types: string[]; teachers: SearchSelectOption[]; formats: string[] };

export function filterLessons(lessons: CalendarLesson[], filters: LessonFilters): CalendarLesson[] {
  return lessons.filter(
    (lesson) =>
      matchesEventType(lesson, filters.types) &&
      matchesTeacher(lesson, filters.teachers) &&
      matchesFormat(lesson, filters.formats),
  );
}

export function filtersRestricted(filters: LessonFilters): boolean {
  return (
    filters.types.length < EVENT_TYPES.length ||
    filters.teachers.length > 0 ||
    filters.formats.length < 2
  );
}

function matchesEventType(lesson: CalendarLesson, types: string[]): boolean {
  if (types.includes(primaryEventType(lesson))) return true;
  if (types.includes("APPOINTMENT") && Boolean(lesson.appointments?.length)) return true;
  return types.includes("EXPERIMENTAL") && Boolean(lesson.leadGuests?.length);
}

function primaryEventType(lesson: CalendarLesson): string {
  if (lesson.experimental)
    return lesson.experimental.kind === "PLACEMENT" ? "APPOINTMENT" : "EXPERIMENTAL";
  if (lesson.appointment) return "APPOINTMENT";
  return lesson.scheduleType;
}

function matchesTeacher(lesson: CalendarLesson, teachers: SearchSelectOption[]): boolean {
  if (teachers.length === 0) return true;
  return teachers.some((teacher) => teacher.id === (lesson.teacherId ?? "unassigned"));
}

function matchesFormat(lesson: CalendarLesson, formats: string[]): boolean {
  const format = lessonFormatLabel(lesson);
  return format === null || formats.includes(format);
}
