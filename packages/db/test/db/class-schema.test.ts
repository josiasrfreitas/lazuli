import assert from "node:assert/strict";
import { after, before, beforeEach, describe } from "node:test";

import { config as loadEnvironment } from "dotenv";

import { databaseIt } from "../support.js";

loadEnvironment({ path: new URL("../../../../.env", import.meta.url), quiet: true });

const { createDbClient } = await import("../../src/client.js");

const TEST_PREFIX = "GRE-29 Schema ";
const TEACHER_ID = "00000000-0000-0000-0000-000000002901";
const CAPACITY_CONSTRAINT = "Class_capacity_positive_check";
const REGULAR_STAGE_CONSTRAINT = "Class_regular_requires_shared_stage_check";
const SLOT_ORDER_CONSTRAINT = "ClassScheduleSlot_start_before_end_check";
const ACTIVE_PORTAL_INDEX = "Class_active_portal_class_name_key";

type DatabaseClient = ReturnType<typeof createDbClient>;

void describe("class catalog schema", () => {
  const database = createDbClient();

  void before(async () => {
    await database.$connect();
  });

  void beforeEach(async () => {
    await cleanDatabase(database);
    await seedTeacher(database);
  });

  void after(async () => {
    await cleanDatabase(database);
    await database.$disconnect();
  });

  databaseIt("creates a regular class with schedule slots", () => createRegularClass(database));

  databaseIt("rejects non-positive capacity", () => rejectNonPositiveCapacity(database));

  databaseIt("rejects regular class without shared stage", () =>
    rejectRegularWithoutSharedStage(database),
  );

  databaseIt("rejects duplicate active portal class names", () =>
    rejectDuplicateActivePortalClassName(database),
  );

  databaseIt("rejects inverted schedule slot times", () => rejectInvertedSlotTimes(database));
});

async function cleanDatabase(database: DatabaseClient): Promise<void> {
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

async function seedTeacher(database: DatabaseClient): Promise<void> {
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

async function seedCatalog(database: DatabaseClient): Promise<{ stageId: string; semesterId: string }> {
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

async function createRegularClass(database: DatabaseClient): Promise<void> {
  const { stageId, semesterId } = await seedCatalog(database);

  const created = await database.class.create({
    data: {
      internalCode: `${TEST_PREFIX}Regular`,
      teacherId: TEACHER_ID,
      scheduleType: "REGULAR",
      format: "IN_PERSON",
      sharedStageId: stageId,
      semesterId,
      year: 2026,
      capacity: 12,
      portalClassName: "REG/TUI-TER-14:00/16:00-1S/26-1",
      scheduleSlots: {
        create: {
          weekday: "TUESDAY",
          startTime: new Date("1970-01-01T14:00:00.000Z"),
          endTime: new Date("1970-01-01T16:00:00.000Z"),
        },
      },
    },
    include: { scheduleSlots: true },
  });

  assert.equal(created.scheduleSlots.length, 1);
  assert.equal(created.status, "ACTIVE");
}

async function rejectNonPositiveCapacity(database: DatabaseClient): Promise<void> {
  const { stageId, semesterId } = await seedCatalog(database);

  await expectConstraintRejection(
    database.class.create({
      data: {
        internalCode: `${TEST_PREFIX}ZeroCap`,
        teacherId: TEACHER_ID,
        scheduleType: "REGULAR",
        format: "IN_PERSON",
        sharedStageId: stageId,
        semesterId,
        year: 2026,
        capacity: 0,
        portalClassName: `${TEST_PREFIX}portal-zero`,
      },
    }),
    CAPACITY_CONSTRAINT,
  );
}

async function rejectRegularWithoutSharedStage(database: DatabaseClient): Promise<void> {
  const { semesterId } = await seedCatalog(database);

  await expectConstraintRejection(
    database.class.create({
      data: {
        internalCode: `${TEST_PREFIX}NoStage`,
        teacherId: TEACHER_ID,
        scheduleType: "REGULAR",
        format: "IN_PERSON",
        semesterId,
        year: 2026,
        capacity: 8,
        portalClassName: `${TEST_PREFIX}portal-no-stage`,
      },
    }),
    REGULAR_STAGE_CONSTRAINT,
  );
}

async function rejectDuplicateActivePortalClassName(database: DatabaseClient): Promise<void> {
  const { stageId, semesterId } = await seedCatalog(database);
  const portalClassName = `${TEST_PREFIX}portal-dup`;

  await database.class.create({
    data: {
      internalCode: `${TEST_PREFIX}First`,
      teacherId: TEACHER_ID,
      scheduleType: "REGULAR",
      format: "IN_PERSON",
      sharedStageId: stageId,
      semesterId,
      year: 2026,
      capacity: 8,
      portalClassName,
    },
  });

  await expectConstraintRejection(
    database.class.create({
      data: {
        internalCode: `${TEST_PREFIX}Second`,
        teacherId: TEACHER_ID,
        scheduleType: "REGULAR",
        format: "IN_PERSON",
        sharedStageId: stageId,
        semesterId,
        year: 2026,
        capacity: 8,
        portalClassName,
      },
    }),
    ACTIVE_PORTAL_INDEX,
    "portal_class_name",
  );
}

async function rejectInvertedSlotTimes(database: DatabaseClient): Promise<void> {
  const { stageId, semesterId } = await seedCatalog(database);

  await expectConstraintRejection(
    database.class.create({
      data: {
        internalCode: `${TEST_PREFIX}BadSlot`,
        teacherId: TEACHER_ID,
        scheduleType: "REGULAR",
        format: "IN_PERSON",
        sharedStageId: stageId,
        semesterId,
        year: 2026,
        capacity: 8,
        portalClassName: `${TEST_PREFIX}portal-bad-slot`,
        scheduleSlots: {
          create: {
            weekday: "MONDAY",
            startTime: new Date("1970-01-01T18:00:00.000Z"),
            endTime: new Date("1970-01-01T17:00:00.000Z"),
          },
        },
      },
    }),
    SLOT_ORDER_CONSTRAINT,
  );
}

async function expectConstraintRejection(
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
