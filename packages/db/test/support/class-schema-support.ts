import assert from "node:assert/strict";

import type { createDbClient } from "../../src/client.js";

export const TEST_PREFIX = "GRE-29 Schema ";
export const TEACHER_ID = "00000000-0000-0000-0000-000000006502";
const CATALOG_KEY_PREFIX = "gre29_schema_";

export type ClassSchemaFixtureConfig = {
  testPrefix: string;
  teacherId: string;
  catalogKeyPrefix: string;
  teacherEmail: string;
  teacherName: string;
  stageInternalCode: string;
  semesterName: string;
  semesterStartDate: Date;
  semesterEndDate: Date;
};

const DEFAULT_FIXTURE: ClassSchemaFixtureConfig = {
  testPrefix: TEST_PREFIX,
  teacherId: TEACHER_ID,
  catalogKeyPrefix: CATALOG_KEY_PREFIX,
  teacherEmail: "gre65-schema-teacher@example.com",
  teacherName: "GRE-29 Teacher",
  stageInternalCode: "GRE29SCHEMATUI",
  semesterName: `${TEST_PREFIX}2030.1`,
  semesterStartDate: new Date("2030-02-01"),
  semesterEndDate: new Date("2030-06-30"),
};

type DatabaseClient = ReturnType<typeof createDbClient>;

export async function cleanDatabase(
  database: DatabaseClient,
  fixture: ClassSchemaFixtureConfig = DEFAULT_FIXTURE,
): Promise<void> {
  await cleanClassRows(database, fixture);
  await cleanCatalogRows(database, fixture);
  await database.user.deleteMany({
    where: { id: fixture.teacherId },
  });
}

async function cleanClassRows(
  database: DatabaseClient,
  fixture: ClassSchemaFixtureConfig,
): Promise<void> {
  await database.classSession.deleteMany({
    where: { class: classCleanupWhere(fixture) },
  });
  await database.classScheduleSlot.deleteMany({
    where: { class: classCleanupWhere(fixture) },
  });
  await database.class.deleteMany({
    where: classCleanupWhere(fixture),
  });
}

async function cleanCatalogRows(
  database: DatabaseClient,
  fixture: ClassSchemaFixtureConfig,
): Promise<void> {
  await database.semester.deleteMany({
    where: { name: { startsWith: fixture.testPrefix } },
  });
  await database.stage.deleteMany({
    where: {
      track: { productLine: { key: { startsWith: fixture.catalogKeyPrefix } } },
    },
  });
  await database.track.deleteMany({
    where: { productLine: { key: { startsWith: fixture.catalogKeyPrefix } } },
  });
  await database.productLine.deleteMany({
    where: { key: { startsWith: fixture.catalogKeyPrefix } },
  });
}

function classCleanupWhere(fixture: ClassSchemaFixtureConfig): {
  OR: [
    { internalCode: { startsWith: string } },
    { sharedStage: { track: { productLine: { key: { startsWith: string } } } } },
  ];
} {
  return {
    OR: [
      { internalCode: { startsWith: fixture.testPrefix } },
      {
        sharedStage: {
          track: { productLine: { key: { startsWith: fixture.catalogKeyPrefix } } },
        },
      },
    ],
  };
}

export async function seedTeacher(
  database: DatabaseClient,
  fixture: ClassSchemaFixtureConfig = DEFAULT_FIXTURE,
): Promise<void> {
  await database.user.create({
    data: {
      id: fixture.teacherId,
      email: fixture.teacherEmail,
      name: fixture.teacherName,
      role: "TEACHER",
      isEnabled: true,
    },
  });
}

export async function seedCatalog(
  database: DatabaseClient,
  fixture: ClassSchemaFixtureConfig = DEFAULT_FIXTURE,
): Promise<{ stageId: string; semesterId: string }> {
  const productLine = await database.productLine.create({
    data: {
      key: `${fixture.catalogKeyPrefix}line`,
      name: `${fixture.testPrefix}Line`,
      status: "ACTIVE",
    },
  });
  const track = await database.track.create({
    data: {
      productLineId: productLine.id,
      name: `${fixture.testPrefix}Track`,
      status: "ACTIVE",
    },
  });
  const stage = await database.stage.create({
    data: {
      trackId: track.id,
      name: `${fixture.testPrefix}Stage`,
      internalCode: fixture.stageInternalCode,
      sequence: 1,
    },
  });
  const semester = await database.semester.create({
    data: {
      name: fixture.semesterName,
      startDate: fixture.semesterStartDate,
      endDate: fixture.semesterEndDate,
    },
  });

  return { stageId: stage.id, semesterId: semester.id };
}

export async function expectConstraintRejection(
  promise: Promise<unknown>,
  ...needles: string[]
): Promise<string> {
  let observedMessage: string | undefined;
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(isErrorLike(error));
    const message = String(error.message);
    observedMessage = message;
    assert.ok(needles.some((needle) => message.includes(needle)));
    return true;
  });
  assert.notEqual(observedMessage, undefined);
  return observedMessage as string;
}

function isErrorLike(error: unknown): error is Error {
  return error instanceof Error;
}
