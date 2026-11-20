import type { CalendarEvent } from "@lazuli/ui";
import type { RouterOutputs } from "@lazuli/api";

const DATE_LENGTH = 10;
const LAST_WEEKDAY = 6;
const DAYS_PER_WEEK = 7;
const STAGE_SEPARATOR = " - ";

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
  options: {
    appointments: CalendarAppointment[];
    experiments?: CalendarExperimental[] | undefined;
  },
): CalendarLesson[] {
  const { appointments, experiments = [] } = options;
  const lessonIds = new Set(lessons.map((lesson) => lesson.id));
  return [
    ...lessons.map((lesson) => ({
      ...lesson,
      appointments: appointments.filter((item) => item.targetClassSessionId === lesson.id),
    })),
    ...appointments
      .filter((item) => !item.targetClassSessionId || !lessonIds.has(item.targetClassSessionId))
      .map((item) => appointmentLesson(item)),
    ...experiments.map((item) => experimentalLesson(item)),
  ];
}

function appointmentLesson(item: CalendarAppointment): CalendarLesson {
  return {
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
    state: guestLessonState(item),
    attendanceOnly: false,
    guestCount: 0,
    appointment: item,
  };
}

function experimentalLesson(item: CalendarExperimental): CalendarLesson {
  return {
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
    teacher: item.teacher?.name ?? (item.kind === "PLACEMENT" ? "Aplicação sem professor" : null),
    state: guestLessonState(item),
    attendanceOnly: false,
    guestCount: 0,
    experimental: item,
  };
}

function guestLessonState(
  item: Pick<CalendarAppointment | CalendarExperimental, "status" | "overdue">,
): CalendarLesson["state"] {
  if (item.status === "CANCELLED") return "CANCELLED";
  if (item.status === "SCHEDULED") return item.overdue ? "PENDING" : "UPCOMING";
  return "RECORDED";
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
  const separator = name.lastIndexOf(STAGE_SEPARATOR);
  return separator === -1
    ? { series: lesson.scheduleType === "PERSONALIZED" ? "PPT" : "Regular", stage: name }
    : { series: name.slice(0, separator), stage: name.slice(separator + STAGE_SEPARATOR.length) };
}

export function agendaDate(
  today: string,
  { day, week }: { day: string | null; week: string },
): string {
  if (day && validDate(day)) return day;
  if (!validDate(week) || monday(week) === monday(today)) return today;
  return monday(week);
}

export function lessonCalendarEvents(
  lessons: CalendarLesson[],
): (CalendarEvent & { lesson: CalendarLesson })[] {
  return lessons.map((lesson) => ({
    id: lesson.id,
    date: lesson.date,
    startTime: lesson.startTime,
    endTime: lesson.endTime,
    title: lesson.className,
    subtitle: lesson.teacher ?? "Professor a definir",
    lesson,
  }));
}
