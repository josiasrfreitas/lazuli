import { addDays, stableUuid, utcDate } from "../../packages/db/src/seed-dev-support.js";
import { sessionEndInstant } from "../../packages/domain/src/session-time.js";
import type { DevWeekday } from "../../packages/db/src/seed-dev-data.js";
import { seedStudentIndex } from "./student-fixtures.js";
const SATURDAY = 6;

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

const slots = (
  weekdays: DevWeekday[],
  time: { startTime: string; endTime: string },
): OrganizationSlot[] =>
  weekdays.map((weekday) => ({ weekday, startTime: time.startTime, endTime: time.endTime }));
const MW: DevWeekday[] = ["MONDAY", "WEDNESDAY"];
const TT: DevWeekday[] = ["TUESDAY", "THURSDAY"];
const SCHEDULE_CONFLICT_STUDENTS = {
  pptSecondSlot: seedStudentIndex("school-student-136"),
  regularC2: seedStudentIndex("occupancy-T2A-6"),
  pptWithoutTeacher: seedStudentIndex("school-student-144"),
};

/** Every new group obeys the public 120-minute weekly limit; original classes are untouched. */
export const ORGANIZATION_GROUPS: OrganizationGroup[] = [
  {
    key: "mwb",
    name: "MWB · tarde",
    scheduleType: "REGULAR",
    format: "IN_PERSON",
    stageCode: "MWB",
    teacherKey: "camila",
    slots: slots(MW, { startTime: "14:00", endTime: "15:00" }),
    published: [seedStudentIndex("carla"), seedStudentIndex("felipe")],
    pending: [seedStudentIndex("ana"), seedStudentIndex("davi")],
  },
  {
    key: "s3",
    name: "S3 · online",
    scheduleType: "REGULAR",
    format: "ONLINE",
    stageCode: "S3",
    teacherKey: "camila",
    slots: slots(TT, { startTime: "19:00", endTime: "20:00" }),
    published: [
      seedStudentIndex("school-student-213"),
      seedStudentIndex("school-student-216"),
      seedStudentIndex("school-student-219"),
      seedStudentIndex("school-student-220"),
    ],
    pending: [
      seedStudentIndex("school-student-211"),
      seedStudentIndex("school-student-214"),
      seedStudentIndex("school-student-217"),
    ],
  },
  {
    key: "ppt-a",
    name: "PPT · primeira faixa da tarde",
    scheduleType: "PERSONALIZED",
    format: "IN_PERSON",
    stageCode: null,
    teacherKey: "renata",
    slots: slots(TT, { startTime: "16:00", endTime: "17:00" }),
    published: [
      seedStudentIndex("school-student-129"),
      seedStudentIndex("school-student-130"),
      seedStudentIndex("school-student-132"),
    ],
    pending: [seedStudentIndex("school-student-135"), seedStudentIndex("school-student-221")],
  },
  {
    key: "ppt-b",
    name: "PPT · segunda faixa da tarde",
    scheduleType: "PERSONALIZED",
    format: "IN_PERSON",
    stageCode: null,
    teacherKey: "renata",
    slots: slots(TT, { startTime: "17:00", endTime: "18:00" }),
    published: [
      seedStudentIndex("school-student-131"),
      seedStudentIndex("school-student-133"),
      seedStudentIndex("school-student-134"),
    ],
    pending: [SCHEDULE_CONFLICT_STUDENTS.pptSecondSlot, seedStudentIndex("school-student-224")],
  },
  {
    key: "mwy-repeat",
    name: "MWY · retomada do estágio",
    scheduleType: "REGULAR",
    format: "IN_PERSON",
    stageCode: "MWY",
    teacherKey: "rafael",
    slots: slots(MW, { startTime: "14:00", endTime: "15:00" }),
    published: [],
    pending: [seedStudentIndex("bruno")],
  },
  {
    key: "c2",
    name: "C2 · horário a conciliar",
    scheduleType: "REGULAR",
    format: "IN_PERSON",
    stageCode: "C2",
    teacherKey: "rafael",
    slots: slots(MW, { startTime: "14:00", endTime: "15:00" }),
    published: [],
    pending: [SCHEDULE_CONFLICT_STUDENTS.regularC2],
  },
  {
    key: "e1",
    name: "E1 · novas entradas",
    scheduleType: "REGULAR",
    format: "IN_PERSON",
    stageCode: "E1",
    teacherKey: "juliana",
    slots: slots(TT, { startTime: "19:00", endTime: "20:00" }),
    published: [],
    pending: [
      seedStudentIndex("school-student-222"),
      seedStudentIndex("school-student-223"),
      seedStudentIndex("school-student-225"),
      seedStudentIndex("school-student-226"),
      seedStudentIndex("school-student-231"),
      seedStudentIndex("school-student-232"),
    ],
  },
  {
    key: "ppt-c",
    name: "PPT · docente a definir",
    scheduleType: "PERSONALIZED",
    format: "IN_PERSON",
    stageCode: null,
    teacherKey: null,
    slots: slots(MW, { startTime: "16:00", endTime: "17:00" }),
    published: [],
    pending: [seedStudentIndex("school-student-141"), SCHEDULE_CONFLICT_STUDENTS.pptWithoutTeacher],
  },
];

export type AvailabilityProfile =
  | "CURRENT"
  | "EXPIRED"
  | "EXPIRES_BEFORE_ENTRY"
  | "INCOMPATIBLE"
  | "UNKNOWN";
const EXPIRED = new Set([
  seedStudentIndex("davi"),
  seedStudentIndex("school-student-217"),
  seedStudentIndex("school-student-141"),
]);
const EXPIRES_BEFORE_ENTRY = new Set([
  seedStudentIndex("school-student-135"),
  seedStudentIndex("school-student-223"),
  seedStudentIndex("school-student-232"),
]);
const INCOMPATIBLE = new Set([
  SCHEDULE_CONFLICT_STUDENTS.pptSecondSlot,
  SCHEDULE_CONFLICT_STUDENTS.regularC2,
  seedStudentIndex("school-student-224"),
  SCHEDULE_CONFLICT_STUDENTS.pptWithoutTeacher,
]);
const UNKNOWN = new Set([
  seedStudentIndex("school-student-225"),
  seedStudentIndex("school-student-226"),
]);

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
  if (index === SCHEDULE_CONFLICT_STUDENTS.pptSecondSlot)
    return slots(TT, { startTime: "15:00", endTime: "17:00" });
  if (index === SCHEDULE_CONFLICT_STUDENTS.regularC2)
    return slots(TT, { startTime: "14:00", endTime: "16:00" });
  if (index === SCHEDULE_CONFLICT_STUDENTS.pptWithoutTeacher)
    return slots(MW, { startTime: "14:00", endTime: "15:00" });
  return (
    group?.slots.map((slot) => ({ ...slot })) ?? slots(MW, { startTime: "14:00", endTime: "17:00" })
  );
}

export function organizationId(kind: string, input: { semesterName: string; key: string }): string {
  return stableUuid([`semester-${kind}`, input.semesterName, input.key]);
}

/** Authored facts precede today; future dates belong only to operational intentions. */
export function organizationInstant(todayIso: string, daysAgo: number): Date {
  let date = addDays(utcDate(todayIso), -daysAgo);
  while (date.getUTCDay() === 0 || date.getUTCDay() === SATURDAY) date = addDays(date, -1);
  return sessionEndInstant({ date, endTime: "15:00" });
}
