import { Ban, CircleCheck, CircleDashed, UsersRound, UserRoundX } from "lucide-react";
import { purposes } from "~/features/appointments/shared";
import { stageIdentity, type CalendarLesson } from "./calendar-model";
import { LessonFormat, lessonFormatLabel } from "./lesson-format";
import { lessonPresenceLabel } from "./lesson-markers";
import { lessonKind, lessonStatus } from "./weekly-block-details";
import styles from "./weekly-lesson-content.module.css";

function cardIdentity(lesson: CalendarLesson) {
  return {
    title:
      lesson.experimental?.candidate.fullName ??
      lesson.appointment?.student.name ??
      stageIdentity(lesson).stage,
    context: lesson.experimental
      ? lesson.experimental.kind === "PLACEMENT"
        ? "Nivelamento"
        : "Experimental individual"
      : lesson.appointment
        ? purposes[lesson.appointment.purpose]
        : lesson.className,
  };
}

export function weeklyLessonLabel(lesson: CalendarLesson): string {
  const { title, context } = cardIdentity(lesson);
  return [
    lessonKind(lesson),
    title,
    context,
    lessonFormatLabel(lesson),
    lesson.teacher ?? "Professor a definir",
    `${lesson.startTime}–${lesson.endTime}`,
    lessonStatus(lesson),
    !lesson.appointment && !lesson.experimental ? lessonPresenceLabel(lesson) : null,
    lesson.guestCount > 0 ? `${lesson.guestCount} convidados` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Weekly density follows the card's available area, independently of the daily layout. */
export function WeeklyLessonContent({ lesson }: { lesson: CalendarLesson }) {
  const { title, context } = cardIdentity(lesson);
  return (
    <span className={styles.content} data-cancelled={lesson.state === "CANCELLED"}>
      <strong className={styles.title} data-calendar-detail>
        {title}
      </strong>
      <span className={styles.header}>
        <span className={styles.time} data-calendar-detail>
          <span>{lesson.startTime}</span>
          <span className={styles.timeSeparator}>–</span>
          <span>{lesson.endTime}</span>
        </span>
        <span className={styles.indicators}>
          <span className={styles.format}>
            <LessonFormat lesson={lesson} />
          </span>
          <WeeklyLessonStatus lesson={lesson} />
          {lesson.guestCount > 0 && (
            <span className={styles.guests} title={`${lesson.guestCount} convidados`}>
              <UsersRound aria-hidden="true" />
              <span data-calendar-detail>{lesson.guestCount}</span>
            </span>
          )}
        </span>
      </span>
      <span className={styles.teacher} data-calendar-detail>
        {lesson.teacher ?? "Professor a definir"}
      </span>
      <span className={styles.context} data-calendar-detail>
        {context}
      </span>
    </span>
  );
}

function WeeklyLessonStatus({ lesson }: { lesson: CalendarLesson }) {
  const absent =
    lesson.appointment?.status === "NO_SHOW" || lesson.experimental?.status === "ABSENT";
  const recorded = lesson.state === "RECORDED" || lesson.attendanceOnly;
  const cancelled = lesson.state === "CANCELLED";
  const Icon = cancelled ? Ban : absent ? UserRoundX : recorded ? CircleCheck : CircleDashed;
  const status = lessonStatus(lesson);
  const label =
    !lesson.appointment && !lesson.experimental
      ? `${status} · ${lessonPresenceLabel(lesson)}`
      : status;
  const tone = cancelled
    ? "cancelled"
    : absent || lesson.state === "PENDING"
      ? "pending"
      : recorded
        ? "recorded"
        : "upcoming";
  return (
    <span className={styles.status} data-tone={tone} title={label} role="img" aria-label={label}>
      <Icon aria-hidden="true" />
      <span className={styles.statusText} data-calendar-detail>
        {status}
      </span>
    </span>
  );
}
