import { LessonFormat } from "./lesson-format";
import { stageIdentity, type CalendarLesson } from "./calendar-model";
import { lessonStatus } from "./weekly-block-details";
import { purposes } from "~/features/appointments/shared";
import styles from "./lesson-card-content.module.css";

/** The agenda keeps the same reading order in daily, weekly and expanded cards. */
export function LessonCardContent({
  lesson,
  personal = false,
}: {
  lesson: CalendarLesson;
  personal?: boolean;
}) {
  const title =
    lesson.experimental?.candidate.fullName ??
    (personal
      ? lesson.appointment?.student.name
      : lesson.appointment?.student.name.trim().split(/\s+/u).slice(0, 2).join(" ")) ??
    stageIdentity(lesson).stage;
  const context = lesson.experimental
    ? lesson.experimental.kind === "PLACEMENT"
      ? "Nivelamento"
      : "Experimental individual"
    : lesson.appointment
      ? purposes[lesson.appointment.purpose]
      : lesson.className;
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
