import type { DatabaseClient } from "./client.js";
import { seedClass } from "./seed-dev-classes.js";
import {
  DEV_ADMIN,
  DEV_CLASSES,
  DEV_STUDENTS,
  DEV_TEACHERS,
  type DevAttendanceProfile,
  type DevExitReason,
  type DevStudentSeed,
} from "./seed-dev-data.js";
import { seedDevFinance } from "./seed-dev-finance.js";
import {
  addDays,
  endOfDayUtc,
  isoOf,
  requireValue,
  saoPauloTodayIso,
  stableUuid,
  utcDate,
  type SeedContext,
  type SeededClass,
  type SeededSemester,
  type SemesterSeed,
} from "./seed-dev-support.js";

/**
 * Idempotent development seed for the students vertical. Sessions and payments
 * are generated relative to "today" in America/Sao_Paulo, keeping the
 * overdue/held-session fixtures meaningful on any run date.
 */

const YEAR_END_INDEX = 4;
const MONTH_START_INDEX = 5;
const MONTH_END_INDEX = 7;
const SECOND_HALF_FIRST_MONTH = 7;
const EXIT_DAYS_AGO = 14;
const GOOD_ABSENCE_CYCLE = 6;
type SeedDevDataOptions = { workspaceInitializationKey?: string };

export async function seedDevData(
  database: DatabaseClient,
  options: SeedDevDataOptions = {},
): Promise<void> {
  const todayIso = saoPauloTodayIso();
  const semester = await upsertSemester(database, currentSemesterSeed(todayIso));
  const teacherIds = await upsertStaff(database);
  const context: SeedContext = { database, todayIso, semester, teacherIds, classes: new Map() };
  for (const classSeed of DEV_CLASSES) {
    await seedClass(context, classSeed);
  }
  const studentIds = new Map<string, string>();
  for (const studentSeed of DEV_STUDENTS) {
    studentIds.set(studentSeed.key, await seedStudent(context, studentSeed));
  }
  await seedDevFinance(database, { ...options, todayIso, studentIds });
}

function currentSemesterSeed(todayIso: string): SemesterSeed {
  const year = Number(todayIso.slice(0, YEAR_END_INDEX));
  const month = Number(todayIso.slice(MONTH_START_INDEX, MONTH_END_INDEX));
  if (month >= SECOND_HALF_FIRST_MONTH) {
    return { name: `${year}.2`, startIso: `${year}-07-01`, endIso: `${year}-12-20`, year };
  }
  return { name: `${year}.1`, startIso: `${year}-01-02`, endIso: `${year}-06-30`, year };
}

async function upsertSemester(
  database: DatabaseClient,
  seed: SemesterSeed,
): Promise<SeededSemester> {
  const semester = await database.semester.upsert({
    where: { name: seed.name },
    create: {
      name: seed.name,
      startDate: utcDate(seed.startIso),
      endDate: utcDate(seed.endIso),
    },
    update: {},
  });
  return { ...seed, id: semester.id };
}

async function upsertStaff(database: DatabaseClient): Promise<Map<string, string>> {
  await upsertUser(database, { email: DEV_ADMIN.email, name: DEV_ADMIN.name, role: "ADMIN" });
  const teacherIds = new Map<string, string>();
  for (const teacher of DEV_TEACHERS) {
    const user = await upsertUser(database, {
      email: teacher.email,
      name: teacher.name,
      role: "TEACHER",
    });
    teacherIds.set(teacher.key, user.id);
  }
  return teacherIds;
}

async function upsertUser(
  database: DatabaseClient,
  input: { email: string; name: string; role: "ADMIN" | "TEACHER" },
): Promise<{ id: string }> {
  return database.user.upsert({
    where: { email: input.email },
    create: { email: input.email, name: input.name, role: input.role, emailVerified: true },
    update: { name: input.name, role: input.role },
  });
}

async function seedStudent(context: SeedContext, studentSeed: DevStudentSeed): Promise<string> {
  const guardianId =
    studentSeed.guardian === undefined ? null : await upsertGuardian(context, studentSeed);
  const studentId = stableUuid(["student", studentSeed.key]);
  await context.database.student.upsert({
    where: { id: studentId },
    create: {
      id: studentId,
      fullName: studentSeed.fullName,
      phone: studentSeed.phone ?? null,
      email: studentSeed.email ?? null,
      birthDate: studentSeed.birthDate === undefined ? null : utcDate(studentSeed.birthDate),
      status: studentSeed.status,
      guardianId,
      notes: studentSeed.notes ?? null,
    },
    update: { fullName: studentSeed.fullName, status: studentSeed.status, guardianId },
  });
  for (const enrollmentSeed of studentSeed.enrollments) {
    await seedEnrollment(context, { studentSeed, studentId, enrollmentSeed });
  }
  return studentId;
}

