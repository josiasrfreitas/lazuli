const MORNING_START_HOUR = 7;
const AFTERNOON_START_HOUR = 12;
const EVENING_START_HOUR = 18;
const EVENING_END_HOUR = 22;
const MINUTES_PER_HOUR = 60;
const SHIFTS = [
  { start: MORNING_START_HOUR * MINUTES_PER_HOUR, end: AFTERNOON_START_HOUR * MINUTES_PER_HOUR },
  { start: AFTERNOON_START_HOUR * MINUTES_PER_HOUR, end: EVENING_START_HOUR * MINUTES_PER_HOUR },
  { start: EVENING_START_HOUR * MINUTES_PER_HOUR, end: EVENING_END_HOUR * MINUTES_PER_HOUR },
];

function minutes(time: Date): number {
  return time.getUTCHours() * MINUTES_PER_HOUR + time.getUTCMinutes();
}

function clock(value: number): string {
  return `${String(Math.floor(value / MINUTES_PER_HOUR)).padStart(2, "0")}:${String(value % MINUTES_PER_HOUR).padStart(2, "0")}`;
}

/** Show whole occupied shifts, extending the window for lessons outside school hours. */
export function occurrenceCalendarHours(
  sessions: readonly { startTime: Date; endTime: Date }[],
): { start: string; end: string } | undefined {
  if (sessions.length === 0) return undefined;
  const first = Math.min(...sessions.map((session) => minutes(session.startTime)));
  const last = Math.max(...sessions.map((session) => minutes(session.endTime)));
  const occupied = SHIFTS.filter((shift) =>
    sessions.some(
      (session) => minutes(session.startTime) < shift.end && minutes(session.endTime) > shift.start,
    ),
  );
  // An out-of-hours lesson still gets at least the nearest complete shift.
  const visible =
    occupied.length > 0 ? occupied : [last <= SHIFTS[0]!.start ? SHIFTS[0]! : SHIFTS[2]!];
  const start = Math.min(
    visible[0]!.start,
    Math.floor(first / MINUTES_PER_HOUR) * MINUTES_PER_HOUR,
  );
  const end = Math.max(visible.at(-1)!.end, Math.ceil(last / MINUTES_PER_HOUR) * MINUTES_PER_HOUR);
  return { start: clock(start), end: clock(end) };
}
