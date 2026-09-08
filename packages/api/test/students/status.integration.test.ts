import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import { db } from "@lazuli/db";

import { caller } from "../support/student-test-support.js";

const TEST_PREFIX = "GRE-23 Student ";
const CATALOG_KEY = "gre23_status_line";
const TEACHER_ID = "00000000-0000-0000-0000-000000002301";
const ADULT_BIRTH_DATE = new Date("1992-05-10T00:00:00.000Z");
const LIFECYCLE_ENTRY_DATE = new Date("2026-01-01T00:00:00.000Z");
const LIFECYCLE_EXIT_DATE = new Date("2026-02-01T00:00:00.000Z");
const STAGE_CODE_SUFFIX_LIMIT = 16;

const SEMESTER_WINDOWS_BY_SUFFIX = {
  "dropped-active": {
    startDate: new Date("2083-02-01T00:00:00.000Z"),
    endDate: new Date("2083-06-30T00:00:00.000Z"),
  },
  "suspended-active": {
    startDate: new Date("2081-02-01T00:00:00.000Z"),
    endDate: new Date("2081-06-30T00:00:00.000Z"),
  },
  "suspended-closed": {
    startDate: new Date("2082-02-01T00:00:00.000Z"),
    endDate: new Date("2082-06-30T00:00:00.000Z"),
  },
} as const satisfies Record<string, { endDate: Date; startDate: Date }>;

void describe("students status lifecycle API", () => {
  void before(async () => {
    await db.$connect();
  });

  void beforeEach(async () => {
    await cleanDatabase();
    await seedTeacher();
  });

  void after(async () => {
    await cleanDatabase();
    await db.$disconnect();
  });

  registerSetStatusTest();
  registerSuspendedCascadeTest();
  registerDroppedCascadeTest();
});

function registerSetStatusTest(): void {
  void it("updates a student's status through the public status lifecycle mutation", async () => {
    const student = await createAdultFixture();

    await caller().students.setStatus({ id: student.id, status: "DROPPED" });

    const profile = await caller().students.byId({ id: student.id });
    assert.equal(profile.contact.status, "DROPPED");
  });
}

function registerSuspendedCascadeTest(): void {
  void it("suspending a student closes active academic lifecycle rows when present", async () => {
    const student = await createAdultFixture();
    const activeLifecycle = await createActiveLifecycleRows(student.id, "suspended-active");
    const closedLifecycle = await createClosedLifecycleRows(student.id, "suspended-closed");

    await caller().students.setStatus({ id: student.id, status: "SUSPENDED" });

    const activeEnrollment = await db.enrollment.findUniqueOrThrow({
      where: { id: activeLifecycle.enrollmentId },
    });
    const closedEnrollment = await db.enrollment.findUniqueOrThrow({
      where: { id: closedLifecycle.enrollmentId },
    });
    const activeProgress = await db.pedagogicalProgress.findUniqueOrThrow({
      where: { id: activeLifecycle.progressId },
    });
    const closedProgress = await db.pedagogicalProgress.findUniqueOrThrow({
      where: { id: closedLifecycle.progressId },
    });

    assert.equal(activeEnrollment.exitReason, "SUSPENDED");
    assert.equal(activeEnrollment.exitDate instanceof Date, true);
    assert.equal(closedEnrollment.exitReason, "DROPPED");
    assert.equal(activeProgress.endReason, "SUSPENDED");
    assert.equal(activeProgress.endDate instanceof Date, true);
    assert.equal(closedProgress.endReason, "DROPPED");
  });
}

async function createAdultFixture(): Promise<{ id: string }> {
  return db.student.create({
    data: {
      fullName: `${TEST_PREFIX}Adult`,
      birthDate: ADULT_BIRTH_DATE,
    },
  });
}

function registerDroppedCascadeTest(): void {
  void it("dropping a student closes active academic lifecycle rows as dropped", async () => {
    const student = await createAdultFixture();
    const lifecycle = await createActiveLifecycleRows(student.id, "dropped-active");

    await caller().students.setStatus({ id: student.id, status: "DROPPED" });

    const enrollment = await db.enrollment.findUniqueOrThrow({
      where: { id: lifecycle.enrollmentId },
    });
    const progress = await db.pedagogicalProgress.findUniqueOrThrow({
      where: { id: lifecycle.progressId },
    });

    assert.equal(enrollment.exitReason, "DROPPED");
    assert.equal(progress.endReason, "DROPPED");
  });
}

