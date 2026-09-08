import assert from "node:assert/strict";

import type { createDbClient } from "../../src/client.js";

export const TEST_PREFIX = "GRE-26 Schema ";
export const TEACHER_ID = "00000000-0000-0000-0000-000000002601";
export const ENTRY_DATE = new Date("2026-01-10T00:00:00.000Z");
export const CLOSE_DATE = new Date("2026-02-01T00:00:00.000Z");
export const FIRST_PROGRESS_END_DATE = new Date("2026-01-31T00:00:00.000Z");
export const OVERLAP_START_DATE = new Date("2026-01-20T00:00:00.000Z");
export const OVERLAP_END_DATE = new Date("2026-02-10T00:00:00.000Z");
export const REGULAR_SEMESTER_NAME = `${TEST_PREFIX}2076.1`;

export const ACTIVE_PROGRESS_REQUIRED = "Enrollment_active_progress_required_check";
export const ACTIVE_STUDENT_TRACK = "Enrollment_active_student_track_key";
export const ARCHIVED_CLASS = "Enrollment_class_not_archived_check";
export const CAPACITY_OVERRIDE_REQUIRED = "Enrollment_capacity_override_required_check";
export const CLOSED_PROGRESS_ABSENT = "Enrollment_closed_progress_absent_check";
export const LEGACY_TRACK_BLOCKED = "PedagogicalProgress_legacy_track_blocked_check";
export const PROGRESS_NO_OVERLAP = "PedagogicalProgress_no_overlap_excl";
export const REGULAR_STAGE_MATCH = "PedagogicalProgress_regular_stage_match_check";

const CATALOG_KEY_PREFIX = "gre26_schema_";
const CATALOG_KEY = `${CATALOG_KEY_PREFIX}line`;

export type DatabaseClient = ReturnType<typeof createDbClient>;
export type EnrollmentWriteClient = Pick<
  DatabaseClient,
  "$executeRaw" | "enrollment" | "pedagogicalProgress"
>;

export type CatalogFixture = {
  activeStageId: string;
  legacyStageId: string;
  sameTrackSecondStageId: string;
  secondTrackStageId: string;
};

export async function cleanDatabase(database: DatabaseClient): Promise<void> {
  await database.pedagogicalProgress.deleteMany({
    where: { enrollment: { student: { fullName: { startsWith: TEST_PREFIX } } } },
  });
  await database.enrollment.deleteMany({
    where: { student: { fullName: { startsWith: TEST_PREFIX } } },
  });
  await database.student.deleteMany({
    where: { fullName: { startsWith: TEST_PREFIX } },
  });
  await database.class.deleteMany({
    where: { internalCode: { startsWith: TEST_PREFIX } },
  });
  await database.semester.deleteMany({
    where: { name: { startsWith: TEST_PREFIX } },
  });
  await database.stage.deleteMany({
    where: { track: { productLine: { key: { startsWith: CATALOG_KEY_PREFIX } } } },
  });
  await database.track.deleteMany({
    where: { productLine: { key: { startsWith: CATALOG_KEY_PREFIX } } },
  });
  await database.productLine.deleteMany({
    where: { key: { startsWith: CATALOG_KEY_PREFIX } },
  });
  await database.user.deleteMany({ where: { id: TEACHER_ID } });
}

export async function seedTeacher(database: DatabaseClient): Promise<void> {
  await database.user.create({
    data: {
      id: TEACHER_ID,
      email: "gre26-teacher@example.com",
      isEnabled: true,
      name: "GRE-26 Teacher",
      role: "TEACHER",
    },
  });
}

export async function seedCatalog(database: DatabaseClient): Promise<CatalogFixture> {
  const productLine = await createProductLine(database);
  const tracks = await createTracks(database, productLine.id);
  const stages = await createStages(database, tracks);
  await createRegularSemester(database);

  return stages;
}

export async function createStudent(
  database: DatabaseClient,
  suffix: string,
): Promise<{ id: string }> {
  return database.student.create({
    data: { fullName: `${TEST_PREFIX}${suffix}` },
    select: { id: true },
  });
}

