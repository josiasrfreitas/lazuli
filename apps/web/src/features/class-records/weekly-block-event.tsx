import type { ReactElement } from "react";
import type { EventProps } from "react-big-calendar";
import { useWeeklyBlock } from "./weekly-block-context";
import { lessonKind } from "./weekly-block-details";
import type { WeeklyBlock } from "./weekly-blocks";
import { WeeklyLessonContent } from "./weekly-lesson-content";
import styles from "./weekly-calendar.module.css";

export function WeeklyBlockEvent({ event }: EventProps<WeeklyBlock>): ReactElement {
  const { expandedId, onOpen, onShowOverflow, selection } = useWeeklyBlock();
  const expanded = expandedId === event.id || Boolean(event.revealed);
  const lesson = event.lessons[0]!;
  const overflow = event.kind === "overflow";
  return (
    <button
      type="button"
      disabled={Boolean(selection && !overflow && !selection.isLessonSelectable(lesson))}
      aria-pressed={selection && !overflow ? selection.selectedId === lesson.id : undefined}
      data-week-trigger
      data-expanded={expanded}
      data-position={event.id}
      data-kind={event.kind}
      data-modality={overflow ? "overflow" : lessonKind(lesson)}
      data-cancelled={lesson.state === "CANCELLED"}
      className={styles.lessonCard}
      aria-label={overflow ? `${event.title} · ${event.startTime}–${event.endTime}` : event.title}
      onClick={() => (overflow ? onShowOverflow(event) : onOpen(lesson))}
    >
      {overflow ? (
        <>
          <strong>+{event.lessons.length}</strong>
          <span>Mais</span>
          {expanded && (
            <span className={styles.overflowNames}>
              {event.lessons.map((item) => item.teacher ?? "A definir").join(", ")}
            </span>
          )}
        </>
      ) : selection ? (
        <>
          <strong className={styles.selectionTitle}>{lesson.className}</strong>
          <span>
            {lesson.startTime}–{lesson.endTime}
          </span>
        </>
      ) : (
        <WeeklyLessonContent lesson={lesson} />
      )}
    </button>
  );
}
