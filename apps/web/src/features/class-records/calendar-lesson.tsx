"use client";

import { type KeyboardEvent, type ReactElement } from "react";
import { purposes } from "~/features/appointments/shared";
import { stageIdentity, type CalendarLesson } from "./calendar-model";
import { lessonFormatLabel } from "./lesson-format";
import { LessonCardContent } from "./lesson-card-content";
import { LessonMarkers } from "./lesson-markers";
import { lessonStatus } from "./weekly-block-details";
import styles from "./calendar.module.css";

type LessonDisplay = {
  id: string | undefined;
  title: string;
  context: string;
  status: string;
  kind: string;
  modality: string;
};

export function lessonDisplay(lesson: CalendarLesson): LessonDisplay {
  const status = lessonStatus(lesson);
  const experiment = lesson.experimental;
  if (experiment) {
    const placement = experiment.kind === "PLACEMENT";
    return {
      id: `experimental-cell-${experiment.id}`,
      title: experiment.candidate.fullName,
      context: placement ? "Nivelamento" : "Individual",
      status,
      kind: placement ? "Atendimento" : "Experimental",
      modality: "EXPERIMENTAL",
    };
  }

  const appointment = lesson.appointment;
  if (appointment) {
    return {
      id: `appointment-cell-${appointment.id}`,
      title: appointment.student.name,
      context: purposes[appointment.purpose],
      status,
      kind: "Atendimento",
      modality: "APPOINTMENT",
    };
  }

  return {
    id: undefined,
    title: stageIdentity(lesson).stage,
    context: lesson.className,
    status,
    kind: lesson.scheduleType === "PERSONALIZED" ? "PPT" : "Regular",
    modality: lesson.scheduleType,
  };
}

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
  const { id, title, context, status, kind, modality } = lessonDisplay(lesson);
  const format = lessonFormatLabel(lesson);
  return (
    <button
      id={id}
      type="button"
      className={styles.lesson}
      data-state={lesson.state}
      data-personal={personal}
      data-has-markers={!lesson.appointment && !lesson.experimental}
      data-modality={modality}
      aria-haspopup="dialog"
      aria-expanded={lesson.appointment ? expanded : undefined}
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