async function cleanDatabase(): Promise<void> {
  await db.pedagogicalProgress.deleteMany({
    where: { enrollment: { student: { fullName: { startsWith: TEST_PREFIX } } } },
  });
  await db.enrollment.deleteMany({
    where: { student: { fullName: { startsWith: TEST_PREFIX } } },
  });
  await db.class.deleteMany({ where: { internalCode: { startsWith: TEST_PREFIX } } });
  await db.semester.deleteMany({ where: { name: { startsWith: TEST_PREFIX } } });
  await db.stage.deleteMany({
    where: { track: { productLine: { key: CATALOG_KEY } } },
  });
  await db.track.deleteMany({ where: { productLine: { key: CATALOG_KEY } } });
  await db.productLine.deleteMany({ where: { key: CATALOG_KEY } });
  await db.user.deleteMany({ where: { id: TEACHER_ID } });
  await db.student.deleteMany({ where: { fullName: { startsWith: TEST_PREFIX } } });
}

async function seedTeacher(): Promise<void> {
  await db.user.create({
    data: {
      id: TEACHER_ID,
      email: "gre23-status-teacher@example.com",
      isEnabled: true,
      name: "GRE-23 Status Teacher",
      role: "TEACHER",
    },
  });
}

async function createActiveLifecycleRows(
  studentId: string,
  suffix: string,
): Promise<{ enrollmentId: string; progressId: string }> {
  const stage = await createStageFixture(suffix);
  const classRow = await createClassFixture(suffix);

  return db.$transaction(async (transaction) => {
    const enrollment = await transaction.enrollment.create({
      data: {
        classId: classRow.id,
        entryDate: LIFECYCLE_ENTRY_DATE,
        studentId,
      },
      select: { id: true },
    });
    const progress = await transaction.pedagogicalProgress.create({
      data: {
        enrollmentId: enrollment.id,
        stageId: stage.id,
        startDate: LIFECYCLE_ENTRY_DATE,
      },
      select: { id: true },
    });
    return { enrollmentId: enrollment.id, progressId: progress.id };
  });
}

async function createClosedLifecycleRows(
  studentId: string,
  suffix: string,
): Promise<{ enrollmentId: string; progressId: string }> {
  const stage = await createStageFixture(suffix);
  const classRow = await createClassFixture(suffix);

  return db.$transaction(async (transaction) => {
    const enrollment = await transaction.enrollment.create({
      data: {
        classId: classRow.id,
        entryDate: LIFECYCLE_ENTRY_DATE,
        exitDate: LIFECYCLE_EXIT_DATE,
        exitReason: "DROPPED",
        studentId,
      },
      select: { id: true },
    });
    const progress = await transaction.pedagogicalProgress.create({
      data: {
        enrollmentId: enrollment.id,
        endDate: LIFECYCLE_EXIT_DATE,
        endReason: "DROPPED",
        stageId: stage.id,
        startDate: LIFECYCLE_ENTRY_DATE,
      },
      select: { id: true },
    });
    return { enrollmentId: enrollment.id, progressId: progress.id };
  });
}

async function createStageFixture(suffix: string): Promise<{ id: string }> {
  const productLine = await db.productLine.upsert({
    create: {
      key: CATALOG_KEY,
      name: `${TEST_PREFIX}Line`,
      status: "ACTIVE",
    },
    update: {},
    where: { key: CATALOG_KEY },
  });
  const track = await db.track.create({
    data: {
      name: `${TEST_PREFIX}Track ${suffix}`,
      productLineId: productLine.id,
      status: "ACTIVE",
    },
  });
  return db.stage.create({
    data: {
      internalCode: `GRE23${suffix
        .replaceAll("-", "")
        .toUpperCase()
        .slice(0, STAGE_CODE_SUFFIX_LIMIT)}`,
      name: `${TEST_PREFIX}Stage ${suffix}`,
      sequence: 1,
      trackId: track.id,
    },
    select: { id: true },
  });
}

async function createClassFixture(suffix: string): Promise<{ id: string }> {
  const { endDate, startDate } = semesterDatesForSuffix(suffix);
  const semester = await db.semester.create({
    data: {
      name: `${TEST_PREFIX}Semester ${suffix}`,
      startDate,
      endDate,
    },
    select: { id: true },
  });

  return db.class.create({
    data: {
      capacity: 8,
      format: "IN_PERSON",
      internalCode: `${TEST_PREFIX}Class ${suffix}`,
      portalClassName: `${TEST_PREFIX}Portal ${suffix}`,
      scheduleType: "PERSONALIZED",
      semesterId: semester.id,
      teacherId: TEACHER_ID,
      year: 2026,
    },
    select: { id: true },
  });
}

function semesterDatesForSuffix(suffix: string): { endDate: Date; startDate: Date } {
  const window = SEMESTER_WINDOWS_BY_SUFFIX[suffix as keyof typeof SEMESTER_WINDOWS_BY_SUFFIX];
  if (window === undefined) {
    throw new Error(`Missing semester window fixture for suffix: ${suffix}`);
  }

  return window;
}
