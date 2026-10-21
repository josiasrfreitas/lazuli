import type { JSX as ReactJSX } from "react";
import { Ban, CircleCheck, CircleDashed, UsersRound } from "lucide-react";
import type { CalendarLesson } from "./calendar-model";
import styles from "./lesson-markers.module.css";

export function lessonPresenceLabel(lesson: CalendarLesson): string {
  if (lesson.state === "CANCELLED") return "Aula cancelada";
  return lesson.state === "RECORDED" || lesson.attendanceOnly
    ? "Presença registrada"
    : "Presença não registrada";
}

/** Always visible on lesson cards, even when compact layout hides the text labels. */
export function LessonMarkers({ lesson }: { lesson: CalendarLesson }): ReactJSX.Element | null {
  if (lesson.appointment || lesson.experimental) return null;
  const recorded = lesson.state === "RECORDED" || lesson.attendanceOnly;
  const cancelled = lesson.state === "CANCELLED";
  const Icon = cancelled ? Ban : recorded ? CircleCheck : CircleDashed;
  const label = lessonPresenceLabel(lesson);
  const guests = lesson.guestCount;
  return (
    <span className={styles.markers} aria-hidden="true">
      <span className={styles.marker} data-recorded={recorded && !cancelled} title={label}>
        <Icon />
      </span>
      {guests > 0 && (
        <span
          className={styles.marker}
          title={`${guests} ${guests === 1 ? "convidado" : "convidados"}`}
        >
          <UsersRound />
        </span>
      )}
    </span>
  );
}
