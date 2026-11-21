"use client";
import type { ReactElement } from "react";
import type { CalendarLesson } from "./calendar-model";
import { WeeklyLessonContent, weeklyLessonLabel } from "./weekly-lesson-content";
import { primaryEventType } from "./lesson-presentation";
import { useLessonCardReveal } from "./use-lesson-card-reveal";
import styles from "./weekly-calendar.module.css";

export function WeeklyLessonCard({
  lesson,
  expanded,
  expandedDayWidth,
  expandedWidthShare,
  onOpen,
}: {
  lesson: CalendarLesson;
  expanded: boolean;
  expandedDayWidth?: number | undefined;
  expandedWidthShare?: number | undefined;
  onOpen: () => void;
}): ReactElement {
  const ref = useLessonCardReveal(expandedDayWidth, expandedWidthShare);
  const label = weeklyLessonLabel(lesson);
  return (
    <button
      ref={ref}
      type="button"
      className={styles.lessonCard}
      aria-haspopup="dialog"
      data-week-trigger
      data-expanded={expanded}
      data-modality={primaryEventType(lesson)}
      data-has-markers={!lesson.appointment && !lesson.experimental}
      data-cancelled={lesson.state === "CANCELLED"}
      aria-label={label}
      title={label}
      onClick={onOpen}
    >
      <WeeklyLessonContent lesson={lesson} />
    </button>
  );
}
