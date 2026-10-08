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

export function formatClassSchedule(
  slots: readonly { weekday: string; startTime: Date; endTime: Date }[],
): string {
  return slots
    .map(
      (slot) =>
        `${WEEKDAYS[slot.weekday] ?? slot.weekday} ${slot.startTime.toISOString().slice(TIME_START, TIME_END)}–${slot.endTime.toISOString().slice(TIME_START, TIME_END)}`,
    )
    .join(", ");
}
