import type { JSX as ReactJSX } from "react";
import {
  Ban,
  CircleCheck,
  CircleDashed,
  UsersRound,
  UserRoundX,
  type LucideIcon,
} from "lucide-react";
import type { CalendarLesson } from "./calendar-model";
import { LessonFormat } from "./lesson-format";
import { lessonPresenceLabel } from "./lesson-markers";
import {
  EVENT_LABELS,
  primaryEventType,
  lessonCardIdentity,
  lessonFormatLabel,
  lessonStatus,
} from "./lesson-presentation";
import styles from "./weekly-lesson-content.module.css";

export function weeklyLessonLabel(lesson: CalendarLesson): string {
  const { title, context } = lessonCardIdentity(lesson);
  return [
    EVENT_LABELS[primaryEventType(lesson)],
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
export function WeeklyLessonContent({ lesson }: { lesson: CalendarLesson }): ReactJSX.Element {
  const { title, context } = lessonCardIdentity(lesson);
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

function WeeklyLessonStatus({ lesson }: { lesson: CalendarLesson }): ReactJSX.Element {
  const Icon = weeklyStatusIcon(lesson);
  const status = lessonStatus(lesson);
  const label =
    !lesson.appointment && !lesson.experimental
      ? `${status} · ${lessonPresenceLabel(lesson)}`
      : status;
  const tone = weeklyStatusTone(lesson);
  return (
    <span className={styles.status} data-tone={tone} title={label} role="img" aria-label={label}>
      <Icon aria-hidden="true" />
      <span className={styles.statusText} data-calendar-detail>
        {status}
      </span>
    </span>
  );
}

function weeklyStatusIcon(lesson: CalendarLesson): LucideIcon {
  if (lesson.state === "CANCELLED") return Ban;
  if (lesson.appointment?.status === "NO_SHOW" || lesson.experimental?.status === "ABSENT")
    return UserRoundX;
  if (lesson.state === "RECORDED" || lesson.attendanceOnly) return CircleCheck;
  return CircleDashed;
}

function weeklyStatusTone(
  lesson: CalendarLesson,
): "cancelled" | "pending" | "recorded" | "upcoming" {
  if (lesson.state === "CANCELLED") return "cancelled";
  if (
    lesson.appointment?.status === "NO_SHOW" ||
    lesson.experimental?.status === "ABSENT" ||
    lesson.state === "PENDING"
  )
    return "pending";
  if (lesson.state === "RECORDED" || lesson.attendanceOnly) return "recorded";
  return "upcoming";
}
