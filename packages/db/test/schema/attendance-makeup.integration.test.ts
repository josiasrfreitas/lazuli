import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { config as loadEnvironment } from "dotenv";
import {
  CANCEL_ATTEND_EXCLUSIVE_CONSTRAINT,
  cleanDatabase,
  expectConstraintRejection,
  LAST_MODIFIED_FACTS_CONSTRAINT,
  seedAttendanceFixture,
  UNIQUE_CONSTRAINT_MESSAGE,
  type DatabaseClient,
} from "../support/attendance-makeup-schema-support.js";
loadEnvironment({ path: new URL("../../../../.env", import.meta.url), quiet: true });
const { createDbClient } = await import("../../src/client.js");
void describe("attendance and makeup schema", () => {
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
  registerSchemaTest1(database);
  registerSchemaTest2(database);
  registerSchemaTest3(database);
  registerSchemaTest4(database);
  registerSchemaTest5(database);
  registerSchemaTest6(database);
});
async function commitPresentRow(database: DatabaseClient): Promise<{
  attendance: {
    recordedAt: Date;
    status: string;
  };
  transactionStartedAt: Date;
}> {
  const { enrollmentId, classSessionId } = await seedAttendanceFixture(database);
  const [row] = await database.$queryRaw<
    [{ recordedAt: Date; status: string; transactionStartedAt: Date }]
  >`
    INSERT INTO "Attendance" (
      "id", "updated_at", "enrollment_id", "class_session_id", "status"
    ) VALUES (
      gen_random_uuid(), transaction_timestamp(), ${enrollmentId}::uuid,
      ${classSessionId}::uuid, CAST(${"PRESENT"} AS "AttendanceStatus")
    )
    RETURNING "recorded_at" AS "recordedAt", "status"::text AS "status",
      transaction_timestamp() AS "transactionStartedAt"
  `;
  assert.notEqual(row, undefined);
  const { transactionStartedAt, ...attendance } = row;
  return { attendance, transactionStartedAt };
}
async function scheduleMakeup(database: DatabaseClient): Promise<{
  transactionStartedAt: Date;
  makeup: {
    attendedAt: Date | null;
    cancelledAt: Date | null;
    scheduledAt: Date;
  };
}> {
  const { enrollmentId, classSessionId } = await seedAttendanceFixture(database);
  const [row] = await database.$queryRaw<
    [
      {
        attendedAt: Date | null;
        cancelledAt: Date | null;
        scheduledAt: Date;
        transactionStartedAt: Date;
      },
    ]
  >`
    INSERT INTO "Makeup" (
      "id", "updated_at", "origin_enrollment_id", "target_class_session_id"
    ) VALUES (
      gen_random_uuid(), transaction_timestamp(), ${enrollmentId}::uuid,
      ${classSessionId}::uuid
    )
    RETURNING "scheduled_at" AS "scheduledAt", "attended_at" AS "attendedAt",
      "cancelled_at" AS "cancelledAt",
      transaction_timestamp() AS "transactionStartedAt"
  `;
  assert.notEqual(row, undefined);
  const { transactionStartedAt, ...makeup } = row;
  return { makeup, transactionStartedAt };
}
function registerSchemaTest1(database: DatabaseClient): void {
  void it("defaults a committed attendance row's recorded timestamp", async () => {
    const { attendance, transactionStartedAt } = await commitPresentRow(database);
    assert.equal(attendance.status, "PRESENT");
    assert.equal(attendance.recordedAt.getTime(), transactionStartedAt.getTime());
  });
}
function registerSchemaTest2(database: DatabaseClient): void {
  void it("rejects a duplicate attendance row for one enrollment and session", async () => {
    const { enrollmentId, classSessionId } = await seedAttendanceFixture(database);
    await database.attendance.create({ data: { enrollmentId, classSessionId, status: "PRESENT" } });
    const observedConstraint1 = await expectConstraintRejection(
      database.attendance.create({
        data: { enrollmentId, classSessionId, status: "ABSENT" },
      }),
      UNIQUE_CONSTRAINT_MESSAGE,
    );
    assert.equal(observedConstraint1.includes(UNIQUE_CONSTRAINT_MESSAGE), true);
  });
}
function registerSchemaTest3(database: DatabaseClient): void {
  void it("rejects half-populated attendance edit-attribution facts", async () => {
    const { enrollmentId, classSessionId } = await seedAttendanceFixture(database);
    const observedConstraint2 = await expectConstraintRejection(
      database.attendance.create({
        data: {
          enrollmentId,
          classSessionId,
          status: "ABSENT",
          lastModifiedAt: new Date("2035-03-10T20:00:00.000Z"),
        },
      }),
      LAST_MODIFIED_FACTS_CONSTRAINT,
    );
    assert.equal(observedConstraint2.includes(LAST_MODIFIED_FACTS_CONSTRAINT), true);
  });
}
function registerSchemaTest4(database: DatabaseClient): void {
  void it("defaults a scheduled makeup to no outcome", async () => {
    const { makeup, transactionStartedAt } = await scheduleMakeup(database);
    assert.equal(makeup.attendedAt, null);
    assert.equal(makeup.cancelledAt, null);
    assert.equal(makeup.scheduledAt.getTime(), transactionStartedAt.getTime());
  });
}
function registerSchemaTest5(database: DatabaseClient): void {
  void it("rejects a duplicate makeup for one origin enrollment and target session", async () => {
    const { enrollmentId, classSessionId } = await seedAttendanceFixture(database);
    await database.makeup.create({
      data: { originEnrollmentId: enrollmentId, targetClassSessionId: classSessionId },
    });
    const observedConstraint3 = await expectConstraintRejection(
      database.makeup.create({
        data: { originEnrollmentId: enrollmentId, targetClassSessionId: classSessionId },
      }),
      UNIQUE_CONSTRAINT_MESSAGE,
    );
    assert.equal(observedConstraint3.includes(UNIQUE_CONSTRAINT_MESSAGE), true);
  });
}
function registerSchemaTest6(database: DatabaseClient): void {
  void it("rejects a makeup that is both cancelled and attended", async () => {
    const { enrollmentId, classSessionId } = await seedAttendanceFixture(database);
    const observedConstraint4 = await expectConstraintRejection(
      database.makeup.create({
        data: {
          originEnrollmentId: enrollmentId,
          targetClassSessionId: classSessionId,
          attendedAt: new Date("2035-03-10T19:00:00.000Z"),
          cancelledAt: new Date("2035-03-09T12:00:00.000Z"),
        },
      }),
      CANCEL_ATTEND_EXCLUSIVE_CONSTRAINT,
    );
    assert.equal(observedConstraint4.includes(CANCEL_ATTEND_EXCLUSIVE_CONSTRAINT), true);
  });
}
