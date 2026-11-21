const WEEKDAY_LABELS = {
  MONDAY: "SEG",
  TUESDAY: "TER",
  WEDNESDAY: "QUA",
  THURSDAY: "QUI",
  FRIDAY: "SEX",
  SATURDAY: "SAB",
  SUNDAY: "DOM",
} as const;
export type Weekday = keyof typeof WEEKDAY_LABELS;
const weekdayOrder = Object.keys(WEEKDAY_LABELS) as Weekday[];

export type PortalClassNameSlot = {
  weekday: Weekday;
  /** HH:mm in America/Sao_Paulo wall time. */
  startTime: string;
  endTime: string;
};

export type ClassNameInput = {
  scheduleType: "REGULAR" | "PERSONALIZED";
  format: "IN_PERSON" | "ONLINE";
  trackName?: string | null | undefined;
  stageInternalCode?: string | null | undefined;
  slots: readonly PortalClassNameSlot[];
  teacherName?: string | null | undefined;
};

export function generatePortalClassName(input: ClassNameInput, sequence = 1): string {
  const { scheduleType, format, slots } = input;
  const personalized = scheduleType === "PERSONALIZED";
  const prefix = classPrefix(input, personalized);
  const times = new Map<string, Set<string>>();
  for (const slot of slots.toSorted(compareSlots)) {
    const days = times.get(slot.startTime) ?? new Set<string>();
    days.add(WEEKDAY_LABELS[slot.weekday]);
    times.set(slot.startTime, days);
  }
  const shortHour = !personalized && format === "IN_PERSON" && slots.length === 1;
  const schedule = [...times].map(([time, days]) => {
    const start = shortHour ? time.replace(/:00$/u, "") : time;
    return `${[...days].join("/")}-${start}`;
  });
  const label = [prefix, schedule.join("+")].filter(Boolean).join("-");
  return sequence > 1 ? `${label} · ${sequence}` : label;
}

function classPrefix(input: ClassNameInput, personalized: boolean): string {
  const { format } = input;
  const code = input.stageInternalCode?.trim().toUpperCase() || "REG";
  const book = input.trackName === "Teens Connect" && /^C\d+$/u.test(code) ? `T${code}` : code;
  const teacher = input.teacherName?.trim().split(/\s+/u)[0]?.toLocaleUpperCase("pt-BR");
  const qualifier = format === "ONLINE" ? "ON" : personalized && teacher;
  return [personalized ? "PPT" : book, qualifier].filter(Boolean).join("/");
}

function compareSlots(left: PortalClassNameSlot, right: PortalClassNameSlot): number {
  return (
    weekdayOrder.indexOf(left.weekday) - weekdayOrder.indexOf(right.weekday) ||
    left.startTime.localeCompare(right.startTime) ||
    left.endTime.localeCompare(right.endTime)
  );
}
