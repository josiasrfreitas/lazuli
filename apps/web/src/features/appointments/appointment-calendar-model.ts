import type { CalendarEvent } from "@lazuli/ui";
const shifts = [
  { start: "08:00", end: "12:00", label: "Manhã" },
  { start: "13:00", end: "18:00", label: "Tarde" },
  { start: "18:00", end: "22:00", label: "Noite" },
];
export type AppointmentWindow = { start: string; end: string; labels: string[]; lastIndex: number };

export function appointmentWindows(classes: CalendarEvent[]): AppointmentWindow[] {
  const windows: AppointmentWindow[] = [];
  for (const [index, shift] of shifts.entries()) {
    if (!classes.some((event) => event.startTime < shift.end && event.endTime > shift.start))
      continue;
    const previous = windows.at(-1);
    if (previous && previous.lastIndex === index - 1) {
      previous.end = shift.end;
      previous.labels.push(shift.label);
      previous.lastIndex = index;
    } else windows.push({ ...shift, labels: [shift.label], lastIndex: index });
  }
  extendWindowBounds(windows, classes);
  mergeCrossingWindows(windows, classes);
  return windows;
}
function extendWindowBounds(windows: AppointmentWindow[], classes: CalendarEvent[]): void {
  if (classes.length === 0) return;
  const earliest = classes.map((event) => event.startTime).toSorted()[0]!;
  const latest = classes
    .map((event) => event.endTime)
    .toSorted()
    .at(-1)!;
  const first = windows[0];
  if (first) {
    if (earliest < first.start) first.start = earliest;
    const last = windows.at(-1)!;
    if (latest > last.end) last.end = latest;
  } else windows.push({ start: earliest, end: latest, labels: ["Aulas"], lastIndex: 0 });
}
function mergeCrossingWindows(windows: AppointmentWindow[], classes: CalendarEvent[]): void {
  // A class crossing a collapsed gap must retain its complete time interval.
  for (let index = windows.length - 1; index > 0; index--) {
    const before = windows.at(index - 1)!;
    const after = windows.at(index)!;
    if (classes.some((event) => event.startTime < after.start && event.endTime > before.end)) {
      before.end = after.end;
      before.labels.push(...after.labels);
      windows.splice(index, 1);
    }
  }
}