async function upsertGuardian(context: SeedContext, studentSeed: DevStudentSeed): Promise<string> {
  const guardian = requireValue(studentSeed.guardian, `guardian ${studentSeed.key}`);
  const id = stableUuid(["guardian", studentSeed.key]);
  await context.database.guardian.upsert({
    where: { id },
    create: {
      id,
      fullName: guardian.fullName,
      relationship: guardian.relationship,
      phone: guardian.phone,
      email: guardian.email ?? null,
    },
    update: { fullName: guardian.fullName, phone: guardian.phone },
  });
  return id;
}

type EnrollmentInput = {
  studentSeed: DevStudentSeed;
  studentId: string;
  enrollmentSeed: DevStudentSeed["enrollments"][number];
};

async function seedEnrollment(context: SeedContext, input: EnrollmentInput): Promise<void> {
  const seededClass = requireValue(
    context.classes.get(input.enrollmentSeed.classKey),
    `class ${input.enrollmentSeed.classKey}`,
  );
  const enrollmentId = stableUuid([
    "enrollment",
    input.studentSeed.key,
    input.enrollmentSeed.classKey,
  ]);
  const exitIso =
    input.enrollmentSeed.exitReason === undefined
      ? null
      : isoOf(addDays(utcDate(context.todayIso), -EXIT_DAYS_AGO));
  await upsertEnrollmentWithProgress(context, { ...input, enrollmentId, seededClass, exitIso });
  await seedAttendanceRows(context, {
    studentSeed: input.studentSeed,
    enrollmentId,
    seededClass,
    exitIso,
  });
}

type EnrollmentRowInput = EnrollmentInput & {
  enrollmentId: string;
  seededClass: SeededClass;
  exitIso: string | null;
};

// The deferred Enrollment_progress_state_guard constraint trigger requires an
// active enrollment and its single active pedagogical progress row to be
// committed in the same transaction.
async function upsertEnrollmentWithProgress(
  context: SeedContext,
  input: EnrollmentRowInput,
): Promise<void> {
  const progressId = stableUuid(["progress", input.studentSeed.key, input.enrollmentSeed.classKey]);
  await context.database.$transaction([
    context.database.enrollment.upsert({
      where: { id: input.enrollmentId },
      create: {
        id: input.enrollmentId,
        studentId: input.studentId,
        classId: input.seededClass.id,
        entryDate: utcDate(context.semester.startIso),
        exitDate: input.exitIso === null ? null : utcDate(input.exitIso),
        exitReason: input.enrollmentSeed.exitReason ?? null,
      },
      update: {},
    }),
    context.database.pedagogicalProgress.upsert({
      where: { id: progressId },
      create: {
        id: progressId,
        enrollmentId: input.enrollmentId,
        stageId: input.seededClass.stageId,
        startDate: utcDate(context.semester.startIso),
        endDate: input.exitIso === null ? null : utcDate(input.exitIso),
        endReason:
          input.enrollmentSeed.exitReason === undefined
            ? null
            : progressEndReasonFor(input.enrollmentSeed.exitReason),
      },
      update: {},
    }),
  ]);
}

function progressEndReasonFor(reason: DevExitReason): "ADVANCED" | "DROPPED" | "SUSPENDED" {
  return reason === "COMPLETED" ? "ADVANCED" : reason;
}

type AttendanceRowsInput = {
  studentSeed: DevStudentSeed;
  enrollmentId: string;
  seededClass: SeededClass;
  exitIso: string | null;
};

async function seedAttendanceRows(context: SeedContext, input: AttendanceRowsInput): Promise<void> {
  for (const session of input.seededClass.sessions) {
    if (input.exitIso !== null && session.dateIso > input.exitIso) {
      continue;
    }
    const status = attendanceStatusFor({
      profile: input.studentSeed.attendance,
      studentKey: input.studentSeed.key,
      index: session.index,
    });
    const id = stableUuid(["attendance", input.enrollmentId, session.id]);
    await context.database.attendance.upsert({
      where: { id },
      create: {
        id,
        enrollmentId: input.enrollmentId,
        classSessionId: session.id,
        status,
        recordedAt: endOfDayUtc(session.dateIso),
        recordedById: input.seededClass.teacherId,
      },
      update: { status },
    });
  }
}

function attendanceStatusFor(input: {
  profile: DevAttendanceProfile;
  studentKey: string;
  index: number;
}): "PRESENT" | "ABSENT" {
  if (input.profile === "low") {
    return input.index % 2 === 0 ? "PRESENT" : "ABSENT";
  }
  const offset = stableUuid([input.studentKey]).codePointAt(0) ?? 0;
  return (input.index + offset) % GOOD_ABSENCE_CYCLE === 0 ? "ABSENT" : "PRESENT";
}
