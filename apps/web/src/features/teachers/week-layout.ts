import type { Meeting } from "./meeting-dialog";
const DAY_START_HOUR = 7;
const DAY_END_HOUR = 22;

export type MeetingGroup = { start: string; end: string; meetings: Meeting[] };
export function dayGroups(meetings: Meeting[], wholeHours = false): MeetingGroup[] {
  const groups: MeetingGroup[] = [];
  for (const meeting of [...meetings].toSorted((left, right) =>
    left.startTime.localeCompare(right.startTime),
  )) {
    const start = wholeHours ? `${meeting.startTime.slice(0, 2)}:00` : meeting.startTime;
    const end =
      wholeHours && !meeting.endTime.endsWith(":00")
        ? `${String(Number(meeting.endTime.slice(0, 2)) + 1).padStart(2, "0")}:00`
        : meeting.endTime;
    const last = groups.at(-1);
    if (last && start < last.end) {
      last.meetings.push(meeting);
      if (end > last.end) last.end = end;
    } else groups.push({ start, end, meetings: [meeting] });
  }
  return groups;
}

/** Keep a full teaching day visible, extending it for commitments outside that window. */
export function weekBoundaries(meetings: Meeting[]): string[] {
  const startHour = Math.min(
    DAY_START_HOUR,
    ...meetings.map((meeting) => Number(meeting.startTime.slice(0, 2))),
  );
  const endHour = Math.max(
    DAY_END_HOUR,
    ...meetings.map((meeting) => {
      const [hour, minute] = meeting.endTime.split(":").map(Number);
      return (hour ?? 0) + ((minute ?? 0) > 0 ? 1 : 0);
    }),
  );
  const hours = Array.from(
    { length: endHour - startHour + 1 },
    (_unused, index) => `${String(startHour + index).padStart(2, "0")}:00`,
  );
  return hours;
}

/** Retain all hourly cells within shifts that contain a lesson anywhere in the week. */
export function visibleWeekSlots(meetings: Meeting[]): Array<{ start: string; end: string }> {
  const boundaries = weekBoundaries(meetings);
  const shifts = [
    { start: boundaries[0] ?? "07:00", end: "12:00" },
    { start: "12:00", end: "19:00" },
    { start: "19:00", end: boundaries.at(-1) ?? "22:00" },
  ].filter((shift) =>
    meetings.some((meeting) => meeting.startTime < shift.end && meeting.endTime > shift.start),
  );
  return boundaries
    .slice(0, -1)
    .flatMap((start, index) =>
      shifts.some((shift) => start >= shift.start && start < shift.end)
        ? [{ start, end: boundaries[index + 1]! }]
        : [],
    );
}
