import { after, before, beforeEach } from "node:test";

import { db } from "@lazuli/db";

import { caller, cleanEnrollmentFixtures } from "./enrollment-test-support.js";

// Generic, prefix-agnostic helpers are shared with the GRE-30 enroll suite.
export {
  ADMIN,
  callHttpMutation,
  caller,
  expectRejects,
  HTTP_OK,
} from "./enrollment-test-support.js";
export { assertActiveStageAndOpenEnrollment } from "./enrollment-suite-support.js";

// Distinct prefix / catalog key / semester / teacher from the GRE-30 suite: `test:db` runs test
// files in parallel processes against one database, so shared identifiers would race on the global
// semester exclusion and catalog uniques.
export const TEST_PREFIX = "GRE-31 Advance ";
export const CATALOG_KEY = "gre31_advance_line";
export const CATALOG_KEY_PREFIX = "gre31_advance_";
export const TEACHER_USER_ID = "00000000-0000-0000-0000-000000003101";

const DEFAULT_CLASS_CAPACITY = 8;
const FIXTURE_CLASS_YEAR = 2026;

export type TwoStageCatalogFixture = {
  firstStageId: string;
  secondStageId: string;
  semesterId: string;
};

export async function ensureTeacherUser(): Promise<void> {
  await db.user.upsert({
    where: { id: TEACHER_USER_ID },
    create: {
      id: TEACHER_USER_ID,
      email: "gre31-advance-teacher@example.com",
      name: "GRE-31 Advance Teacher",
      role: "TEACHER",
      isEnabled: true,
    },
    update: {},
  });
}

/** Seeds one track with two ordered stages (sequence 1 and 2) so advancement has somewhere to go. */
export async function seedTwoStageCatalog(): Promise<TwoStageCatalogFixture> {
  const productLine = await db.productLine.create({
    data: { key: CATALOG_KEY, name: `${TEST_PREFIX}Product Line`, status: "ACTIVE" },
  });
  const track = await db.track.create({
    data: { productLineId: productLine.id, name: `${TEST_PREFIX}Track`, status: "ACTIVE" },
  });
  const [first, second] = await Promise.all([
    db.stage.create({
      data: {
        trackId: track.id,
        name: `${TEST_PREFIX}Stage 1`,
        internalCode: "GRE31S1",
        sequence: 1,
      },
    }),
    db.stage.create({
      data: {
        trackId: track.id,
        name: `${TEST_PREFIX}Stage 2`,
        internalCode: "GRE31S2",
        sequence: 2,
      },
    }),
  ]);
  const semester = await db.semester.create({
    data: {
      name: `${TEST_PREFIX}2072.1`,
      startDate: new Date("2072-02-01"),
      endDate: new Date("2072-06-30"),
    },
  });

  return { firstStageId: first.id, secondStageId: second.id, semesterId: semester.id };
}

export async function createStudent(suffix: string): Promise<{ id: string }> {
  return db.student.create({
    data: { fullName: `${TEST_PREFIX}${suffix}`, status: "ACTIVE" },
    select: { id: true },
  });
}

export async function createPersonalizedClass(
  code: string,
  semesterId: string,
): Promise<{ id: string }> {
  return db.class.create({
    data: {
      capacity: DEFAULT_CLASS_CAPACITY,
      format: "IN_PERSON",
      internalCode: `${TEST_PREFIX}${code}`,
      portalClassName: `${TEST_PREFIX}portal-${code}`,
      scheduleType: "PERSONALIZED",
      semesterId,
      teacherId: TEACHER_USER_ID,
      year: FIXTURE_CLASS_YEAR,
    },
    select: { id: true },
  });
}

export async function createRegularClass(input: {
  code: string;
  sharedStageId: string;
  semesterId: string;
}): Promise<{ id: string }> {
  return db.class.create({
    data: {
      capacity: DEFAULT_CLASS_CAPACITY,
      format: "IN_PERSON",
      internalCode: `${TEST_PREFIX}${input.code}`,
      portalClassName: `${TEST_PREFIX}portal-${input.code}`,
      scheduleType: "REGULAR",
      semesterId: input.semesterId,
      sharedStageId: input.sharedStageId,
      teacherId: TEACHER_USER_ID,
      year: FIXTURE_CLASS_YEAR,
    },
    select: { id: true },
  });
}

/** Enrolls a student into a PERSONALIZED class at `stageId` and returns the enrollment id. */
export async function enrollAtStage(input: {
  studentId: string;
  classId: string;
  stageId: string;
}): Promise<string> {
  const result = await caller().enrollment.create(input);
  return result.enrollment.id;
}

/** Closes an enrollment and its active progress in one transaction (deferred invariant safe). */
export async function closeEnrollment(enrollmentId: string): Promise<void> {
  const enrollment = await db.enrollment.findUniqueOrThrow({
    where: { id: enrollmentId },
    select: { entryDate: true },
  });
  await db.$transaction(async (transaction) => {
    await transaction.pedagogicalProgress.updateMany({
      where: { enrollmentId, endDate: null },
      data: { endDate: enrollment.entryDate, endReason: "DROPPED" },
    });
    await transaction.enrollment.update({
      where: { id: enrollmentId },
      data: { exitDate: enrollment.entryDate, exitReason: "DROPPED" },
    });
  });
}

export async function cleanAdvanceDatabase(): Promise<void> {
  await cleanEnrollmentFixtures({
    prefix: TEST_PREFIX,
    catalogKeyPrefix: CATALOG_KEY_PREFIX,
    teacherId: TEACHER_USER_ID,
  });
}

/** Connect/clean/disconnect lifecycle shared by the advance db and behavior suites. */
export function registerAdvanceDbLifecycle(): void {
  before(async () => {
    await db.$connect();
  });
  beforeEach(async () => {
    await cleanAdvanceDatabase();
  });
  after(async () => {
    await cleanAdvanceDatabase();
    await db.$disconnect();
  });
}
