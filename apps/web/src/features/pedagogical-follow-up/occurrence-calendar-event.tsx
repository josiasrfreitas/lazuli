import type { JSX as ReactJSX } from "react";
import type { CalendarEvent, CalendarEventRenderContext } from "@lazuli/ui";
import { Check, UserRound } from "lucide-react";
import styles from "./occurrence-calendar-event.module.css";

export type OccurrenceCalendarEvent = CalendarEvent & {
  teacherName: string | null;
  substitute: boolean;
  stageName: string | null;
  scheduleType: string;
  format: string;
};

export function OccurrenceLessonCard({
  event,
  context,
}: {
  event: OccurrenceCalendarEvent;
  context: CalendarEventRenderContext;
}): ReactJSX.Element {
  const detailed = context.view === "day" || context.expanded;
  const teacher = `${event.teacherName ?? "Professor a definir"}${event.substitute ? " · substituto" : ""}`;
  const stage =
    event.scheduleType === "PERSONALIZED"
      ? "Estágios individuais"
      : (event.stageName ?? "Estágio não informado");
  const format = event.format === "ONLINE" ? "Online" : "Presencial";
  const metadata = `${stage} · ${event.scheduleType === "PERSONALIZED" ? "PPT" : "Regular"} · ${format}`;
  return (
    <button
      type="button"
      className={styles.card}
      data-detailed={detailed}
      aria-pressed={context.selected}
      disabled={context.disabled}
      onClick={context.activate}
      aria-label={`${event.title} · ${event.startTime}–${event.endTime} · ${teacher} · ${metadata}`}
      title={`${event.title}\n${event.startTime}–${event.endTime}\n${teacher}\n${metadata}`}
    >
      <span className={styles.time}>
        <span>
          {event.startTime}–{event.endTime}
        </span>
        {context.selected && <Check aria-hidden="true" />}
      </span>
      <strong className={styles.title} data-calendar-detail>
        {event.title}
      </strong>
      <span className={styles.teacher}>
        <UserRound aria-hidden="true" />
        <span>{teacher}</span>
      </span>
      <span className={styles.metadata}>{metadata}</span>
    </button>
  );
}
