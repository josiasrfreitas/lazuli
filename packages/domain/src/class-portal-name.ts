/** Weekday order for choosing the primary slot in multi-slot classes. */
const WEEKDAY_ORDER = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
] as const;

export type Weekday = (typeof WEEKDAY_ORDER)[number];

export type PortalClassNameSlot = {
  weekday: Weekday;
  /** HH:mm in America/Sao_Paulo wall time. */
  startTime: string;
  endTime: string;
};

export type GenerateRegularPortalClassNameInput = {
  stageInternalCode: string;
  slots: readonly PortalClassNameSlot[];
  semesterName: string;
  year: number;
  /** Disambiguation suffix when active portalClassName would collide (· 2, · 3, …). */
  sequence: number;
};

/** Human-facing class labels use modality and the first meeting's start time. */
export function generateRegularPortalClassName(input: GenerateRegularPortalClassNameInput): string {
  return generatePortalClassName(input, "REG");
}

export function generatePersonalizedPortalClassName(
  input: Omit<GenerateRegularPortalClassNameInput, "stageInternalCode">,
): string {
  return generatePortalClassName(input, "PPT");
}

function generatePortalClassName(
  input: Omit<GenerateRegularPortalClassNameInput, "stageInternalCode">,
  prefix: string,
): string {
  const primarySlot = selectPrimarySlot(input.slots);
  if (primarySlot === undefined) {
    throw new Error("At least one schedule slot is required to derive a Portal class name.");
  }
  const suffix = input.sequence === 1 ? "" : ` · ${input.sequence}`;
  return `${prefix} ${primarySlot.startTime}${suffix}`;
}

function selectPrimarySlot(slots: readonly PortalClassNameSlot[]): PortalClassNameSlot | undefined {
  let selected: PortalClassNameSlot | undefined;

  for (const slot of slots) {
    if (selected === undefined || compareSlots(slot, selected) < 0) {
      selected = slot;
    }
  }

  return selected;
}

function compareSlots(left: PortalClassNameSlot, right: PortalClassNameSlot): number {
  const weekdayDelta = WEEKDAY_ORDER.indexOf(left.weekday) - WEEKDAY_ORDER.indexOf(right.weekday);
  if (weekdayDelta !== 0) {
    return weekdayDelta;
  }

  return left.startTime.localeCompare(right.startTime);
}
