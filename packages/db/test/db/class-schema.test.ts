import assert from "node:assert/strict";
import { after, before, beforeEach, describe } from "node:test";

import { config as loadEnvironment } from "dotenv";

import { databaseIt } from "../support.js";
import {
  cleanDatabase,
  expectConstraintRejection,
  seedCatalog,
  seedTeacher,
  TEACHER_ID,
  TEST_PREFIX,
} from "./class-schema-support.js";

loadEnvironment({ path: new URL("../../../../.env", import.meta.url), quiet: true });

const { createDbClient } = await import("../../src/client.js");

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
