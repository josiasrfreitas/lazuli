import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { config as loadEnvironment } from "dotenv";
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
  void it("rejects a semester whose start date is after its end date", async () => {
    const observedConstraint1 = await expectConstraintRejection(
      database.semester.create({
        data: { name: `${TEST_PREFIX}inverted`, startDate: FIRST_END, endDate: FIRST_START },
      }),
      ORDER_CONSTRAINT,
    );
    assert.equal(observedConstraint1.includes(ORDER_CONSTRAINT), true);
  });
  void it("rejects a semester that overlaps an existing one", async () => {
    await database.semester.create({
      data: { name: `${TEST_PREFIX}base`, startDate: FIRST_START, endDate: FIRST_END },
    });
    const observedConstraint2 = await expectConstraintRejection(
      database.semester.create({
        data: {
          name: `${TEST_PREFIX}overlap`,
          startDate: new Date("2026-06-01"),
          endDate: new Date("2026-08-31"),
        },
      }),
      OVERLAP_CONSTRAINT,
    );
    assert.equal(observedConstraint2.includes(OVERLAP_CONSTRAINT), true);
  });
  void it("allows two adjacent, non-overlapping semesters", async () => {
    const persistedCount = await allowAdjacentSemesters(database);
    assert.equal(persistedCount, 2);
  });
});
async function cleanDatabase(database: DatabaseClient): Promise<void> {
  await database.semester.deleteMany({
    where: { name: { startsWith: TEST_PREFIX } },
  });
}
async function allowAdjacentSemesters(database: DatabaseClient): Promise<number> {
  await database.semester.create({
    data: { name: `${TEST_PREFIX}first-half`, startDate: FIRST_START, endDate: FIRST_END },
  });
  await database.semester.create({
    data: {
      name: `${TEST_PREFIX}second-half`,
      startDate: new Date("2026-08-01"),
      endDate: new Date("2026-12-20"),
    },
  });
  return database.semester.count({ where: { name: { startsWith: TEST_PREFIX } } });
}
async function expectConstraintRejection(
  action: Promise<unknown>,
  constraintName: string,
): Promise<string> {
  let observedMessage: string | undefined;
  await assert.rejects(action, (error: unknown) => {
    assert.ok(error instanceof Error);
    observedMessage = error.message;
    assert.equal(error.message.includes(constraintName), true);
    return true;
  });
  assert.notEqual(observedMessage, undefined);
  return observedMessage as string;
}
