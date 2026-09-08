import assert from "node:assert/strict";
import { after, before, beforeEach, describe } from "node:test";

import { config as loadEnvironment } from "dotenv";

import { databaseIt } from "../support.js";

loadEnvironment({ path: new URL("../../../../.env", import.meta.url), quiet: true });

const { createDbClient } = await import("../../src/client.js");

const TEST_PREFIX = "GRE-22 ";
const OVERLAP_CONSTRAINT = "Semester_no_overlap_excl";
const ORDER_CONSTRAINT = "Semester_start_not_after_end_check";

const FIRST_START = new Date("2026-02-01");
const FIRST_END = new Date("2026-06-30");

type DatabaseClient = ReturnType<typeof createDbClient>;

void describe("semester schema", () => {
  const database = createDbClient();

  void before(async () => {
    await database.$connect();
  });

  void beforeEach(async () => {
    await cleanDatabase(database);
  });

  void after(async () => {
    await cleanDatabase(database);
    await database.$disconnect();
  });

  databaseIt("creates and reads a semester window", () => createAndReadSemester(database));

  databaseIt("rejects a semester whose start date is after its end date", () =>
    rejectInvertedWindow(database),
  );

  databaseIt("rejects a semester that overlaps an existing one", () =>
    rejectOverlappingSemester(database),
  );

  databaseIt("allows two adjacent, non-overlapping semesters", () =>
    allowAdjacentSemesters(database),
  );
});

async function cleanDatabase(database: DatabaseClient): Promise<void> {
  await database.semester.deleteMany({
    where: { name: { startsWith: TEST_PREFIX } },
  });
}

async function createAndReadSemester(database: DatabaseClient): Promise<void> {
  const created = await database.semester.create({
    data: { name: `${TEST_PREFIX}2026.1`, startDate: FIRST_START, endDate: FIRST_END },
  });

  const found = await database.semester.findUnique({ where: { id: created.id } });

  assert.equal(found?.name, `${TEST_PREFIX}2026.1`);
}

async function rejectInvertedWindow(database: DatabaseClient): Promise<void> {
  await expectConstraintRejection(
    database.semester.create({
      data: { name: `${TEST_PREFIX}inverted`, startDate: FIRST_END, endDate: FIRST_START },
    }),
    ORDER_CONSTRAINT,
  );
}

async function rejectOverlappingSemester(database: DatabaseClient): Promise<void> {
  await database.semester.create({
    data: { name: `${TEST_PREFIX}base`, startDate: FIRST_START, endDate: FIRST_END },
  });

  await expectConstraintRejection(
    database.semester.create({
      data: {
        name: `${TEST_PREFIX}overlap`,
        startDate: new Date("2026-06-01"),
        endDate: new Date("2026-08-31"),
      },
    }),
    OVERLAP_CONSTRAINT,
  );
}

async function allowAdjacentSemesters(database: DatabaseClient): Promise<void> {
  await database.semester.create({
    data: { name: `${TEST_PREFIX}first-half`, startDate: FIRST_START, endDate: FIRST_END },
  });

  const second = await database.semester.create({
    data: {
      name: `${TEST_PREFIX}second-half`,
      startDate: new Date("2026-08-01"),
      endDate: new Date("2026-12-20"),
    },
  });

  assert.equal(second.name, `${TEST_PREFIX}second-half`);
}

async function expectConstraintRejection(
  action: Promise<unknown>,
  constraintName: string,
): Promise<void> {
  await assert.rejects(action, (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.equal(error.message.includes(constraintName), true);
    return true;
  });
}
