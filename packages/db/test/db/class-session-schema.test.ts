import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, describe } from "node:test";

import { config as loadEnvironment } from "dotenv";

import { databaseIt } from "../support.js";
import {
  cleanDatabase,
  expectConstraintRejection,
  seedCatalog,
  seedTeacher,
  type ClassSchemaFixtureConfig,
} from "./class-schema-support.js";

loadEnvironment({ path: new URL("../../../../.env", import.meta.url), quiet: true });

const { createDbClient } = await import("../../src/client.js");

const UNIQUE_CONSTRAINT_MESSAGE = "Unique constraint failed";
const SESSION_SLOT_MATCH_MESSAGE = "ClassSession date/time must match";
const SESSION_CANCEL_CONSTRAINT = "ClassSession_cancel_facts_check";
const SESSION_ORDER_CONSTRAINT = "ClassSession_start_before_end_check";
const MATCHING_SESSION_DATE = "2078-02-01T00:00:00.000Z";
const TEST_PREFIX = "GRE-65 Session Schema ";
const TEACHER_ID = "00000000-0000-0000-0000-000000006503";
const SESSION_FIXTURE = {
  testPrefix: TEST_PREFIX,
  teacherId: TEACHER_ID,
  catalogKeyPrefix: "gre65_session_schema_",
  teacherEmail: "gre65-session-schema-teacher@example.com",
  teacherName: "GRE-65 Session Schema Teacher",
  stageInternalCode: "GRE65SESSIONTUI",
  semesterName: `${TEST_PREFIX}2078.1`,
  semesterStartDate: new Date("2078-02-01"),
  semesterEndDate: new Date("2078-06-30"),
} satisfies ClassSchemaFixtureConfig;

type DatabaseClient = ReturnType<typeof createDbClient>;

void describe("class session schema", () => {
  const database = createDbClient();

  void before(async () => {
    await database.$connect();
  });

  void beforeEach(async () => {
    await cleanDatabase(database, SESSION_FIXTURE);
    await seedTeacher(database, SESSION_FIXTURE);
  });

  void after(async () => {
    await cleanDatabase(database, SESSION_FIXTURE);
    await database.$disconnect();
  });

  databaseIt("creates a slot-backed class session", () => createSlotBackedSession(database));

  databaseIt("rejects duplicate generated class sessions", () =>
    rejectDuplicateGeneratedSession(database),
  );

  databaseIt("rejects duplicate ad-hoc class sessions", () =>
    rejectDuplicateAdHocSession(database),
  );

  databaseIt("rejects inverted class session times", () => rejectInvertedSessionTimes(database));

  databaseIt("rejects session dates that do not match the slot weekday", () =>
    rejectSessionSlotMismatch(database),
  );

  databaseIt("rejects cancelled sessions without cancellation facts", () =>
    rejectCancelledWithoutFacts(database),
  );

  databaseIt("rejects cancelling sessions with attendance or Portal facts", () =>
    rejectCancelledWithCommittedFacts(database),
  );
});

async function createSlotBackedSession(database: DatabaseClient): Promise<void> {
  const sessionFixture = await seedClassWithSlot(database);

  const session = await database.classSession.create({
    data: {
      classId: sessionFixture.classId,
      scheduleSlotId: sessionFixture.slotId,
      date: new Date(MATCHING_SESSION_DATE),
      startTime: sessionFixture.startTime,
      endTime: sessionFixture.endTime,
    },
  });

  assert.equal(session.status, "SCHEDULED");
}

async function rejectDuplicateGeneratedSession(database: DatabaseClient): Promise<void> {
  const sessionFixture = await seedClassWithSlot(database);
  const sessionData = {
    classId: sessionFixture.classId,
    scheduleSlotId: sessionFixture.slotId,
    date: new Date(MATCHING_SESSION_DATE),
    startTime: sessionFixture.startTime,
    endTime: sessionFixture.endTime,
  };

  await database.classSession.create({ data: sessionData });
  await expectConstraintRejection(
    database.classSession.create({ data: sessionData }),
    UNIQUE_CONSTRAINT_MESSAGE,
  );
}

