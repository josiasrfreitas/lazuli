import assert from "node:assert/strict";

import { db } from "@lazuli/db";

import { createEnrollmentSuite, type TwoStageCatalog } from "./enrollment-suite-support.js";
import { caller } from "./enrollment-test-support.js";

// Generic, prefix-agnostic helpers are shared with the other enrollment suites.
export {
  ADMIN,
  callHttpMutation,
  caller,
  expectRejects,
  HTTP_OK,
} from "./enrollment-test-support.js";
export { assertActiveStageAndOpenEnrollment } from "./enrollment-suite-support.js";

// Distinct prefix / catalog key / semester / teacher from the GRE-30 and GRE-31 suites: `test:integration`
// runs files in parallel processes against one database, so shared identifiers would race on the
// global semester exclusion and catalog uniques.
export const TEST_PREFIX = "GRE-32 Lifecycle ";
export const CATALOG_KEY = "gre32_lifecycle_line";
export const CATALOG_KEY_PREFIX = "gre32_lifecycle_";
export const TEACHER_USER_ID = "00000000-0000-0000-0000-000000003201";

export type TwoStageCatalogFixture = TwoStageCatalog;

const suite = createEnrollmentSuite({
  prefix: TEST_PREFIX,
  catalogKey: CATALOG_KEY,
  catalogKeyPrefix: CATALOG_KEY_PREFIX,
  teacherId: TEACHER_USER_ID,
  teacherEmail: "gre32-lifecycle-teacher@example.com",
  teacherName: "GRE-32 Lifecycle Teacher",
  semesterName: `${TEST_PREFIX}2073.1`,
  semesterStart: "2073-02-01",
  semesterEnd: "2073-06-30",
});

export const ensureTeacherUser = suite.ensureTeacherUser;
export const seedTwoStageCatalog = suite.seedTwoStageCatalog;
export const createStudent = suite.createStudent;
export const createRegularClass = suite.createRegularClass;
export const createPersonalizedClass = suite.createPersonalizedClass;
export const registerLifecycleDbLifecycle = suite.registerDbLifecycle;

/** Enrolls a student into a REGULAR class (stage derives from the class) and returns its id. */
export async function enrollRegular(input: {
  studentId: string;
  classId: string;
}): Promise<string> {
  const result = await caller().enrollment.create(input);
  return result.enrollment.id;
}

/** Enrolls a student into a PERSONALIZED class at `stageId` and returns the enrollment id. */
export async function enrollPersonalized(input: {
  studentId: string;
  classId: string;
  stageId: string;
}): Promise<string> {
  const result = await caller().enrollment.create(input);
  return result.enrollment.id;
}

/** Asserts the enrollment is closed with `exitReason` and its progress closed with the same reason. */
export async function assertEnrollmentClosed(input: {
  enrollmentId: string;
  exitReason: "TRANSFERRED" | "DROPPED" | "SUSPENDED";
}): Promise<void> {
  const enrollment = await db.enrollment.findUniqueOrThrow({
    where: { id: input.enrollmentId },
    select: { exitDate: true, exitReason: true },
  });
  assert.notEqual(enrollment.exitDate, null);
  assert.equal(enrollment.exitReason, input.exitReason);

  const activeProgress = await db.pedagogicalProgress.count({
    where: { enrollmentId: input.enrollmentId, endDate: null },
  });
  assert.equal(activeProgress, 0);

  const closedProgress = await db.pedagogicalProgress.findMany({
    where: { enrollmentId: input.enrollmentId, endDate: { not: null } },
    select: { endReason: true },
  });
  assert.equal(closedProgress.length, 1);
  assert.equal(closedProgress[0]?.endReason, input.exitReason);
}