export async function createPersonalizedClass(
  database: DatabaseClient,
  input: { capacity: number; code: string; status?: "ACTIVE" | "ARCHIVED" },
): Promise<{ id: string }> {
  const semester = await ensureRegularSemester(database);

  return database.class.create({
    data: {
      capacity: input.capacity,
      format: "IN_PERSON",
      internalCode: `${TEST_PREFIX}${input.code}`,
      portalClassName: `${TEST_PREFIX}portal-${input.code}`,
      scheduleType: "PERSONALIZED",
      semesterId: semester.id,
      status: input.status ?? "ACTIVE",
      teacherId: TEACHER_ID,
      year: 2026,
    },
    select: { id: true },
  });
}

export async function createRegularClass(
  database: DatabaseClient,
  input: { code: string; sharedStageId: string },
): Promise<{ id: string }> {
  const semester = await database.semester.findFirstOrThrow({
    where: { name: REGULAR_SEMESTER_NAME },
    select: { id: true },
  });

  return database.class.create({
    data: {
      capacity: 8,
      format: "IN_PERSON",
      internalCode: `${TEST_PREFIX}${input.code}`,
      portalClassName: `${TEST_PREFIX}portal-${input.code}`,
      scheduleType: "REGULAR",
      semesterId: semester.id,
      sharedStageId: input.sharedStageId,
      teacherId: TEACHER_ID,
      year: 2026,
    },
    select: { id: true },
  });
}

export async function createActiveEnrollmentWithProgress(
  database: DatabaseClient,
  input: {
    capacityOverrideReason?: string;
    classId: string;
    stageId: string;
    studentId: string;
  },
): Promise<{ id: string }> {
  return database.$transaction((transaction) =>
    createActiveEnrollmentWithProgressInTransaction(transaction, input),
  );
}

export async function createActiveEnrollmentWithProgressInTransaction(
  database: EnrollmentWriteClient,
  input: {
    capacityOverrideReason?: string;
    classId: string;
    stageId: string;
    studentId: string;
  },
): Promise<{ id: string }> {
  const enrollment = await database.enrollment.create({
    data: toEnrollmentCreateData(input),
    select: { id: true },
  });
  await database.pedagogicalProgress.create({
    data: {
      enrollmentId: enrollment.id,
      stageId: input.stageId,
      startDate: ENTRY_DATE,
    },
  });
  return enrollment;
}

export async function expectConstraintRejection(
  promise: Promise<unknown>,
  ...needles: string[]
): Promise<string> {
  let observedMessage: string | undefined;
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof Error);
    const message = error.message;
    observedMessage = message;
    assert.equal(
      needles.some((needle) => message.includes(needle)),
      true,
      `Expected error message to include one of ${needles.join(", ")}, received: ${message}`,
    );
    return true;
  });
  assert.notEqual(observedMessage, undefined);
  return observedMessage as string;
}

