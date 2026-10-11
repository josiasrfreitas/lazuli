const ISO_DATE_LENGTH = 10;
const MINUTES_PER_HOUR = 60;

const DAY_MS = 86_400_000;
const WEEKDAYS = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
] as const;
export type TeacherWeekday = (typeof WEEKDAYS)[number];
export type TeacherCommitment = {
  classId: string;
  slotId: string | null;
  sessionId?: string | null;
  date: string;
  startTime: string;
  endTime: string;
  usualTeacherId: string | null;
  substituteTeacherId: string | null;
  cancelled: boolean;
  requiresCoverage?: boolean;
};

export function weekDates(monday: string): string[] {
  const start = Date.parse(`${monday}T00:00:00.000Z`);
  return Array.from({ length: 7 }, (_unused, index) =>
    new Date(start + index * DAY_MS).toISOString().slice(0, ISO_DATE_LENGTH),
  );
}

export function weekdayOf(date: string): TeacherWeekday {
  return WEEKDAYS[new Date(`${date}T00:00:00.000Z`).getUTCDay()] ?? "SUNDAY";
}

export function effectiveTeacherId(input: EffectiveTeacherIdInput): string | null {
  const assignment = input.assignments
    .filter((item) => item.effectiveDate <= input.date)
    .toSorted((left, right) => right.effectiveDate.localeCompare(left.effectiveDate))[0];
  const id = assignment?.teacherId ?? input.initialTeacherId;
  const departure = input.departureDates.get(id);
  return departure !== null && departure !== undefined && input.date >= departure ? null : id;
}

export function intervalsOverlap(
  left: IntervalsOverlapInput,
  right: IntervalsOverlapContext,
): boolean {
  return left.startTime < right.endTime && right.startTime < left.endTime;
}

export function responsibleTeacherId(commitment: TeacherCommitment): string | null {
  return (
    commitment.substituteTeacherId ??
    (commitment.requiresCoverage ? null : commitment.usualTeacherId)
  );
}

export function teachingMinutes(
  commitment: Pick<TeacherCommitment, "startTime" | "endTime"> & { cancelled?: boolean },
): number {
  if (commitment.cancelled) return 0;
  const [startHour = 0, startMinute = 0] = commitment.startTime.split(":").map(Number);
  const [endHour = 0, endMinute = 0] = commitment.endTime.split(":").map(Number);
  return endHour * MINUTES_PER_HOUR + endMinute - startHour * MINUTES_PER_HOUR - startMinute;
}

export function teacherWeekMinutes(
  commitments: readonly TeacherCommitment[],
  teacherId: string,
): number {
  return commitments.reduce(
    (sum, item) => sum + (responsibleTeacherId(item) === teacherId ? teachingMinutes(item) : 0),
    0,
  );
}

type EffectiveTeacherIdInput = {
  initialTeacherId: string;
  assignments: readonly { teacherId: string; effectiveDate: string }[];
  departureDates: ReadonlyMap<string, string | null>;
  date: string;
};
type IntervalsOverlapInput = { startTime: string; endTime: string };
type IntervalsOverlapContext = { startTime: string; endTime: string };
