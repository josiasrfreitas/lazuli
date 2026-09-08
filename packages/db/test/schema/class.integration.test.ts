import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { config as loadEnvironment } from "dotenv";
import {
  cleanDatabase,
  expectConstraintRejection,
  seedCatalog,
  seedTeacher,
  TEACHER_ID,
  TEST_PREFIX,
} from "../support/class-schema-support.js";
loadEnvironment({ path: new URL("../../../../.env", import.meta.url), quiet: true });
const { createDbClient } = await import("../../src/client.js");
const CAPACITY_CONSTRAINT = "Class_capacity_positive_check";
const REGULAR_STAGE_CONSTRAINT = "Class_regular_requires_shared_stage_check";
const REQUIRES_SEMESTER_CONSTRAINT = "not-null";
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
  registerSchemaTest1(database);
  registerSchemaTest2(database);
  registerSchemaTest3(database);
  registerSchemaTest4(database);
  registerSchemaTest5(database);
  registerSchemaTest6(database);
});
function registerSchemaTest1(database: DatabaseClient): void {
  void it("creates a regular class with schedule slots", async () => {
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
  });
}
function registerSchemaTest2(database: DatabaseClient): void {
  void it("rejects non-positive capacity", async () => {
    const { stageId, semesterId } = await seedCatalog(database);
    const observedConstraint1 = await expectConstraintRejection(
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
    assert.equal(observedConstraint1.includes(CAPACITY_CONSTRAINT), true);
  });
}
function registerSchemaTest3(database: DatabaseClient): void {
  void it("rejects regular class without shared stage", async () => {
    const { semesterId } = await seedCatalog(database);
    const observedConstraint2 = await expectConstraintRejection(
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
    assert.equal(observedConstraint2.includes(REGULAR_STAGE_CONSTRAINT), true);
  });
}
function registerSchemaTest4(database: DatabaseClient): void {
  void it("rejects personalized class without semester", async () => {
    const internalCode = `${TEST_PREFIX}NoSemesterPpt`;
    const portalClassName = `${TEST_PREFIX}portal-no-semester-ppt`;
    const observedConstraint3 = await expectConstraintRejection(
      database.$executeRaw`
      INSERT INTO "Class" (
        id,
        internal_code,
        teacher_id,
        schedule_type,
        format,
        year,
        capacity,
        status,
        portal_class_name,
        original_portal_class_name,
        created_at,
        updated_at
      ) VALUES (
        gen_random_uuid(),
        ${internalCode},
        ${TEACHER_ID}::uuid,
        'PERSONALIZED',
        'IN_PERSON',
        2026,
        1,
        'ACTIVE',
        ${portalClassName},
        ${portalClassName},
        NOW(),
        NOW()
      )
    `,
      REQUIRES_SEMESTER_CONSTRAINT,
    );
    assert.equal(observedConstraint3.includes(REQUIRES_SEMESTER_CONSTRAINT), true);
  });
}
function registerSchemaTest5(database: DatabaseClient): void {
  void it("rejects duplicate active portal class names", async () => {
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
    const observedMessage = await expectConstraintRejection(
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
    assert.equal(
      [ACTIVE_PORTAL_INDEX, "portal_class_name"].some((needle) => observedMessage.includes(needle)),
      true,
    );
  });
}
function registerSchemaTest6(database: DatabaseClient): void {
  void it("rejects inverted schedule slot times", async () => {
    const { stageId, semesterId } = await seedCatalog(database);
    const observedConstraint4 = await expectConstraintRejection(
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
    assert.equal(observedConstraint4.includes(SLOT_ORDER_CONSTRAINT), true);
  });
}
