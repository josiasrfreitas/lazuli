import type { JSX as ReactJSX } from "react";
import { MapPin, Video } from "lucide-react";
import type { CalendarLesson } from "./calendar-model";
import styles from "./lesson-format.module.css";

import { lessonFormatLabel } from "./lesson-presentation";

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
