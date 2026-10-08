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
export function formatClassSchedule(slots: readonly ScheduleSlot[]): string {
  const groups = new Map<string, string[]>();
  for (const slot of slots) {
    const start = slot.startTime.toISOString().slice(TIME_START, TIME_END);
    const end = slot.endTime.toISOString().slice(TIME_START, TIME_END);
    const interval = `${start} - ${end}`;
    const days = groups.get(interval) ?? [];
    const day = WEEKDAYS[slot.weekday] ?? slot.weekday;
    if (!days.includes(day)) days.push(day);
    groups.set(interval, days);
  }
  return [...groups].map(([interval, days]) => `${days.join("/")} • ${interval}`).join(", ");
}

const OCCUPANCY_WARNING_RATIO = 0.5;
const OCCUPANCY_HIGH_RATIO = 0.8;

export function classOccupancyIndicator(
  occupancy: number,
  capacity: number,
): { variant: "success" | "warning" | "destructive"; label: string } {
  const ratio = occupancy / capacity;
  if (ratio >= OCCUPANCY_HIGH_RATIO) {
    return { variant: "destructive", label: "Ocupação alta" } as const;
  }
  if (ratio >= OCCUPANCY_WARNING_RATIO) {
    return { variant: "warning", label: "Ocupação moderada" } as const;
  }
  return { variant: "success", label: "Ocupação baixa" } as const;
}
