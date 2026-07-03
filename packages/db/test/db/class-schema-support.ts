import assert from "node:assert/strict";

import type { createDbClient } from "../../src/client.js";

export const TEST_PREFIX = "GRE-29 Schema ";
export const TEACHER_ID = "00000000-0000-0000-0000-000000002901";

type DatabaseClient = ReturnType<typeof createDbClient>;

export async function cleanDatabase(database: DatabaseClient): Promise<void> {
  await database.classScheduleSlot.deleteMany({
    where: {
      class: {
        OR: [
          { internalCode: { startsWith: TEST_PREFIX } },
          {
            sharedStage: {
              track: { productLine: { key: { startsWith: "gre29_schema_" } } },
            },
          },
        ],
      },
    },
  });
  await database.class.deleteMany({
    where: {
      OR: [
        { internalCode: { startsWith: TEST_PREFIX } },
        {
          sharedStage: {
            track: { productLine: { key: { startsWith: "gre29_schema_" } } },
          },
        },
      ],
    },
  });
  await database.semester.deleteMany({
    where: { name: { startsWith: TEST_PREFIX } },
  });
  await database.stage.deleteMany({
    where: {
      track: { productLine: { key: { startsWith: "gre29_schema_" } } },
    },
  });
  await database.track.deleteMany({
    where: { productLine: { key: { startsWith: "gre29_schema_" } } },
  });
  await database.productLine.deleteMany({
    where: { key: { startsWith: "gre29_schema_" } },
  });
  await database.user.deleteMany({
    where: { id: TEACHER_ID },
  });
}

export async function seedTeacher(database: DatabaseClient): Promise<void> {
  await database.user.create({
    data: {
      id: TEACHER_ID,
      email: "gre29-teacher@example.com",
      name: "GRE-29 Teacher",
      role: "TEACHER",
      isEnabled: true,
    },
  });
}

export async function seedCatalog(
  database: DatabaseClient,
): Promise<{ stageId: string; semesterId: string }> {
  const productLine = await database.productLine.create({
    data: {
      key: "gre29_schema_line",
      name: `${TEST_PREFIX}Line`,
      status: "ACTIVE",
    },
  });
  const track = await database.track.create({
    data: {
      productLineId: productLine.id,
      name: `${TEST_PREFIX}Track`,
      status: "ACTIVE",
    },
  });
  const stage = await database.stage.create({
    data: {
      trackId: track.id,
      name: `${TEST_PREFIX}Stage`,
      internalCode: "GRE29SCHEMATUI",
      sequence: 1,
    },
  });
  const semester = await database.semester.create({
    data: {
      name: `${TEST_PREFIX}2030.1`,
      startDate: new Date("2030-02-01"),
      endDate: new Date("2030-06-30"),
    },
  });

  return { stageId: stage.id, semesterId: semester.id };
}

export async function expectConstraintRejection(
  promise: Promise<unknown>,
  ...needles: string[]
): Promise<void> {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(isErrorLike(error));
    const message = String(error.message);
    assert.ok(needles.some((needle) => message.includes(needle)));
    return true;
  });
}

function isErrorLike(error: unknown): error is Error {
  return error instanceof Error;
}
