const WEEKDAY_LABELS = {
  MONDAY: "SEG",
  TUESDAY: "TER",
  WEDNESDAY: "QUA",
  THURSDAY: "QUI",
  FRIDAY: "SEX",
  SATURDAY: "SÁB",
  SUNDAY: "DOM",
} as const;
export type Weekday = keyof typeof WEEKDAY_LABELS;
const weekdayOrder = Object.keys(WEEKDAY_LABELS) as Weekday[];
const MAX_LABEL_LENGTH_WITH_TEACHER = 80;

export type PortalClassNameSlot = {
  weekday: Weekday;
  /** HH:mm in America/Sao_Paulo wall time. */
  startTime: string;
  endTime: string;
};

export type ClassNameInput = {
  scheduleType: "REGULAR" | "PERSONALIZED";
  stageInternalCode?: string | null | undefined;
  slots: readonly PortalClassNameSlot[];
  teacherName?: string | null | undefined;
};

export function generatePortalClassName(input: ClassNameInput, sequence = 1): string {
  const { scheduleType, slots, stageInternalCode, teacherName } = input;
  if (!slots.length) throw new Error("A class name requires at least one schedule slot.");

  const ranges = new Map<string, Set<string>>();
  for (const slot of slots.toSorted(compareSlots)) {
    const range = `${slot.startTime}-${slot.endTime}`;
    const days = ranges.get(range) ?? new Set<string>();
    days.add(WEEKDAY_LABELS[slot.weekday]);
    ranges.set(range, days);
  }
  const schedule = [...ranges].map(([range, days]) => [...days, range].join("/")).join(" + ");
  const prefix = scheduleType === "REGULAR" ? ["REG", stageInternalCode] : ["PPT"];
  const base = [...prefix, schedule].filter(Boolean).join(" ");
  const suffix = sequence > 1 ? ` · ${sequence}` : "";
  const teacher = teacherName?.trim();
  if (teacher) {
    const fullName = `${base} ${teacher}${suffix}`;
    if (Array.from(fullName).length <= MAX_LABEL_LENGTH_WITH_TEACHER) return fullName;
  }
  return base + suffix;
}

function compareSlots(left: PortalClassNameSlot, right: PortalClassNameSlot): number {
  return (
    weekdayOrder.indexOf(left.weekday) - weekdayOrder.indexOf(right.weekday) ||
    left.startTime.localeCompare(right.startTime) ||
    left.endTime.localeCompare(right.endTime)
  );
}
