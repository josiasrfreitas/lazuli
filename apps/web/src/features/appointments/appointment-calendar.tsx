import type { ReactElement } from "react";
import {
  ScheduleCalendar,
  getScheduleCalendarRange,
  type CalendarEvent,
  type ScheduleCalendarProps,
} from "@lazuli/ui";
import { appointmentWindows } from "./appointment-calendar-model";
import styles from "./class-meeting-step.module.css";

export function AppointmentCalendar<Event extends CalendarEvent>({
  collapseEmptyShifts,
  ...props
}: ScheduleCalendarProps<Event> & { collapseEmptyShifts: boolean }): ReactElement {
  const range = getScheduleCalendarRange(props);
  const visible = props.events.filter(
    (event) => event.date >= range.from && event.date <= range.through,
  );
  if (!collapseEmptyShifts || props.status !== "ready")
    return <FullAppointmentCalendar {...props} visible={visible} />;
  const classes = visible.filter((event) => event.id.startsWith("class-"));
  if (classes.length === 0)
    return (
      <div className={styles.emptyCalendar} role="status">
        Nenhuma aula deste professor neste período. Escolha outro dia ou professor.
      </div>
    );
  const windows = appointmentWindows(classes);
  if (windows.length === 1) return <ScheduleCalendar {...props} hours={windows[0]!} />;
  return (
    <div className={styles.calendarWindows}>
      {windows.map((window) => (
        <section
          key={window.start}
          className={styles.calendarWindow}
          aria-label={window.labels.join(" e ")}
        >
          <p className="text-caption text-muted-foreground">
            {window.labels.join(" e ")} · {window.start}–{window.end}
          </p>
          <ScheduleCalendar
            {...props}
            hours={window}
            events={props.events.filter(
              (event) => event.startTime < window.end && event.endTime > window.start,
            )}
          />
        </section>
      ))}
    </div>
  );
}
function FullAppointmentCalendar<Event extends CalendarEvent>({
  visible,
  ...props
}: ScheduleCalendarProps<Event> & { visible: Event[] }): ReactElement {
  const selected = props.rangeSelection?.value;
  const times = [
    "08:00",
    "22:00",
    ...visible.flatMap((event) => [event.startTime, event.endTime]),
    ...(selected ? [selected.startTime, selected.endTime] : []),
  ].toSorted();
  return <ScheduleCalendar {...props} hours={{ start: times[0]!, end: times.at(-1)! }} />;
}
