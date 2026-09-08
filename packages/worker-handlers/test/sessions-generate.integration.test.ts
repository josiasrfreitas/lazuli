import assert from "node:assert/strict";
import { after, before, describe } from "node:test";

import { db } from "@lazuli/db";
import { databaseIt } from "@lazuli/db/test";

import { generateClassSessions } from "../src/index.js";

const TEST_PREFIX = "GRE-65 Sessions ";
const TEACHER_ID = "00000000-0000-0000-0000-000000006501";
const EXPECTED_SESSION_COUNT = 4;
const DATE_ONLY_LENGTH = 10;

void describe("sessions-generate worker", () => {
  void before(async () => {
    await db.$connect();
  });

  void after(async () => {
    await cleanDatabase();
    await db.$disconnect();
  });

  databaseIt(
    "generates regular and personalized sessions for the semester window idempotently",
    generateSemesterSessionsIdempotently,
  );
});

async function generateSemesterSessionsIdempotently(): Promise<void> {
  await cleanDatabase();
  const fixtures = await seedGenerationFixtures();

  const first = await generateClassSessions({
    database: db,
    payload: { semesterId: fixtures.semesterId },
  });
  const second = await generateClassSessions({
    database: db,
    payload: { semesterId: fixtures.semesterId },
  });
  const sessions = await db.classSession.findMany({
    where: { classId: { in: [fixtures.regularClassId, fixtures.personalizedClassId] } },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    select: { classId: true, date: true },
  });

  assert.equal(first.sessionsPlanned, EXPECTED_SESSION_COUNT);
  assert.equal(first.sessionsCreated, EXPECTED_SESSION_COUNT);
  assert.equal(second.sessionsPlanned, EXPECTED_SESSION_COUNT);
  assert.equal(second.sessionsCreated, 0);
  assert.deepEqual(
    sessions.map((session) => ({
      classId: session.classId,
      date: session.date.toISOString().slice(0, DATE_ONLY_LENGTH),
    })),
    [
      { classId: fixtures.regularClassId, date: "2040-03-06" },
      { classId: fixtures.personalizedClassId, date: "2040-03-09" },
      { classId: fixtures.regularClassId, date: "2040-03-13" },
      { classId: fixtures.personalizedClassId, date: "2040-03-16" },
    ],
  );
}

async function seedGenerationFixtures(): Promise<{
  semesterId: string;
  regularClassId: string;
  personalizedClassId: string;
}> {
  await seedTeacher();
  const catalog = await seedCatalog();
  const semester = await seedSemester();
  await seedClosedFriday();
  const regularClass = await seedRegularClass({
    semesterId: semester.id,
    stageId: catalog.stageId,
  });
  const personalizedClass = await seedPersonalizedClass(semester.id);

  return {
    semesterId: semester.id,
    regularClassId: regularClass.id,
    personalizedClassId: personalizedClass.id,
  };
}

async function seedSemester(): Promise<{ id: string }> {
  return db.semester.create({
    data: {
      name: `${TEST_PREFIX}2040.1`,
      startDate: new Date("2040-03-01T00:00:00.000Z"),
      endDate: new Date("2040-03-17T00:00:00.000Z"),
    },
  });
}

async function seedClosedFriday(): Promise<void> {
  await db.schoolClosedDay.create({
    data: {
      date: new Date("2040-03-02T00:00:00.000Z"),
      reason: `${TEST_PREFIX}Closed Friday`,
    },
  });
}

async function seedRegularClass(input: { semesterId: string; stageId: string }): Promise<{
  id: string;
}> {
  return db.class.create({
    data: {
      internalCode: `${TEST_PREFIX}Regular`,
      teacherId: TEACHER_ID,
      scheduleType: "REGULAR",
      format: "IN_PERSON",
      sharedStageId: input.stageId,
      semesterId: input.semesterId,
      year: 2040,
      capacity: 12,
      portalClassName: `${TEST_PREFIX}Regular Portal`,
      scheduleSlots: {
        create: {
          weekday: "TUESDAY",
          startTime: new Date("1970-01-01T14:00:00.000Z"),
          endTime: new Date("1970-01-01T16:00:00.000Z"),
        },
      },
    },
  });
}

async function seedPersonalizedClass(semesterId: string): Promise<{ id: string }> {
  return db.class.create({
    data: {
      internalCode: `${TEST_PREFIX}Personalized`,
      teacherId: TEACHER_ID,
      scheduleType: "PERSONALIZED",
      format: "ONLINE",
      semesterId,
      year: 2040,
      capacity: 1,
      portalClassName: `${TEST_PREFIX}Personalized Portal`,
      scheduleSlots: {
        create: {
          weekday: "FRIDAY",
          startTime: new Date("1970-01-01T10:00:00.000Z"),
          endTime: new Date("1970-01-01T11:00:00.000Z"),
        },
      },
    },
  });
}

async function seedTeacher(): Promise<void> {
  await db.user.create({
    data: {
      id: TEACHER_ID,
      email: "gre-65-teacher@example.com",
      name: "GRE-65 Teacher",
      role: "TEACHER",
      isEnabled: true,
    },
  });
}

async function seedCatalog(): Promise<{ stageId: string }> {
  const productLine = await db.productLine.create({
    data: {
      key: "gre65_sessions_line",
      name: `${TEST_PREFIX}Line`,
      status: "ACTIVE",
    },
  });
  const track = await db.track.create({
    data: {
      productLineId: productLine.id,
      name: `${TEST_PREFIX}Track`,
      status: "ACTIVE",
    },
  });
  const stage = await db.stage.create({
    data: {
      trackId: track.id,
      name: `${TEST_PREFIX}Stage`,
      internalCode: "GRE65S1",
      sequence: 1,
    },
  });

  return { stageId: stage.id };
}

async function cleanDatabase(): Promise<void> {
  await db.classSession.deleteMany({
    where: { class: { internalCode: { startsWith: TEST_PREFIX } } },
  });
  await db.classScheduleSlot.deleteMany({
    where: { class: { internalCode: { startsWith: TEST_PREFIX } } },
  });
  await db.class.deleteMany({ where: { internalCode: { startsWith: TEST_PREFIX } } });
  await db.schoolClosedDay.deleteMany({ where: { reason: { startsWith: TEST_PREFIX } } });
  await db.semester.deleteMany({ where: { name: { startsWith: TEST_PREFIX } } });
  await db.stage.deleteMany({ where: { internalCode: { startsWith: "GRE65" } } });
  await db.track.deleteMany({ where: { name: { startsWith: TEST_PREFIX } } });
  await db.productLine.deleteMany({ where: { key: { startsWith: "gre65_sessions_" } } });
  await db.user.deleteMany({ where: { id: TEACHER_ID } });
}
