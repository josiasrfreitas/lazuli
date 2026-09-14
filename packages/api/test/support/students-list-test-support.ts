import { createCaller, type Context, type StaffUser } from "@lazuli/api";
import { db } from "@lazuli/db";

import { cleanFinanceOrdersDatabase } from "./finance-test-support.js";

/**
 * Fixture for `students.list`: one isolated namespace (prefix, catalog key, user
 * ids, and a Semester window no other db test uses) holding every case the
 * listing has to render — attendance below/above the minimum, "sem dados",
 * overdue vs settled vs no order, grouped statuses, and enough rows to paginate.
 */

export const PREFIX = "GRE-STL ";
export const NOW = new Date("2044-04-15T12:00:00.000Z");

export const CLASS_A_CODE = `${PREFIX}CLS-A`;
export const CLASS_B_CODE = `${PREFIX}CLS-B`;
export const TEACHER_A_NAME = `${PREFIX}Teacher One`;
export const TEACHER_B_NAME = `${PREFIX}Teacher Two`;
export const CLASS_A_SCHEDULE_LABEL = "Seg e Qua · 19:00";
export const CLASS_B_SCHEDULE_LABEL = "Sáb · 09:00";

export const OVERDUE_CENTS = 25_000;
export const SETTLED_CENTS = 30_000;
export const HELD_SESSIONS = 4;
export const ANA_PRESENT_COUNT = 3;
export const BRUNO_PRESENT_COUNT = 1;

const ADMIN_ID = "00000000-0000-0000-0000-000000644001";
const TEACHER_A_ID = "00000000-0000-0000-0000-000000644002";
const TEACHER_B_ID = "00000000-0000-0000-0000-000000644003";
const CATALOG_KEY = "gre644_students_list";
const STAGE_CODE = "GRE644STL";
const SEMESTER_START = new Date("2044-02-01T00:00:00.000Z");
const SEMESTER_END = new Date("2044-06-30T00:00:00.000Z");
const SESSION_DATES = [
  new Date("2044-03-02T00:00:00.000Z"),
  new Date("2044-03-09T00:00:00.000Z"),
  new Date("2044-03-16T00:00:00.000Z"),
  new Date("2044-03-23T00:00:00.000Z"),
];
const DUE_DATE = new Date("2044-03-10T00:00:00.000Z");
const PAID_DATE = new Date("2044-03-08T00:00:00.000Z");
const MINOR_BIRTH_DATE = new Date("2035-01-01T00:00:00.000Z");
const EIGHTEENTH_BIRTHDAY_BIRTH_DATE = new Date("2026-04-15T00:00:00.000Z");
const EVENING_START = new Date("1970-01-01T19:00:00.000Z");
const EVENING_END = new Date("1970-01-01T20:30:00.000Z");
const MORNING_START = new Date("1970-01-01T09:00:00.000Z");
const MORNING_END = new Date("1970-01-01T12:00:00.000Z");
const STUDENT_PHONE = "(11) 90000-0000";
const CLASS_CAPACITY = 20;
const CLASS_YEAR = 2044;
const DUE_DAY = 10;

export const ADMIN: StaffUser = {
  id: ADMIN_ID,
  name: "Admin de Teste",
  email: "gre644-students-list-admin@example.com",
  role: "ADMIN",
  isEnabled: true,
};

type StudentStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED" | "DROPPED";

type StudentSeed = {
  suffix: string;
  status: StudentStatus;
  classKey?: "A" | "B";
  presentCount?: number;
  finance?: "overdue" | "settled";
  birthDate?: Date;
  isMinor?: boolean;
};

/** Ordered by `fullName` exactly as the listing returns them. */
export const STUDENT_SEEDS: readonly StudentSeed[] = [
  { suffix: "Ana Attend", status: "ACTIVE", classKey: "A", presentCount: ANA_PRESENT_COUNT },
  { suffix: "Bruno Low", status: "ACTIVE", classKey: "A", presentCount: BRUNO_PRESENT_COUNT },
  { suffix: "Carla NoData", status: "ACTIVE", classKey: "B" },
  { suffix: "Davi NoClass", status: "ACTIVE", isMinor: true },
  { suffix: "Elisa Overdue", status: "ACTIVE", finance: "overdue" },
  { suffix: "Felipe Settled", status: "ACTIVE", finance: "settled" },
  { suffix: "Gabriel Suspended", status: "SUSPENDED" },
  { suffix: "Helena Dropped", status: "DROPPED" },
  { suffix: "Igor Inactive", status: "INACTIVE" },
  { suffix: "Joana Extra", status: "ACTIVE" },
  { suffix: "Karina Extra", status: "ACTIVE" },
  { suffix: "Lucas Extra", status: "ACTIVE" },
  { suffix: "Zoe Birthday", status: "ACTIVE", birthDate: EIGHTEENTH_BIRTHDAY_BIRTH_DATE },
];

