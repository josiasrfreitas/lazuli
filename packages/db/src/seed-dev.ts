import type { DatabaseClient, TransactionClient } from "./client.js";
import { seedMakeups } from "./seed-dev-attendance.js";
import { seedClass } from "./seed-dev-classes.js";
import {
  DEV_ADMIN,
  DEV_SYSTEM_ADMIN,
  DEV_CLASSES,
  DEV_STUDENTS,
  DEV_TEACHERS,
  type DevStudentSeed,
} from "./seed-dev-data.js";
import { monthlyDueDate } from "./seed-dev-finance.js";
import {
  addDays,
  endOfDayUtc,
  enrollmentEntryIso,
  isoOf,
  requireValue,
  stableUuid,
  utcDate,
  type SeedContext,
  type SemesterSeed,
  type SeededClass,
} from "./seed-dev-support.js";

const MONTHS_PER_YEAR = 12;
const SECOND_HALF_MONTH = 6;
const GOOD_ABSENCE_CYCLE = 12;
const HISTORY_STAGE_DAYS = 60;

/** Loads a fresh database. The public pnpm seed command owns the reset. */
export async function seedDevData(
  database: DatabaseClient,
  input: { todayIso: string; resolveClassName: SeedContext["resolveClassName"] },
): Promise<void> {
  const { todayIso, resolveClassName } = input;
  const semesterSeed = currentSemesterSeed(todayIso);
  const semester = await database.semester.create({
    data: {
      name: semesterSeed.name,
      startDate: utcDate(semesterSeed.startIso),
      endDate: utcDate(semesterSeed.endIso),
    },
  });
  const teacherIds = await createStaff(database);
  const admin = await database.user.findUniqueOrThrow({ where: { email: DEV_ADMIN.email } });
  const closedDates = await seedClosedDays(database, { semester: semesterSeed, adminId: admin.id });
  const context: SeedContext = {
    database,
    todayIso,
    semester: { ...semesterSeed, id: semester.id },
    teacherIds,
    classes: new Map(),
    adminId: admin.id,
    closedDates,
    resolveClassName,
  };
  for (const classSeed of DEV_CLASSES) await seedClass(context, classSeed);
  for (const studentSeed of DEV_STUDENTS) await seedStudent(context, studentSeed);
  await seedMakeups(context);
}

function currentSemesterSeed(todayIso: string): SemesterSeed {
  const today = utcDate(todayIso);
  const year = today.getUTCFullYear();
  const secondHalf = today.getUTCMonth() >= SECOND_HALF_MONTH;
  return {
    name: `${year}.${secondHalf ? 2 : 1}`,
    startIso: `${year}-${secondHalf ? "07-01" : "01-01"}`,
    endIso: `${year}-${secondHalf ? "12-31" : "06-30"}`,
    year,
  };
}

async function createStaff(database: DatabaseClient): Promise<Map<string, string>> {
  await database.user.create({ data: { ...DEV_ADMIN, role: "ADMIN", emailVerified: true } });
  await database.user.create({
    data: { ...DEV_SYSTEM_ADMIN, role: "SYSTEM_ADMIN", emailVerified: true },
  });
  const teachers = new Map<string, string>();
  for (const { key, name, email } of DEV_TEACHERS) {
    const teacher = await database.user.create({
      data: { name, email, role: "TEACHER", emailVerified: true },
    });
    await database.teacherProfile.create({ data: { userId: teacher.id } });
    teachers.set(key, teacher.id);
  }
  return teachers;
}

async function seedStudent(context: SeedContext, student: DevStudentSeed): Promise<void> {
  const id = stableUuid(["student", student.key]);
  const guardianId = student.guardian
    ? stableUuid(["guardian", student.guardian.key ?? student.key])
    : null;
  if (student.guardian && guardianId) {
    const { key: _key, ...guardian } = student.guardian;
    await context.database.guardian.upsert({
      where: { id: guardianId },
      create: { id: guardianId, ...guardian },
      update: {},
    });
  }
  const birthday = studentBirthday(context.todayIso, student);
  await context.database.student.create({
    data: {
      id,
      fullName: student.fullName,
      phone: student.phone ?? null,
      email: student.email ?? null,
      birthDate: birthday,
      status: student.status,
      guardianId,
      notes: student.notes ?? null,
    },
  });
  for (const enrollment of student.enrollments) {
    await seedEnrollment(context, { student, enrollment });
  }
}

function studentBirthday(todayIso: string, student: DevStudentSeed): Date | null {
  return student.ageYears === undefined
    ? null
    : addDays(
        monthlyDueDate(todayIso, {
          monthOffset: -student.ageYears * MONTHS_PER_YEAR,
          dueDay: utcDate(todayIso).getUTCDate(),
        }),
        -(student.birthdayOffsetDays ?? 0),
      );
}

type EnrollmentInput = {
  student: DevStudentSeed;
  enrollment: DevStudentSeed["enrollments"][number];
};
type EnrollmentDetails = EnrollmentInput & {
  classroom: SeededClass;
  stageId: string;
  previousStageId: string | null;
  enrollmentId: string;
  entryIso: string;
  progressStartIso: string;
  adminId: string;
};

