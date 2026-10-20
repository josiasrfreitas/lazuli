"use client";

import { type KeyboardEvent, type ReactElement } from "react";
import { visitLabels } from "~/features/admissions/labels";
import { purposes, statuses } from "~/features/appointments/shared";
import { stageIdentity, type CalendarLesson } from "./calendar-model";
import { lessonFormatLabel } from "./lesson-format";
import { LessonCardContent } from "./lesson-card-content";
import { LessonMarkers } from "./lesson-markers";
import { lessonStatus } from "./weekly-block-details";
import styles from "./calendar.module.css";

export function CalendarLessonButton({
  lesson,
  expanded,
  onOpen,
  personal = false,
}: {
  lesson: CalendarLesson;
  expanded: boolean;
  onOpen: (lesson: CalendarLesson) => void;
  personal?: boolean;
}): ReactElement {
  const identity = stageIdentity(lesson);
  const appointment = lesson.appointment;
  const experiment = lesson.experimental;
  const title = experiment
    ? experiment.candidate.fullName
    : appointment
      ? appointment.student.name
      : identity.stage;
  const context = experiment
    ? experiment.kind === "PLACEMENT"
      ? "Nivelamento"
      : "Individual"
    : appointment
      ? purposes[appointment.purpose]
      : lesson.className;
  const format = lessonFormatLabel(lesson);
  const status = experiment
    ? experiment.overdue
      ? "A registrar"
      : visitLabels[experiment.status]
    : appointment
      ? appointment.overdue
        ? "A registrar"
        : statuses[appointment.status]
      : lessonStatus(lesson);
  const kind = experiment
    ? experiment.kind === "PLACEMENT"
      ? "Atendimento"
      : "Experimental"
    : appointment
      ? "Atendimento"
      : lesson.scheduleType === "PERSONALIZED"
        ? "PPT"
        : "Regular";
  return (
    <button
      id={
        experiment
          ? `experimental-cell-${experiment.id}`
          : appointment
            ? `appointment-cell-${appointment.id}`
            : undefined
      }
      type="button"
      className={styles.lesson}
      data-state={lesson.state}
      data-personal={personal}
      data-has-markers={!appointment && !experiment}
      data-modality={
        experiment ? "EXPERIMENTAL" : appointment ? "APPOINTMENT" : lesson.scheduleType
      }
      aria-haspopup="dialog"
      aria-expanded={appointment ? expanded : undefined}
      aria-label={`${kind}, ${title}, ${context}${format ? `, ${format}` : ""}, ${lesson.teacher ?? "Professor a definir"}, ${lesson.startTime} às ${lesson.endTime}, ${status}${lesson.guestCount > 0 ? `, com convidados: ${lesson.guestCount}` : ""}`}
      title={`${lesson.startTime}–${lesson.endTime} · ${kind} · ${title} · ${context}${format ? ` · ${format}` : ""} · ${lesson.teacher ?? "Professor a definir"} · ${status}`}
      data-start={lesson.startTime}
      onKeyDown={navigateLessons}
      onClick={() => onOpen(lesson)}
    >
      <LessonCardContent lesson={lesson} personal={personal} />
      <LessonMarkers lesson={lesson} />
    </button>
  );
}

function navigateLessons(event: KeyboardEvent<HTMLButtonElement>): void {
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
  const button = event.currentTarget;
  const column = button.closest('[role="group"]');
  if (!column) return;
  event.preventDefault();
  const buttons = [...column.querySelectorAll<HTMLButtonElement>("button[data-start]")];
  const step = ["ArrowDown", "ArrowRight"].includes(event.key) ? 1 : -1;
  const target = buttons[buttons.indexOf(button) + step];
  target?.focus();
}
