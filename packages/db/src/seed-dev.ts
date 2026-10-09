import type { DatabaseClient } from "./client.js";
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
  const context: SeedContext = {
    database,
    todayIso,
    semester: { ...semesterSeed, id: semester.id },
    teacherIds,
    classes: new Map(),
    resolveClassName,
  };
  for (const classSeed of DEV_CLASSES) await seedClass(context, classSeed);
  for (const studentSeed of DEV_STUDENTS) await seedStudent(context, studentSeed);
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
    teachers.set(key, teacher.id);
  }
  return teachers;
}

async function seedStudent(context: SeedContext, student: DevStudentSeed): Promise<void> {
  const id = stableUuid(["student", student.key]);
  const guardianId = student.guardian ? stableUuid(["guardian", student.key]) : null;
  if (student.guardian && guardianId) {
    await context.database.guardian.create({ data: { id: guardianId, ...student.guardian } });
  }
  const birthday =
    student.ageYears === undefined
      ? null
      : addDays(
          monthlyDueDate(context.todayIso, {
            monthOffset: -student.ageYears * MONTHS_PER_YEAR,
            dueDay: utcDate(context.todayIso).getUTCDate(),
          }),
          -(student.birthdayOffsetDays ?? 0),
        );
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

type EnrollmentInput = {
  student: DevStudentSeed;
  enrollment: DevStudentSeed["enrollments"][number];
};
async function seedEnrollment(context: SeedContext, input: EnrollmentInput): Promise<void> {
  const { student, enrollment } = input;
  const classroom = requireValue(
    context.classes.get(enrollment.classKey),
    `class ${enrollment.classKey}`,
  );
  const stageId = enrollment.stageInternalCode
    ? (
        await context.database.stage.findFirstOrThrow({
          where: { internalCode: enrollment.stageInternalCode },
        })
      ).id
    : classroom.stageId;
  const enrollmentId = stableUuid(["enrollment", student.key, enrollment.classKey]);
  // The deferred progress constraint requires enrollment and placement in one transaction.
  await context.database.$transaction(async (transaction) => {
    await transaction.enrollment.create({
      data: {
        id: enrollmentId,
        studentId: stableUuid(["student", student.key]),
        classId: classroom.id,
        entryDate: utcDate(context.semester.startIso),
      },
    });
    await transaction.pedagogicalProgress.create({
      data: {
        id: stableUuid(["progress", student.key, enrollment.classKey]),
        enrollmentId,
        stageId,
        startDate: utcDate(context.semester.startIso),
      },
    });
  });
  await seedAttendance(context, { student, classroom, enrollmentId });
}

async function seedAttendance(
  context: SeedContext,
  input: { student: DevStudentSeed; classroom: SeededClass; enrollmentId: string },
): Promise<void> {
  const { student, classroom, enrollmentId } = input;
  const offset = stableUuid([student.key]).codePointAt(0) ?? 0;
  await context.database.attendance.createMany({
    data: classroom.sessions.map((session) => ({
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
