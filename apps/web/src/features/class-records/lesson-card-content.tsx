import type { JSX as ReactJSX } from "react";
import { LessonFormat } from "./lesson-format";
import type { CalendarLesson } from "./calendar-model";
import { lessonStatus, lessonCardIdentity } from "./lesson-presentation";
import styles from "./lesson-card-content.module.css";

/** The agenda keeps the same reading order in daily, weekly and expanded cards. */
export function LessonCardContent({
  lesson,
  personal = false,
}: {
  lesson: CalendarLesson;
  personal?: boolean;
}): ReactJSX.Element {
  const { title: fullTitle, context } = lessonCardIdentity(lesson);
  const title =
    lesson.appointment && !personal
      ? fullTitle.trim().split(/\s+/u).slice(0, 2).join(" ")
      : fullTitle;
  return (
    <span
      className={styles.content}
      data-cancelled={lesson.state === "CANCELLED"}
      data-markers={!lesson.appointment && !lesson.experimental}
      data-guests={lesson.guestCount > 0}
      data-personal={personal}
    >
      <span className={styles.header}>
        <span className={styles.time} data-calendar-detail>
          {lesson.startTime}–{lesson.endTime}
        </span>
        <span className={styles.status} data-state={lesson.state} data-calendar-detail>
          {lessonStatus(lesson)}
        </span>
      </span>
      <strong className={styles.title}>
        <LessonFormat lesson={lesson} />
        <span
          className={styles.titleText}
          title={lesson.appointment?.student.name}
          data-calendar-detail
        >
          {title}
        </span>
      </strong>
      <span className={styles.teacher} data-calendar-detail>
        {lesson.teacher ?? "Professor a definir"}
      </span>
      <span className={styles.context} data-calendar-detail>
        {context}
      </span>
    </span>
  );
}
