import type { ReactElement } from "react";
import {
  ScheduleCalendar,
  getScheduleCalendarRange,
  type CalendarEvent,
  type ScheduleCalendarProps,
} from "@lazuli/ui";
import styles from "./class-meeting-step.module.css";

const shifts = [
  { start: "08:00", end: "12:00", label: "Manhã" },
  { start: "13:00", end: "18:00", label: "Tarde" },
  { start: "18:00", end: "22:00", label: "Noite" },
];
type Window = { start: string; end: string; labels: string[]; lastIndex: number };

export function AppointmentCalendar<Event extends CalendarEvent>({
  collapseEmptyShifts,
  ...props
}: ScheduleCalendarProps<Event> & { collapseEmptyShifts: boolean }): ReactElement {
  const range = getScheduleCalendarRange(props);
  const classes = props.events.filter(
    (event) =>
      event.id.startsWith("class-") && event.date >= range.from && event.date <= range.through,
  );
  if (!collapseEmptyShifts || props.status !== "ready") {
    const selected = props.rangeSelection?.value;
    const visible = props.events.filter(
      (event) => event.date >= range.from && event.date <= range.through,
    );
    const times = [
      "08:00",
      "22:00",
      ...visible.flatMap((event) => [event.startTime, event.endTime]),
      ...(selected ? [selected.startTime, selected.endTime] : []),
    ].toSorted();
    return <ScheduleCalendar {...props} hours={{ start: times[0]!, end: times.at(-1)! }} />;
  }
  if (classes.length === 0) {
    return (
      <div className={styles.emptyCalendar} role="status">
        Nenhuma aula deste professor neste período. Escolha outro dia ou professor.
      </div>
    );
  }
  const windows: Window[] = [];
  shifts.forEach((shift, index) => {
    if (!classes.some((event) => event.startTime < shift.end && event.endTime > shift.start))
      return;
    const previous = windows.at(-1);
    if (previous && previous.lastIndex === index - 1) {
      previous.end = shift.end;
      previous.labels.push(shift.label);
      previous.lastIndex = index;
    } else {
      windows.push({ ...shift, labels: [shift.label], lastIndex: index });
    }
  });
  // Preserve unusual class times instead of silently hiding existing meetings.
  const earliest = classes.map((event) => event.startTime).toSorted()[0]!;
  const latest = classes
    .map((event) => event.endTime)
    .toSorted()
    .at(-1)!;
  if (windows.length === 0) {
    windows.push({ start: earliest, end: latest, labels: ["Aulas"], lastIndex: 0 });
  } else {
    windows[0]!.start = earliest < windows[0]!.start ? earliest : windows[0]!.start;
    const last = windows.at(-1)!;
    last.end = latest > last.end ? latest : last.end;
    // A class crossing a collapsed gap must retain its complete time interval.
    for (let index = windows.length - 1; index > 0; index--) {
      const before = windows[index - 1]!;
      const after = windows[index]!;
      if (classes.some((event) => event.startTime < after.start && event.endTime > before.end)) {
        before.end = after.end;
        before.labels.push(...after.labels);
        windows.splice(index, 1);
      }
    }
  }
  if (windows.length === 1) {
    return <ScheduleCalendar {...props} hours={windows[0]!} />;
  }
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