async function rejectDuplicateAdHocSession(database: DatabaseClient): Promise<void> {
  const sessionFixture = await seedClassWithSlot(database);
  const sessionData = {
    classId: sessionFixture.classId,
    date: new Date(MATCHING_SESSION_DATE),
    startTime: new Date("1970-01-01T09:00:00.000Z"),
    endTime: new Date("1970-01-01T10:00:00.000Z"),
  };

  await database.classSession.create({ data: sessionData });
  await expectConstraintRejection(
    database.classSession.create({ data: sessionData }),
    UNIQUE_CONSTRAINT_MESSAGE,
  );
}

async function rejectInvertedSessionTimes(database: DatabaseClient): Promise<void> {
  const sessionFixture = await seedClassWithSlot(database);

  await expectConstraintRejection(
    database.classSession.create({
      data: {
        classId: sessionFixture.classId,
        date: new Date(MATCHING_SESSION_DATE),
        startTime: new Date("1970-01-01T10:00:00.000Z"),
        endTime: new Date("1970-01-01T09:00:00.000Z"),
      },
    }),
    SESSION_ORDER_CONSTRAINT,
  );
}

async function rejectSessionSlotMismatch(database: DatabaseClient): Promise<void> {
  const sessionFixture = await seedClassWithSlot(database);

  await expectConstraintRejection(
    database.classSession.create({
      data: {
        classId: sessionFixture.classId,
        scheduleSlotId: sessionFixture.slotId,
        date: new Date("2078-02-02T00:00:00.000Z"),
        startTime: sessionFixture.startTime,
        endTime: sessionFixture.endTime,
      },
    }),
    SESSION_SLOT_MATCH_MESSAGE,
  );
}

async function rejectCancelledWithoutFacts(database: DatabaseClient): Promise<void> {
  const sessionFixture = await seedClassWithSlot(database);

  await expectConstraintRejection(
    database.classSession.create({
      data: {
        classId: sessionFixture.classId,
        scheduleSlotId: sessionFixture.slotId,
        date: new Date(MATCHING_SESSION_DATE),
        startTime: sessionFixture.startTime,
        endTime: sessionFixture.endTime,
        status: "CANCELLED",
      },
    }),
    SESSION_CANCEL_CONSTRAINT,
  );
}

async function rejectCancelledWithCommittedFacts(database: DatabaseClient): Promise<void> {
  const sessionFixture = await seedClassWithSlot(database);
  const cancelledSessionData = {
    classId: sessionFixture.classId,
    scheduleSlotId: sessionFixture.slotId,
    date: new Date(MATCHING_SESSION_DATE),
    startTime: sessionFixture.startTime,
    endTime: sessionFixture.endTime,
    status: "CANCELLED" as const,
    cancelReason: "Teacher absence",
    cancelledAt: new Date("2078-01-31T12:00:00.000Z"),
  };

  await expectConstraintRejection(
    database.classSession.create({
      data: {
        ...cancelledSessionData,
        attendanceConfirmedAt: new Date("2078-02-01T16:30:00.000Z"),
      },
    }),
    SESSION_CANCEL_CONSTRAINT,
  );

  await expectConstraintRejection(
    database.classSession.create({
      data: {
        ...cancelledSessionData,
        portalSubmittedAt: new Date("2078-02-01T17:00:00.000Z"),
      },
    }),
    SESSION_CANCEL_CONSTRAINT,
  );
}

async function seedClassWithSlot(database: DatabaseClient): Promise<{
  classId: string;
  slotId: string;
  startTime: Date;
  endTime: Date;
}> {
  const { stageId, semesterId } = await seedCatalog(database, SESSION_FIXTURE);
  const startTime = new Date("1970-01-01T14:00:00.000Z");
  const endTime = new Date("1970-01-01T16:00:00.000Z");
  const classRow = await database.class.create({
    data: {
      internalCode: `${TEST_PREFIX}Session ${randomUUID()}`,
      teacherId: TEACHER_ID,
      scheduleType: "REGULAR",
      format: "IN_PERSON",
      sharedStageId: stageId,
      semesterId,
      year: 2078,
      capacity: 8,
      portalClassName: `${TEST_PREFIX}portal-session-${randomUUID()}`,
      scheduleSlots: {
        create: {
          weekday: "TUESDAY",
          startTime,
          endTime,
        },
      },
    },
    include: { scheduleSlots: true },
  });
  const slot = classRow.scheduleSlots[0];
  if (slot === undefined) {
    throw new Error("Expected seeded class to have a schedule slot.");
  }

  return { classId: classRow.id, slotId: slot.id, startTime, endTime };
}
