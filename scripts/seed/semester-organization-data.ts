import { addDays, stableUuid, utcDate } from "../../packages/db/src/seed-dev-support.js";
import { sessionEndInstant } from "../../packages/domain/src/session-time.js";
import type { DevWeekday } from "../../packages/db/src/seed-dev-data.js";

export type OrganizationSlot = { weekday: DevWeekday; startTime: string; endTime: string };
export type OrganizationGroup = {
  key: string;
  name: string;
  scheduleType: "REGULAR" | "PERSONALIZED";
  format: "IN_PERSON" | "ONLINE";
  stageCode: string | null;
  teacherKey: string | null;
  slots: OrganizationSlot[];
  published: number[];
  pending: number[];
};

const slots = (weekdays: DevWeekday[], startTime: string, endTime: string): OrganizationSlot[] =>
  weekdays.map((weekday) => ({ weekday, startTime, endTime }));
const MW: DevWeekday[] = ["MONDAY", "WEDNESDAY"];
const TT: DevWeekday[] = ["TUESDAY", "THURSDAY"];

/** Every new group obeys the public 120-minute weekly limit; original classes are untouched. */
export const ORGANIZATION_GROUPS: OrganizationGroup[] = [
  {
    key: "mwb",
    name: "MWB · tarde",
    scheduleType: "REGULAR",
    format: "IN_PERSON",
    stageCode: "MWB",
    teacherKey: "camila",
    slots: slots(MW, "14:00", "15:00"),
    published: [2, 5],
    pending: [0, 3],
  },
  {
    key: "s3",
    name: "S3 · online",
    scheduleType: "REGULAR",
    format: "ONLINE",
    stageCode: "S3",
    teacherKey: "camila",
    slots: slots(TT, "19:00", "20:00"),
    published: [212, 215, 218, 219],
    pending: [210, 213, 216],
  },
  {
    key: "ppt-a",
    name: "PPT · primeira faixa da tarde",
    scheduleType: "PERSONALIZED",
    format: "IN_PERSON",
    stageCode: null,
    teacherKey: "renata",
    slots: slots(TT, "16:00", "17:00"),
    published: [128, 129, 131],
    pending: [134, 220],
  },
  {
    key: "ppt-b",
    name: "PPT · segunda faixa da tarde",
    scheduleType: "PERSONALIZED",
    format: "IN_PERSON",
    stageCode: null,
    teacherKey: "renata",
    slots: slots(TT, "17:00", "18:00"),
    published: [130, 132, 133],
    pending: [135, 223],
  },
  {
    key: "mwy-repeat",
    name: "MWY · retomada do estágio",
    scheduleType: "REGULAR",
    format: "IN_PERSON",
    stageCode: "MWY",
    teacherKey: "rafael",
    slots: slots(MW, "14:00", "15:00"),
    published: [],
    pending: [1],
  },
  {
    key: "c2",
    name: "C2 · horário a conciliar",
    scheduleType: "REGULAR",
    format: "IN_PERSON",
    stageCode: "C2",
    teacherKey: "rafael",
    slots: slots(MW, "14:00", "15:00"),
    published: [],
    pending: [40],
  },
  {
    key: "e1",
    name: "E1 · novas entradas",
    scheduleType: "REGULAR",
    format: "IN_PERSON",
    stageCode: "E1",
    teacherKey: "juliana",
    slots: slots(TT, "19:00", "20:00"),
    published: [],
    pending: [221, 222, 224, 225, 230, 231],
  },
  {
    key: "ppt-c",
    name: "PPT · docente a definir",
    scheduleType: "PERSONALIZED",
    format: "IN_PERSON",
    stageCode: null,
    teacherKey: null,
    slots: slots(MW, "16:00", "17:00"),
    published: [],
    pending: [140, 143],
  },
];

export type AvailabilityProfile =
  | "CURRENT"
  | "EXPIRED"
  | "EXPIRES_BEFORE_ENTRY"
  | "INCOMPATIBLE"
  | "UNKNOWN";
const EXPIRED = new Set([3, 216, 140]);
const EXPIRES_BEFORE_ENTRY = new Set([134, 222, 231]);
const INCOMPATIBLE = new Set([135, 40, 223, 143]);
const UNKNOWN = new Set([224, 225]);

export function availabilityProfile(index: number): AvailabilityProfile {
  if (EXPIRED.has(index)) return "EXPIRED";
  if (EXPIRES_BEFORE_ENTRY.has(index)) return "EXPIRES_BEFORE_ENTRY";
  if (INCOMPATIBLE.has(index)) return "INCOMPATIBLE";
  return UNKNOWN.has(index) ? "UNKNOWN" : "CURRENT";
}

export function availabilitySlots(
  index: number,
  group: OrganizationGroup | null,
): OrganizationSlot[] {
  if (index === 135) return slots(TT, "15:00", "17:00");
  if (index === 40) return slots(TT, "14:00", "16:00");
  if (index === 143) return slots(MW, "14:00", "15:00");
  return group?.slots.map((slot) => ({ ...slot })) ?? slots(MW, "14:00", "17:00");
}

export function organizationId(kind: string, semesterName: string, key: string): string {
  return stableUuid([`semester-${kind}`, semesterName, key]);
}

/** Authored facts precede today; future dates belong only to operational intentions. */
export function organizationInstant(todayIso: string, daysAgo: number): Date {
  let date = addDays(utcDate(todayIso), -daysAgo);
  while (date.getUTCDay() === 0 || date.getUTCDay() === 6) date = addDays(date, -1);
  return sessionEndInstant({ date, endTime: "15:00" });
}
