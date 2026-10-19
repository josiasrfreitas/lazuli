import { visitLabels } from "~/features/admissions/labels";
import { purposes, statuses } from "~/features/appointments/shared";
import { lessonStage, lessonStates, type CalendarLesson } from "./calendar-model";

export function lessonKind(lesson: CalendarLesson): string {
  if (lesson.experimental)
    return lesson.experimental.kind === "PLACEMENT" ? "Atendimento" : "Experimental";
  if (lesson.appointment) return "Atendimento";
  return lesson.scheduleType === "PERSONALIZED" ? "PPT" : "Regular";
}

export function lessonSummary(lesson: CalendarLesson): string {
  if (lesson.experimental)
    return lesson.experimental.kind === "PLACEMENT" ? "Nivelamento" : "Aula experimental";
  if (lesson.appointment) return purposes[lesson.appointment.purpose];
  return lessonStage(lesson);
}

export function lessonStatus(lesson: CalendarLesson): string {
  if (lesson.experimental)
    return lesson.experimental.overdue ? "A registrar" : visitLabels[lesson.experimental.status];
  if (lesson.appointment)
    return lesson.appointment.overdue ? "A registrar" : statuses[lesson.appointment.status];
  if (lesson.attendanceOnly && lesson.state !== "CANCELLED") return "Presença registrada";
  return lessonStates[lesson.state];
}
