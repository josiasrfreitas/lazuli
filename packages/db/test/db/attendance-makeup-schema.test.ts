import assert from "node:assert/strict";
import { after, before, beforeEach, describe } from "node:test";

import { config as loadEnvironment } from "dotenv";

import { databaseIt } from "../support.js";
import {
  CANCEL_ATTEND_EXCLUSIVE_CONSTRAINT,
  cleanDatabase,
  expectConstraintRejection,
  LAST_MODIFIED_FACTS_CONSTRAINT,
  seedAttendanceFixture,
  UNIQUE_CONSTRAINT_MESSAGE,
  type DatabaseClient,
} from "./attendance-makeup-schema-support.js";

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

  databaseIt("commits a present attendance row", () => commitsPresentRow(database));

  databaseIt("rejects a duplicate attendance row for one enrollment and session", () =>
    rejectsDuplicateAttendance(database),
  );

  databaseIt("rejects half-populated attendance edit-attribution facts", () =>
    rejectsHalfPopulatedAttribution(database),
  );

  databaseIt("schedules a makeup visitor into a target session", () => schedulesMakeup(database));

  databaseIt("rejects a duplicate makeup for one origin enrollment and target session", () =>
    rejectsDuplicateMakeup(database),
  );

  databaseIt("rejects a makeup that is both cancelled and attended", () =>
    rejectsCancelledAndAttended(database),
  );
});

async function commitsPresentRow(database: DatabaseClient): Promise<void> {
  const { enrollmentId, classSessionId } = await seedAttendanceFixture(database);

  const attendance = await database.attendance.create({
    data: { enrollmentId, classSessionId, status: "PRESENT" },
  });

  assert.equal(attendance.status, "PRESENT");
  assert.ok(attendance.recordedAt instanceof Date);
}

async function rejectsDuplicateAttendance(database: DatabaseClient): Promise<void> {
  const { enrollmentId, classSessionId } = await seedAttendanceFixture(database);
  await database.attendance.create({ data: { enrollmentId, classSessionId, status: "PRESENT" } });

  await expectConstraintRejection(
    database.attendance.create({ data: { enrollmentId, classSessionId, status: "ABSENT" } }),
    UNIQUE_CONSTRAINT_MESSAGE,
  );
}

async function rejectsHalfPopulatedAttribution(database: DatabaseClient): Promise<void> {
  const { enrollmentId, classSessionId } = await seedAttendanceFixture(database);

  await expectConstraintRejection(
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
}

async function schedulesMakeup(database: DatabaseClient): Promise<void> {
  const { enrollmentId, classSessionId } = await seedAttendanceFixture(database);

  const makeup = await database.makeup.create({
    data: { originEnrollmentId: enrollmentId, targetClassSessionId: classSessionId },
  });

  assert.equal(makeup.attendedAt, null);
  assert.equal(makeup.cancelledAt, null);
  assert.ok(makeup.scheduledAt instanceof Date);
}

async function rejectsDuplicateMakeup(database: DatabaseClient): Promise<void> {
  const { enrollmentId, classSessionId } = await seedAttendanceFixture(database);
  await database.makeup.create({
    data: { originEnrollmentId: enrollmentId, targetClassSessionId: classSessionId },
  });

  await expectConstraintRejection(
    database.makeup.create({
      data: { originEnrollmentId: enrollmentId, targetClassSessionId: classSessionId },
    }),
    UNIQUE_CONSTRAINT_MESSAGE,
  );
}

async function rejectsCancelledAndAttended(database: DatabaseClient): Promise<void> {
  const { enrollmentId, classSessionId } = await seedAttendanceFixture(database);

  await expectConstraintRejection(
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
}