export function caller(now: Date = NOW): ReturnType<typeof createCaller> {
  return createCaller(contextFor(now));
}

export function contextFor(now: Date): Context {
  return { db, now, staffUser: ADMIN };
}

export function fullNameOf(suffix: string): string {
  return `${PREFIX}${suffix}`;
}

export async function seedStudentsListFixture(): Promise<void> {
  await seedStaff();
  const stageId = await seedCatalog();
  const semesterId = await seedSemester();
  const classIds = await seedClasses(semesterId, stageId);
  const sessionIds = await seedSessions(classIds.classA);

  for (const seed of STUDENT_SEEDS) {
    await seedStudent({ seed, stageId, classIds, sessionIds });
  }
}

/** FK-safe teardown; the finance rows are removed by the shared prefix cleanup. */
export async function cleanStudentsListFixture(): Promise<void> {
  const byStudent = { enrollment: { student: { fullName: { startsWith: PREFIX } } } };
  await db.attendance.deleteMany({ where: byStudent });
  await db.pedagogicalProgress.deleteMany({ where: byStudent });
  await db.enrollment.deleteMany({ where: { student: { fullName: { startsWith: PREFIX } } } });
  await db.classSession.deleteMany({ where: { class: { internalCode: { startsWith: PREFIX } } } });
  await cleanFinanceOrdersDatabase(PREFIX);
  await db.guardian.deleteMany({ where: { fullName: { startsWith: PREFIX } } });
  await db.class.deleteMany({ where: { internalCode: { startsWith: PREFIX } } });
  await db.semester.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await db.stage.deleteMany({ where: { track: { productLine: { key: CATALOG_KEY } } } });
  await db.track.deleteMany({ where: { productLine: { key: CATALOG_KEY } } });
  await db.productLine.deleteMany({ where: { key: CATALOG_KEY } });
  await db.user.deleteMany({ where: { id: { in: [ADMIN_ID, TEACHER_A_ID, TEACHER_B_ID] } } });
}

async function seedStaff(): Promise<void> {
  const staff = [
    { id: ADMIN_ID, email: ADMIN.email, name: `${PREFIX}Admin`, role: "ADMIN" as const },
    {
      id: TEACHER_A_ID,
      email: "gre644-t1@example.com",
      name: TEACHER_A_NAME,
      role: "TEACHER" as const,
    },
    {
      id: TEACHER_B_ID,
      email: "gre644-t2@example.com",
      name: TEACHER_B_NAME,
      role: "TEACHER" as const,
    },
  ];

  for (const member of staff) {
    await db.user.upsert({
      where: { id: member.id },
      create: { ...member, isEnabled: true },
      update: {},
    });
  }
}

async function seedCatalog(): Promise<string> {
  const productLine = await db.productLine.create({
    data: { key: CATALOG_KEY, name: `${PREFIX}Line`, status: "ACTIVE" },
    select: { id: true },
  });
  const track = await db.track.create({
    data: { name: `${PREFIX}Track`, productLineId: productLine.id, status: "ACTIVE" },
    select: { id: true },
  });
  const stage = await db.stage.create({
    data: { internalCode: STAGE_CODE, name: `${PREFIX}Stage`, sequence: 1, trackId: track.id },
    select: { id: true },
  });

  return stage.id;
}

async function seedSemester(): Promise<string> {
  const semester = await db.semester.create({
    data: { name: `${PREFIX}sem`, startDate: SEMESTER_START, endDate: SEMESTER_END },
    select: { id: true },
  });

  return semester.id;
}

async function seedClasses(
  semesterId: string,
  stageId: string,
): Promise<{ classA: string; classB: string }> {
  const classA = await createClass({
    code: CLASS_A_CODE,
    teacherId: TEACHER_A_ID,
    semesterId,
    stageId,
    slots: [
      { weekday: "WEDNESDAY" as const, startTime: EVENING_START, endTime: EVENING_END },
      { weekday: "MONDAY" as const, startTime: EVENING_START, endTime: EVENING_END },
    ],
  });
  const classB = await createClass({
    code: CLASS_B_CODE,
    teacherId: TEACHER_B_ID,
    semesterId,
    stageId,
    slots: [{ weekday: "SATURDAY" as const, startTime: MORNING_START, endTime: MORNING_END }],
  });

  return { classA, classB };
}

type CreateClassInput = {
  code: string;
  teacherId: string;
  semesterId: string;
  stageId: string;
  slots: Array<{ weekday: "MONDAY" | "WEDNESDAY" | "SATURDAY"; startTime: Date; endTime: Date }>;
};

async function createClass(input: CreateClassInput): Promise<string> {
  const created = await db.class.create({
    data: {
      capacity: CLASS_CAPACITY,
      format: "IN_PERSON",
      internalCode: input.code,
      portalClassName: `${input.code} portal`,
      scheduleType: "REGULAR",
      semesterId: input.semesterId,
      sharedStageId: input.stageId,
      teacherId: input.teacherId,
      year: CLASS_YEAR,
      scheduleSlots: { create: input.slots },
    },
    select: { id: true },
  });

  return created.id;
}

