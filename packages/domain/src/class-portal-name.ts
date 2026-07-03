/** Weekday order for choosing the primary slot in multi-slot REGULAR classes. */
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
  /** Disambiguation suffix when active portalClassName would collide (-1, -2, …). */
  sequence: number;
};

const WEEKDAY_PORTAL_ABBREV: Record<Weekday, string> = {
  MONDAY: "SEG",
  TUESDAY: "TER",
  WEDNESDAY: "QUA",
  THURSDAY: "QUI",
  FRIDAY: "SEX",
  SATURDAY: "SAB",
  SUNDAY: "DOM",
};

/**
 * Interim REGULAR Portal class-name generator (PRD §5, D-0021). Exact Portal
 * semantics for 1S/2S and trailing suffix remain open until GRE-13 walkthrough.
 * Multi-slot classes use the earliest weekday slot, then earliest start time.
 */
export function generateRegularPortalClassName(
  input: GenerateRegularPortalClassNameInput,
): string {
  const primarySlot = [...input.slots].sort(compareSlots)[0];
  if (primarySlot === undefined) {
    throw new Error("At least one schedule slot is required to derive a Portal class name.");
  }

  const semesterSuffix = parseSemesterSuffix(input.semesterName);
  const yearSuffix = String(input.year % 100).padStart(2, "0");

  return [
    "REG",
    input.stageInternalCode,
    WEEKDAY_PORTAL_ABBREV[primarySlot.weekday],
    `${primarySlot.startTime}/${primarySlot.endTime}`,
    `${semesterSuffix}/${yearSuffix}-${input.sequence}`,
  ].join("-").replace(/^REG-/, "REG/");
}

function compareSlots(left: PortalClassNameSlot, right: PortalClassNameSlot): number {
  const weekdayDelta =
    WEEKDAY_ORDER.indexOf(left.weekday) - WEEKDAY_ORDER.indexOf(right.weekday);
  if (weekdayDelta !== 0) {
    return weekdayDelta;
  }

  return left.startTime.localeCompare(right.startTime);
}

/** Maps semester names like 2026.1 → 1S (PRD interim convention). */
function parseSemesterSuffix(semesterName: string): string {
  const match = /\.(\d+)$/.exec(semesterName);
  if (match?.[1] === undefined) {
    throw new Error(`Semester name "${semesterName}" must end with .N to derive the Portal suffix.`);
  }

  return `${match[1]}S`;
}
