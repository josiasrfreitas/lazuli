import type { RouterOutputs } from "@lazuli/api";

const DATE_LENGTH = 10;
const LAST_WEEKDAY = 6;
const DAYS_PER_WEEK = 7;
const DEFAULT_START_HOUR = 8;
const DEFAULT_END_HOUR = 20;

export type CalendarAppointment = RouterOutputs["appointments"]["list"][number];
export type CalendarExperimental = RouterOutputs["classRecords"]["experimentalSessions"][number];
type ClassLesson = RouterOutputs["classRecords"]["list"][number];
export type CalendarLesson = Omit<ClassLesson, "leadGuests" | "format"> & {
  format?: ClassLesson["format"];
  leadGuests?: ClassLesson["leadGuests"];
  experimental?: CalendarExperimental;
  appointment?: CalendarAppointment;
  appointments?: CalendarAppointment[];
};

export function agendaEvents(
  lessons: CalendarLesson[],
  appointments: CalendarAppointment[],
  experiments: CalendarExperimental[] = [],
): CalendarLesson[] {
  const lessonIds = new Set(lessons.map((lesson) => lesson.id));
  return [
    ...lessons.map((lesson) => ({
      ...lesson,
      appointments: appointments.filter((item) => item.targetClassSessionId === lesson.id),
    })),
    ...appointments
      .filter((item) => !item.targetClassSessionId || !lessonIds.has(item.targetClassSessionId))
      .map(
        (item): CalendarLesson => ({
          id: `appointment-${item.id}`,
          classId: "",
          className: item.student.name,
          format: item.format,
          scheduleType: "REGULAR",
          stageName: null,
          date: item.date,
          startTime: item.startTime,
          endTime: item.endTime,
          teacherId: item.teacher?.id ?? null,
          teacher: item.teacher?.name ?? null,
          state:
            item.status === "CANCELLED"
              ? "CANCELLED"
              : item.status === "SCHEDULED"
                ? item.overdue
                  ? "PENDING"
                  : "UPCOMING"
                : "RECORDED",
          attendanceOnly: false,
          guestCount: 0,
          appointment: item,
        }),
      ),
    ...experiments.map(
      (item): CalendarLesson => ({
        id: `experimental-${item.id}`,
        classId: "",
        className: item.kind === "PLACEMENT" ? "Nivelamento" : "Experimental individual",
        format: item.format,
        scheduleType: item.candidate.scheduleType ?? "REGULAR",
        stageName: null,
        date: item.date,
        startTime: item.startTime,
        endTime: item.endTime,
        teacherId: item.teacher?.id ?? null,
        teacher:
          item.teacher?.name ?? (item.kind === "PLACEMENT" ? "Aplicação sem professor" : null),
        state:
          item.status === "CANCELLED"
            ? "CANCELLED"
            : item.status === "SCHEDULED"
              ? item.overdue
                ? "PENDING"
                : "UPCOMING"
              : "RECORDED",
        attendanceOnly: false,
        guestCount: 0,
        experimental: item,
      }),
    ),
  ];
}
export const lessonStates = {
  PENDING: "A registrar",
  RECORDED: "Com baixa",
  UPCOMING: "Agendada",
  CANCELLED: "Cancelada",
} as const;

export function schoolToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function shiftDate(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, DATE_LENGTH);
}

export function validDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const value = new Date(`${date}T12:00:00Z`);
  return !Number.isNaN(value.getTime()) && value.toISOString().slice(0, DATE_LENGTH) === date;
}

export function monday(date: string): string {
  return shiftDate(
    date,
    -((new Date(`${date}T12:00:00Z`).getUTCDay() + LAST_WEEKDAY) % DAYS_PER_WEEK),
  );
}

export function calendarDate(date: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("pt-BR", { ...options, timeZone: "UTC" }).format(
    new Date(`${date}T12:00:00Z`),
  );
}

export function lessonStage(lesson: CalendarLesson): string {
  return lesson.scheduleType === "PERSONALIZED"
    ? "Estágios individuais"
    : (lesson.stageName ?? "Estágio não informado");
}

export function stageIdentity(lesson: CalendarLesson): { series: string; stage: string } {
  const name = lessonStage(lesson);
  const separator = name.lastIndexOf(" - ");
  return separator < 0
    ? { series: lesson.scheduleType === "PERSONALIZED" ? "PPT" : "Regular", stage: name }
    : { series: name.slice(0, separator), stage: name.slice(separator + 3) };
}

export type TeacherColumn = { id: string | null; name: string };

/** Week-wide identity and ordering keep columns in place while navigating days. */
export function calendarTeachers(lessons: CalendarLesson[]): TeacherColumn[] {
  const teachers = new Map<string | null, TeacherColumn>();
  for (const lesson of lessons) {
    teachers.set(lesson.teacherId, {
      id: lesson.teacherId,
      name: lesson.teacher ?? "Professor a definir",
    });
  }
  return [...teachers.values()].toSorted((left, right) =>
    left.id === null
      ? 1
      : right.id === null
        ? -1
        : left.name.localeCompare(right.name, "pt-BR") || left.id.localeCompare(right.id),
  );
}

/** Overlapping lessons belonging to one teacher remain separately selectable. */
export function teacherDayLessons(
  lessons: CalendarLesson[],
  teacherId: string | null,
  date: string,
): { placed: { lesson: CalendarLesson; lane: number }[]; lanes: number } {
  const ends: string[] = [];
  const placed = lessons
    .filter((lesson) => lesson.date === date && lesson.teacherId === teacherId)
    .toSorted(
      (left, right) =>
        left.startTime.localeCompare(right.startTime) || left.id.localeCompare(right.id),
    )
    .map((lesson) => {
      const free = ends.findIndex((end) => end <= lesson.startTime);
      const lane = free < 0 ? ends.length : free;
      ends[lane] = lesson.endTime;
      return { lesson, lane };
    });
  return { placed, lanes: Math.max(1, ends.length) };
}

export const CALENDAR_SLOT_HEIGHT = 72;
const SLOT_MINUTES = 60;

export function calendarTimeBounds(lessons: CalendarLesson[]): { start: string; end: string } {
  const first =
    lessons.length > 0
      ? Math.min(...lessons.map((row) => Number(row.startTime.slice(0, 2))))
      : DEFAULT_START_HOUR;
  const last =
    lessons.length > 0
      ? Math.max(
          ...lessons.map(
            (row) => Number(row.endTime.slice(0, 2)) + (row.endTime.endsWith(":00") ? 0 : 1),
          ),
        )
      : DEFAULT_END_HOUR;
  return {
    start: `${String(first).padStart(2, "0")}:00:00`,
    end: `${String(Math.max(last, first + 1)).padStart(2, "0")}:00:00`,
  };
}

export function timeMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours! * SLOT_MINUTES + minutes!;
}
