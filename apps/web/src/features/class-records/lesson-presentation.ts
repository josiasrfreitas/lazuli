import { visitLabels } from "~/features/admissions/labels";
import { purposes, appointmentStatus } from "~/features/appointments/shared";
import { stageIdentity, lessonStates, type CalendarLesson } from "./calendar-model";

export const EVENT_LABELS = {
  REGULAR: "Regular",
  PERSONALIZED: "PPT",
  EXPERIMENTAL: "Experimental",
  APPOINTMENT: "Atendimento",
} as const;

export function primaryEventType(lesson: CalendarLesson): keyof typeof EVENT_LABELS {
  if (lesson.experimental)
    return lesson.experimental.kind === "PLACEMENT" ? "APPOINTMENT" : "EXPERIMENTAL";
  if (lesson.appointment) return "APPOINTMENT";
  return lesson.scheduleType;
}

export function lessonFormatLabel(lesson: CalendarLesson): string | null {
  const format = lesson.experimental?.format ?? lesson.appointment?.format ?? lesson.format;
  if (!format) return null;
  return format === "ONLINE" ? "Online" : "Presencial";
}

export function lessonStatus(lesson: CalendarLesson): string {
  if (lesson.experimental)
    return lesson.experimental.overdue ? "A registrar" : visitLabels[lesson.experimental.status];
  if (lesson.appointment)
    return lesson.appointment.overdue
      ? "A registrar"
      : appointmentStatus(lesson.appointment.status, Boolean(lesson.appointment.rescheduledToId));
  if (lesson.attendanceOnly && lesson.state !== "CANCELLED") return "Presença registrada";
  return lessonStates[lesson.state];
}
type LessonDisplay = {
  id: string | undefined;
  title: string;
  context: string;
  status: string;
  kind: string;
  modality: string;
};

export function lessonCardIdentity(lesson: CalendarLesson): { title: string; context: string } {
  if (lesson.experimental)
    return {
      title: lesson.experimental.candidate.fullName,
      context: lesson.experimental.kind === "PLACEMENT" ? "Nivelamento" : "Experimental individual",
    };
  if (lesson.appointment)
    return {
      title: lesson.appointment.student.name,
      context: purposes[lesson.appointment.purpose],
    };
  return { title: stageIdentity(lesson).stage, context: lesson.className };
}

export function lessonDisplay(lesson: CalendarLesson): LessonDisplay {
  const identity = lessonCardIdentity(lesson);
  const eventType = primaryEventType(lesson);
  const display = { ...identity, status: lessonStatus(lesson), kind: EVENT_LABELS[eventType] };
  if (lesson.experimental)
    return {
      ...display,
      id: `experimental-cell-${lesson.experimental.id}`,
      context: lesson.experimental.kind === "PLACEMENT" ? identity.context : "Individual",
      modality: "EXPERIMENTAL",
    };
  return {
    ...display,
    id: lesson.appointment ? `appointment-cell-${lesson.appointment.id}` : undefined,
    modality: eventType,
  };
}