export async function createAndCloseImportedLegacyLifecycle(
  database: DatabaseClient,
  input: { classId: string; stageId: string; studentId: string },
): Promise<void> {
  const imported = await database.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT set_config('lazuli.allow_legacy_enrollment', 'on', true)`;
    const enrollment = await createActiveEnrollmentWithProgressInTransaction(transaction, input);
    const progress = await transaction.pedagogicalProgress.findFirstOrThrow({
      where: { enrollmentId: enrollment.id, endDate: null },
      select: { id: true },
    });
    return { enrollmentId: enrollment.id, progressId: progress.id };
  });
  await database.$transaction(async (transaction) => {
    await transaction.enrollment.update({
      where: { id: imported.enrollmentId },
      data: { exitDate: CLOSE_DATE, exitReason: "CORRECTION" },
    });
    await transaction.pedagogicalProgress.update({
      where: { id: imported.progressId },
      data: { endDate: CLOSE_DATE, endReason: "CORRECTION" },
    });
  });
}

async function createProductLine(database: DatabaseClient): Promise<{ id: string }> {
  return database.productLine.create({
    data: {
      key: CATALOG_KEY,
      name: `${TEST_PREFIX}Line`,
      status: "ACTIVE",
    },
    select: { id: true },
  });
}

async function createTracks(
  database: DatabaseClient,
  productLineId: string,
): Promise<{ activeTrackId: string; legacyTrackId: string; secondTrackId: string }> {
  const activeTrack = await createTrack(database, {
    nameSuffix: "Active Track",
    productLineId,
    status: "ACTIVE",
  });
  const secondTrack = await createTrack(database, {
    nameSuffix: "Second Track",
    productLineId,
    status: "ACTIVE",
  });
  const legacyTrack = await createTrack(database, {
    nameSuffix: "Legacy Track",
    productLineId,
    status: "LEGACY",
  });

  return {
    activeTrackId: activeTrack.id,
    legacyTrackId: legacyTrack.id,
    secondTrackId: secondTrack.id,
  };
}

async function createTrack(
  database: DatabaseClient,
  input: { nameSuffix: string; productLineId: string; status: "ACTIVE" | "LEGACY" },
): Promise<{ id: string }> {
  return database.track.create({
    data: {
      name: `${TEST_PREFIX}${input.nameSuffix}`,
      productLineId: input.productLineId,
      status: input.status,
    },
    select: { id: true },
  });
}

async function createStages(
  database: DatabaseClient,
  tracks: { activeTrackId: string; legacyTrackId: string; secondTrackId: string },
): Promise<CatalogFixture> {
  const activeStage = await createStage(database, {
    internalCode: "GRE26A1",
    nameSuffix: "Active",
    sequence: 1,
    trackId: tracks.activeTrackId,
  });
  const sameTrackSecondStage = await createStage(database, {
    internalCode: "GRE26A2",
    nameSuffix: "Active 2",
    sequence: 2,
    trackId: tracks.activeTrackId,
  });
  const secondTrackStage = await createStage(database, {
    internalCode: "GRE26B1",
    nameSuffix: "Second",
    sequence: 1,
    trackId: tracks.secondTrackId,
  });
  const legacyStage = await createStage(database, {
    internalCode: "GRE26L1",
    nameSuffix: "Legacy",
    sequence: 1,
    trackId: tracks.legacyTrackId,
  });

  return {
    activeStageId: activeStage.id,
    legacyStageId: legacyStage.id,
    sameTrackSecondStageId: sameTrackSecondStage.id,
    secondTrackStageId: secondTrackStage.id,
  };
}

async function createStage(
  database: DatabaseClient,
  input: { internalCode: string; nameSuffix: string; sequence: number; trackId: string },
): Promise<{ id: string }> {
  return database.stage.create({
    data: {
      internalCode: input.internalCode,
      name: `${TEST_PREFIX}${input.nameSuffix} Stage`,
      sequence: input.sequence,
      trackId: input.trackId,
    },
    select: { id: true },
  });
}

async function ensureRegularSemester(database: DatabaseClient): Promise<{ id: string }> {
  const existing = await database.semester.findFirst({
    where: { name: REGULAR_SEMESTER_NAME },
    select: { id: true },
  });
  if (existing !== null) {
    return existing;
  }

  return database.semester.create({
    data: {
      endDate: new Date("2076-06-30T00:00:00.000Z"),
      name: REGULAR_SEMESTER_NAME,
      startDate: new Date("2076-01-01T00:00:00.000Z"),
    },
    select: { id: true },
  });
}

async function createRegularSemester(database: DatabaseClient): Promise<void> {
  await ensureRegularSemester(database);
}

function toEnrollmentCreateData(input: {
  capacityOverrideReason?: string;
  classId: string;
  studentId: string;
}): { capacityOverrideReason?: string; classId: string; entryDate: Date; studentId: string } {
  return {
    classId: input.classId,
    entryDate: ENTRY_DATE,
    studentId: input.studentId,
    ...(input.capacityOverrideReason === undefined
      ? {}
      : { capacityOverrideReason: input.capacityOverrideReason }),
  };
}
