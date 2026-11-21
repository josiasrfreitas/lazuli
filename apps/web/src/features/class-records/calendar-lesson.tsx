"use client";

import { type KeyboardEvent, type ReactElement } from "react";
import type { CalendarLesson } from "./calendar-model";
import { lessonFormatLabel, lessonDisplay } from "./lesson-presentation";
import { LessonCardContent } from "./lesson-card-content";
import { LessonMarkers } from "./lesson-markers";
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
      aria-label={`${kind}, ${title}, ${context}${format ? `, ${format}` : ""}, ${lesson.teacher ?? "Docente a definir"}, ${lesson.startTime} às ${lesson.endTime}, ${status}${lesson.guestCount > 0 ? `, com convidados: ${lesson.guestCount}` : ""}`}
      title={`${lesson.startTime}–${lesson.endTime} · ${kind} · ${title} · ${context}${format ? ` · ${format}` : ""} · ${lesson.teacher ?? "Docente a definir"} · ${status}`}
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
