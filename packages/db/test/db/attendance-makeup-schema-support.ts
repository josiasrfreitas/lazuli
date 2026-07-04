import assert from "node:assert/strict";

import type { createDbClient } from "../../src/client.js";

export const TEST_PREFIX = "GRE-34 Schema ";
export const TEACHER_ID = "00000000-0000-0000-0000-000000003401";
export const UNIQUE_CONSTRAINT_MESSAGE = "Unique constraint failed";
export const LAST_MODIFIED_FACTS_CONSTRAINT = "Attendance_last_modified_facts_check";
export const CANCEL_ATTEND_EXCLUSIVE_CONSTRAINT = "Makeup_cancel_attend_exclusive_check";

const CATALOG_KEY_PREFIX = "gre34_schema_";
const ENTRY_DATE = new Date("2035-02-01T00:00:00.000Z");
const SESSION_DATE = new Date("2035-03-10T00:00:00.000Z");
const SESSION_START_TIME = new Date("1970-01-01T14:00:00.000Z");
const SESSION_END_TIME = new Date("1970-01-01T16:00:00.000Z");

export type DatabaseClient = ReturnType<typeof createDbClient>;

export type AttendanceFixture = {
  enrollmentId: string;
  classSessionId: string;
};

export async function cleanDatabase(database: DatabaseClient): Promise<void> {
  const byStudent = { enrollment: { student: { fullName: { startsWith: TEST_PREFIX } } } };
  await database.attendance.deleteMany({ where: byStudent });
  await database.makeup.deleteMany({
    where: { originEnrollment: { student: { fullName: { startsWith: TEST_PREFIX } } } },
  });
  await database.pedagogicalProgress.deleteMany({ where: byStudent });
  await database.enrollment.deleteMany({
    where: { student: { fullName: { startsWith: TEST_PREFIX } } },
  });
  await database.classSession.deleteMany({
    where: { class: { internalCode: { startsWith: TEST_PREFIX } } },
  });
  await database.student.deleteMany({ where: { fullName: { startsWith: TEST_PREFIX } } });
  await database.class.deleteMany({ where: { internalCode: { startsWith: TEST_PREFIX } } });
  await database.semester.deleteMany({ where: { name: { startsWith: TEST_PREFIX } } });
  await database.stage.deleteMany({
    where: { track: { productLine: { key: { startsWith: CATALOG_KEY_PREFIX } } } },
  });
  await database.track.deleteMany({
    where: { productLine: { key: { startsWith: CATALOG_KEY_PREFIX } } },
  });
  await database.productLine.deleteMany({ where: { key: { startsWith: CATALOG_KEY_PREFIX } } });
  await database.user.deleteMany({ where: { id: TEACHER_ID } });
}

export async function seedAttendanceFixture(database: DatabaseClient): Promise<AttendanceFixture> {
  await seedTeacher(database);
  const stageId = await seedCatalog(database);
  const semesterId = await seedSemester(database);
  const classId = await createRegularClass(database, { semesterId, stageId });
  const classSessionId = await createSession(database, classId);
  const studentId = await createStudent(database);
  const enrollmentId = await createEnrollmentWithProgress(database, {
    classId,
    stageId,
    studentId,
  });

  return { enrollmentId, classSessionId };
}

export async function expectConstraintRejection(
  promise: Promise<unknown>,
  needle: string,
): Promise<void> {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.ok(
      error.message.includes(needle),
      `Expected error message to include ${needle}, received: ${error.message}`,
    );
    return true;
  });
}

async function seedTeacher(database: DatabaseClient): Promise<void> {
  await database.user.create({
    data: {
      id: TEACHER_ID,
      email: "gre34-schema-teacher@example.com",
      isEnabled: true,
      name: `${TEST_PREFIX}Teacher`,
      role: "TEACHER",
    },
  });
}

async function seedCatalog(database: DatabaseClient): Promise<string> {
  const productLine = await database.productLine.create({
    data: { key: `${CATALOG_KEY_PREFIX}line`, name: `${TEST_PREFIX}Line`, status: "ACTIVE" },
    select: { id: true },
  });
  const track = await database.track.create({
    data: { name: `${TEST_PREFIX}Track`, productLineId: productLine.id, status: "ACTIVE" },
    select: { id: true },
  });
  const stage = await database.stage.create({
    data: {
      internalCode: "GRE34A1",
      name: `${TEST_PREFIX}Stage`,
      sequence: 1,
      trackId: track.id,
    },
    select: { id: true },
  });

  return stage.id;
}

async function seedSemester(database: DatabaseClient): Promise<string> {
  const semester = await database.semester.create({
    data: {
      name: `${TEST_PREFIX}2035.1`,
      startDate: new Date("2035-02-01T00:00:00.000Z"),
      endDate: new Date("2035-06-30T00:00:00.000Z"),
    },
    select: { id: true },
  });

  return semester.id;
}

async function createRegularClass(
  database: DatabaseClient,
  input: { semesterId: string; stageId: string },
): Promise<string> {
  const classRow = await database.class.create({
    data: {
      capacity: 8,
      format: "IN_PERSON",
      internalCode: `${TEST_PREFIX}Class`,
      portalClassName: `${TEST_PREFIX}portal-class`,
      scheduleType: "REGULAR",
      semesterId: input.semesterId,
      sharedStageId: input.stageId,
      teacherId: TEACHER_ID,
      year: 2035,
    },
    select: { id: true },
  });

  return classRow.id;
}

async function createSession(database: DatabaseClient, classId: string): Promise<string> {
  const session = await database.classSession.create({
    data: {
      classId,
      date: SESSION_DATE,
      startTime: SESSION_START_TIME,
      endTime: SESSION_END_TIME,
    },
    select: { id: true },
  });

  return session.id;
}

async function createStudent(database: DatabaseClient): Promise<string> {
  const student = await database.student.create({
    data: { fullName: `${TEST_PREFIX}Student` },
    select: { id: true },
  });

  return student.id;
}

async function createEnrollmentWithProgress(
  database: DatabaseClient,
  input: { classId: string; stageId: string; studentId: string },
): Promise<string> {
  return database.$transaction(async (transaction) => {
    const enrollment = await transaction.enrollment.create({
      data: { classId: input.classId, entryDate: ENTRY_DATE, studentId: input.studentId },
      select: { id: true },
    });
    await transaction.pedagogicalProgress.create({
      data: { enrollmentId: enrollment.id, stageId: input.stageId, startDate: ENTRY_DATE },
    });

    return enrollment.id;
  });
}