/** Confirmed, non-cancelled sessions — the denominator of the attendance percent. */
async function seedSessions(classId: string): Promise<string[]> {
  const ids: string[] = [];

  for (const date of SESSION_DATES) {
    const session = await db.classSession.create({
      data: {
        classId,
        date,
        startTime: EVENING_START,
        endTime: EVENING_END,
        status: "SCHEDULED",
        attendanceConfirmedAt: NOW,
        attendanceConfirmedById: TEACHER_A_ID,
      },
      select: { id: true },
    });
    ids.push(session.id);
  }

  return ids;
}

type SeedStudentInput = {
  seed: StudentSeed;
  stageId: string;
  classIds: { classA: string; classB: string };
  sessionIds: string[];
};

async function seedStudent(input: SeedStudentInput): Promise<void> {
  const isMinor = input.seed.isMinor === true;
  const birthDate = input.seed.birthDate ?? (isMinor ? MINOR_BIRTH_DATE : null);
  const needsGuardian = isMinor || input.seed.birthDate !== undefined;
  const student = await db.student.create({
    data: {
      fullName: fullNameOf(input.seed.suffix),
      status: input.seed.status,
      phone: STUDENT_PHONE,
      birthDate,
      // A DB check constraint requires a contactable guardian for minors.
      ...(needsGuardian
        ? { guardian: { create: { fullName: `${PREFIX}Guardian`, phone: STUDENT_PHONE } } }
        : {}),
    },
    select: { id: true },
  });

  if (input.seed.classKey !== undefined) {
    const classId = input.seed.classKey === "A" ? input.classIds.classA : input.classIds.classB;
    const enrollmentId = await enroll({ studentId: student.id, classId, stageId: input.stageId });
    await seedAttendanceRows({
      enrollmentId,
      sessionIds: input.seed.classKey === "A" ? input.sessionIds : [],
      presentCount: input.seed.presentCount ?? 0,
    });
  }

  if (input.seed.finance !== undefined) {
    await seedOrder({ studentId: student.id, suffix: input.seed.suffix, kind: input.seed.finance });
  }
}

/** Enrollment and its active progress row share one transaction (deferred state guard). */
async function enroll(input: {
  studentId: string;
  classId: string;
  stageId: string;
}): Promise<string> {
  return db.$transaction(async (transaction) => {
    const enrollment = await transaction.enrollment.create({
      data: { classId: input.classId, studentId: input.studentId, entryDate: SEMESTER_START },
      select: { id: true },
    });
    await transaction.pedagogicalProgress.create({
      data: { enrollmentId: enrollment.id, stageId: input.stageId, startDate: SEMESTER_START },
    });

    return enrollment.id;
  });
}

async function seedAttendanceRows(input: {
  enrollmentId: string;
  sessionIds: string[];
  presentCount: number;
}): Promise<void> {
  for (const [index, sessionId] of input.sessionIds.entries()) {
    await db.attendance.create({
      data: {
        enrollmentId: input.enrollmentId,
        classSessionId: sessionId,
        status: index < input.presentCount ? "PRESENT" : "ABSENT",
        recordedById: TEACHER_A_ID,
      },
    });
  }
}

async function seedOrder(input: {
  studentId: string;
  suffix: string;
  kind: "overdue" | "settled";
}): Promise<void> {
  const amountCents = input.kind === "overdue" ? OVERDUE_CENTS : SETTLED_CENTS;
  const payer = await db.payer.create({
    data: { name: `${PREFIX}Payer ${input.suffix}` },
    select: { id: true },
  });
  const order = await db.order.create({
    data: {
      payerId: payer.id,
      kind: "TUITION",
      principalAmountCents: amountCents,
      startDate: SEMESTER_START,
      dueDay: DUE_DAY,
      beneficiaries: { create: { studentId: input.studentId } },
      installments: { create: { sequenceNumber: 1, amountCents, dueDate: DUE_DATE } },
    },
    select: { id: true, installments: { select: { id: true } } },
  });

  if (input.kind === "settled") {
    await settleInstallment({ payerId: payer.id, order, amountCents });
  }
}

async function settleInstallment(input: {
  payerId: string;
  order: { installments: Array<{ id: string }> };
  amountCents: number;
}): Promise<void> {
  const [installment] = input.order.installments;

  if (installment === undefined) {
    throw new Error("Expected the seeded order to carry one installment.");
  }

  await db.paymentEntry.create({
    data: {
      payerId: input.payerId,
      date: PAID_DATE,
      amountCents: input.amountCents,
      method: "PIX",
      allocations: { create: { installmentId: installment.id, amountCents: input.amountCents } },
    },
  });
}
