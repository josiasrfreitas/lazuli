export function formatScheduleType(value: "REGULAR" | "PERSONALIZED"): string {
  return value === "REGULAR" ? "Regular" : "PPT";
}

export function formatFormat(value: "IN_PERSON" | "ONLINE"): string {
  return value === "IN_PERSON" ? "Presencial" : "Online";
}

const WEEKDAYS: Record<string, string> = {
  MONDAY: "Seg",
  TUESDAY: "Ter",
  WEDNESDAY: "Qua",
  THURSDAY: "Qui",
  FRIDAY: "Sex",
  SATURDAY: "Sáb",
  SUNDAY: "Dom",
};

const WEEKDAY_CODES: Record<string, string> = {
  SUNDAY: "1",
  MONDAY: "2",
  TUESDAY: "3",
  WEDNESDAY: "4",
  THURSDAY: "5",
  FRIDAY: "6",
  SATURDAY: "7",
};

const TIME_START = 11;
const TIME_END = 16;

export function formatClassScheduleTime(
  slots: readonly { weekday: string; startTime: Date; endTime: Date }[],
): string {
  return slots
    .map(
      (slot) =>
        `${WEEKDAYS[slot.weekday] ?? slot.weekday} ${slot.startTime.toISOString().slice(TIME_START, TIME_END)}–${slot.endTime.toISOString().slice(TIME_START, TIME_END)}`,
    )
    .join(", ");
}

export type ScheduleSlot = { weekday: string; startTime: Date; endTime: Date };
const MINUTES_PER_HOUR = 60;
const SHIFTS = [
  { code: "M", start: 360, end: 720 },
  { code: "T", start: 720, end: 1080 },
  { code: "N", start: 1080, end: 1440 },
] as const;

function minutesOfDay(time: Date): number {
  return time.getUTCHours() * MINUTES_PER_HOUR + time.getUTCMinutes();
}

function scheduleBlocks(slot: ScheduleSlot): string {
  const start = minutesOfDay(slot.startTime);
  const end = minutesOfDay(slot.endTime);
  // Preserve exact times for schedules outside the agreed daytime shifts.
  if (start < SHIFTS[0].start || end <= start) {
    return `${slot.startTime.toISOString().slice(TIME_START, TIME_END)}–${slot.endTime.toISOString().slice(TIME_START, TIME_END)}`;
  }
  return SHIFTS.flatMap((shift) => {
    if (start >= shift.end || end <= shift.start) return [];
    const first = Math.floor((Math.max(start, shift.start) - shift.start) / MINUTES_PER_HOUR) + 1;
    const last = Math.ceil((Math.min(end, shift.end) - shift.start) / MINUTES_PER_HOUR);
    return [
      first === last ? `${shift.code}${first}` : `${shift.code}${first}–${shift.code}${last}`,
    ];
  }).join(" ");
}

export function formatClassSchedule(slots: readonly ScheduleSlot[]): string {
  const groups = new Map<string, { days: string[]; blocks: string }>();
  for (const slot of slots) {
    const key = `${minutesOfDay(slot.startTime)}:${minutesOfDay(slot.endTime)}`;
    const group = groups.get(key) ?? { days: [], blocks: scheduleBlocks(slot) };
    const day = WEEKDAY_CODES[slot.weekday] ?? slot.weekday;
    if (!group.days.includes(day)) group.days.push(day);
    groups.set(key, group);
  }
  return [...groups.values()].map((group) => scheduleCode(group)).join(", ");
}

function scheduleCode({ days, blocks }: { days: string[]; blocks: string }): string {
  const endpoints = blocks.split(/[– ]/u);
  const first = endpoints[0] ?? "";
  const last = endpoints.at(-1) ?? first;
  if (!/^[MTN]/u.test(first)) return `${days.join("/")} ${blocks}`;
  const start = `${days[0]}${first}`;
  const end = `${days.at(-1)}${last}`;
  // The compact label summarizes endpoints; the tooltip lists every exact meeting.
  if (days.length > 2) return days.map((day) => `${day}${first}-${day}${last}`).join(", ");
  return start === end ? start : `${start}-${end}`;
}
