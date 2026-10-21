import type { JSX as ReactJSX } from "react";
import { MapPin, Video } from "lucide-react";
import type { CalendarLesson } from "./calendar-model";
import styles from "./lesson-format.module.css";

export function lessonFormatLabel(lesson: CalendarLesson): string | null {
  const format = lesson.experimental?.format ?? lesson.appointment?.format ?? lesson.format;
  if (!format) return null;
  return format === "ONLINE" ? "Online" : "Presencial";
}

export function LessonFormat({ lesson }: { lesson: CalendarLesson }): ReactJSX.Element | null {
  const label = lessonFormatLabel(lesson);
  if (!label) return null;
  const Icon = label === "Online" ? Video : MapPin;
  return (
    <span className={styles.indicator} title={label} role="img" aria-label={label}>
      <Icon aria-hidden="true" />
    </span>
  );
}