async function seedEnrollment(context: SeedContext, input: EnrollmentInput): Promise<void> {
  const details = await enrollmentDetails(context, input);
  // Enrollment, ENTRY action and placements commit together for the deferred progress guard.
  await context.database.$transaction((transaction) => seedEnrollmentRecords(transaction, details));
  await seedAttendance(context, details);
}

async function enrollmentDetails(
  context: SeedContext,
  input: EnrollmentInput,
): Promise<EnrollmentDetails> {
  const { student, enrollment } = input;
  const classroom = requireValue(
    context.classes.get(enrollment.classKey),
    `class ${enrollment.classKey}`,
  );
  const stage = enrollment.stageInternalCode
    ? await context.database.stage.findFirstOrThrow({
        where: { internalCode: enrollment.stageInternalCode },
      })
    : null;
  const entryIso = enrollmentEntryIso({
    semesterStartIso: context.semester.startIso,
    todayIso: context.todayIso,
    entryOffsetDays: enrollment.entryOffsetDays,
  });
  const progressStartIso = isoOf(addDays(utcDate(entryIso), HISTORY_STAGE_DAYS));
  const previousStage =
    enrollment.previousStageInternalCode && progressStartIso < context.todayIso
      ? await context.database.stage.findFirstOrThrow({
          where: { internalCode: enrollment.previousStageInternalCode },
        })
      : null;
  return {
    ...input,
    classroom,
    stageId: stage?.id ?? classroom.stageId,
    previousStageId: previousStage?.id ?? null,
    enrollmentId: stableUuid(["enrollment", student.key, enrollment.classKey]),
    entryIso,
    progressStartIso,
    adminId: context.adminId,
  };
}

async function seedEnrollmentRecords(
  transaction: TransactionClient,
  input: EnrollmentDetails,
): Promise<void> {
  await transaction.enrollment.create({
    data: {
      id: input.enrollmentId,
      studentId: stableUuid(["student", input.student.key]),
      classId: input.classroom.id,
      entryDate: utcDate(input.entryIso),
    },
  });
  await transaction.enrollmentAction.create({
    data: {
      id: stableUuid(["entry-action", input.student.key, input.enrollment.classKey]),
      enrollmentId: input.enrollmentId,
      kind: "ENTRY",
      status: "APPLIED",
      effectiveDate: utcDate(input.entryIso),
      recordedById: input.adminId,
      createdAt: utcDate(input.entryIso),
    },
  });
  await seedProgressRecords(transaction, input);
}

async function seedProgressRecords(
  transaction: TransactionClient,
  input: EnrollmentDetails,
): Promise<void> {
  const { student, enrollment, enrollmentId, entryIso, previousStageId, progressStartIso } = input;
  if (previousStageId) {
    await transaction.pedagogicalProgress.create({
      data: {
        id: stableUuid(["progress-history", student.key, enrollment.classKey]),
        enrollmentId,
        stageId: previousStageId,
        startDate: utcDate(entryIso),
        endDate: addDays(utcDate(progressStartIso), -1),
        endReason: "ADVANCED",
      },
    });
  }
  await transaction.pedagogicalProgress.create({
    data: {
      id: stableUuid(["progress", student.key, enrollment.classKey]),
      enrollmentId,
      stageId: input.stageId,
      startDate: utcDate(previousStageId ? progressStartIso : entryIso),
    },
  });
}

async function seedAttendance(
  context: SeedContext,
  input: {
    student: DevStudentSeed;
    classroom: SeededClass;
    enrollmentId: string;
    entryIso: string;
  },
): Promise<void> {
  const { student, classroom, enrollmentId } = input;
  const offset = stableUuid([student.key]).codePointAt(0) ?? 0;
  await context.database.attendance.createMany({
    data: classroom.sessions
      .filter((session) => session.dateIso >= input.entryIso)
      .map((session) => ({
        id: stableUuid(["attendance", enrollmentId, session.id]),
        enrollmentId,
        classSessionId: session.id,
        status:
          (session.index + offset) % (student.attendance === "low" ? 2 : GOOD_ABSENCE_CYCLE) === 0
            ? "ABSENT"
            : "PRESENT",
        recordedAt: endOfDayUtc(session.dateIso),
        recordedById: classroom.teacherId,
      })),
  });
}

async function seedClosedDays(
  database: DatabaseClient,
  input: { semester: SemesterSeed; adminId: string },
): Promise<Set<string>> {
  const { semester, adminId } = input;
  const holidays = [
    ["01-01", "Confraternização Universal"],
    ["04-21", "Tiradentes"],
    ["05-01", "Dia do Trabalho"],
    ["09-07", "Independência do Brasil"],
    ["10-12", "Nossa Senhora Aparecida"],
    ["11-02", "Finados"],
    ["11-15", "Proclamação da República"],
    ["11-20", "Dia da Consciência Negra"],
    ["12-25", "Natal"],
  ] as const;
  const dates = holidays
    .map(([day, reason]) => ({ dateIso: `${semester.year}-${day}`, reason }))
    .filter(({ dateIso }) => dateIso >= semester.startIso && dateIso <= semester.endIso);
  await database.schoolClosedDay.createMany({
    data: dates.map(({ dateIso, reason }) => ({
      id: stableUuid(["closed-day", dateIso]),
      date: utcDate(dateIso),
      reason,
      createdById: adminId,
    })),
  });
  return new Set(dates.map(({ dateIso }) => dateIso));
}
