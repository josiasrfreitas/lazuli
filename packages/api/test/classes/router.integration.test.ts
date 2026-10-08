import assert from "node:assert/strict";
import { after, before, it } from "node:test";

import { createCaller } from "@lazuli/api";
import { db } from "@lazuli/db";

import {
  caller,
  cleanClassDatabase,
  contextWithQueue,
  ensureTeacherUser,
  seedClassCatalogFixtures,
  TEACHER_USER_ID,
  SECOND_TEACHER_USER_ID,
} from "../support/class-test-support.js";
import { recordingSessionsGenerateQueue } from "../support/session-generation-queue-support.js";

void before(async () => {
  await db.$connect();
});

void after(async () => {
  await cleanClassDatabase();
  await db.$disconnect();
});

void it("creates a regular class with generated portal name", async () => {
  await cleanClassDatabase();
  await ensureTeacherUser();
  const fixtures = await seedClassCatalogFixtures();

  const created = await caller().classes.create({
    teacherId: TEACHER_USER_ID,
    scheduleType: "REGULAR",
    format: "IN_PERSON",
    sharedStageId: fixtures.stageId,
    semesterId: fixtures.semesterId,

    slots: [{ weekday: "TUESDAY", startTime: "14:00", endTime: "16:00" }],
  });

  assert.match(created.internalCode, /^TUR-2026-[A-F0-9]{12}$/u);
  const stored = await db.class.findUniqueOrThrow({ where: { id: created.id } });
  assert.equal(stored.internalCode, created.internalCode);
  assert.equal(stored.capacity, 25);
  assert.equal(stored.year, 2026);
  assert.equal(created.portalClassName, "REG/GRE29S1-TER-14:00/16:00-1S/26-1");
  assert.equal(created.status, "ACTIVE");
});

void it("generates personalized names and disambiguates identical schedules", async () => {
  await cleanClassDatabase();
  await ensureTeacherUser();
  const fixtures = await seedClassCatalogFixtures();

  const values = {
    teacherId: TEACHER_USER_ID,
    scheduleType: "PERSONALIZED",
    format: "ONLINE",
    semesterId: fixtures.semesterId,

    slots: [{ weekday: "FRIDAY", startTime: "10:00", endTime: "11:00" }],
  } as const;
  const created = await caller().classes.create({ ...values, slots: [...values.slots] });
  const second = await caller().classes.create({
    ...values,
    teacherId: SECOND_TEACHER_USER_ID,
    slots: [...values.slots],
  });

  assert.equal(created.portalClassName, "PPT/SEX-10:00/11:00-1S/26-1");
  assert.equal(second.portalClassName, "PPT/SEX-10:00/11:00-1S/26-2");
  assert.equal(created.sharedStageId, null);
  const stored = await db.class.findUniqueOrThrow({ where: { id: created.id } });
  assert.equal(stored.originalPortalClassName, "PPT/SEX-10:00/11:00-1S/26-1");
});

void it("lists created classes with current occupancy and reads their roster", async () => {
  await cleanClassDatabase();
  await ensureTeacherUser();
  const fixtures = await seedClassCatalogFixtures();
  const created = await createRegularFixture(fixtures);

  const list = await caller().classes.list({ search: created.internalCode });
  const detail = await caller().classes.byId({ id: created.id });

  assert.equal(list.total, 1);
  assert.equal(list.rows[0]?.id, created.id);
  assert.equal(list.rows[0]?.occupancy, 0);
  assert.equal(detail.internalCode, created.internalCode);
  const roster = await caller().classes.roster({
    id: created.id,
    page: 1,
    pageSize: 20,
    search: "",
  });
  assert.equal(roster.total, 0);
  assert.equal(detail.scheduleSlots[0]?.weekday, "TUESDAY");
});

void it("unions selected class filters and intersects different filter fields", async () => {
  await cleanClassDatabase();
  await ensureTeacherUser();
  const fixtures = await seedClassCatalogFixtures();
  const regular = await createRegularFixture(fixtures);
  const personalized = await caller().classes.create({
    teacherId: TEACHER_USER_ID,
    scheduleType: "PERSONALIZED",
    format: "ONLINE",
    semesterId: fixtures.semesterId,

    slots: [{ weekday: "FRIDAY", startTime: "10:00", endTime: "11:00" }],
  });
  const both = await caller().classes.list({
    teacherIds: [TEACHER_USER_ID],
    scheduleTypes: ["REGULAR", "PERSONALIZED"],
    formats: ["IN_PERSON", "ONLINE"],
  });
  assert.deepEqual(new Set(both.rows.map((row) => row.id)), new Set([regular.id, personalized.id]));
  const online = await caller().classes.list({
    scheduleTypes: ["REGULAR", "PERSONALIZED"],
    formats: ["ONLINE"],
    teacherIds: [TEACHER_USER_ID],
    semesterIds: [fixtures.semesterId],
    statuses: ["ACTIVE"],
  });
  assert.deepEqual(
    online.rows.map((row) => row.id),
    [personalized.id],
  );
  assert.equal(online.total, 1);

  const stageMatches = await caller().classes.list({
    teacherIds: [TEACHER_USER_ID],
    stageIds: [fixtures.stageId],
  });
  assert.deepEqual(
    stageMatches.rows.map((row) => row.id),
    [regular.id],
  );
  const otherStage = await caller().classes.list({
    teacherIds: [TEACHER_USER_ID],
    stageIds: [fixtures.nextStageId],
  });
  assert.equal(otherStage.total, 0);
  const personalizedStage = await caller().classes.list({
    teacherIds: [TEACHER_USER_ID],
    stageIds: [fixtures.stageId],
    scheduleTypes: ["PERSONALIZED"],
  });
  assert.equal(personalizedStage.total, 0);
});

void it("finds classes by teacher name while preserving selected filters", async () => {
  await cleanClassDatabase();
  await ensureTeacherUser();
  const fixtures = await seedClassCatalogFixtures();
  const regular = await createRegularFixture(fixtures);
  const teacher = await db.user.findUniqueOrThrow({ where: { id: TEACHER_USER_ID } });
  const found = await caller().classes.list({ search: teacher.name.toLowerCase() });
  assert.deepEqual(
    found.rows.map((row) => row.id),
    [regular.id],
  );
  const excluded = await caller().classes.list({ search: teacher.name, formats: ["ONLINE"] });
  assert.equal(excluded.total, 0);
  assert.deepEqual(excluded.rows, []);
});

void it("uses the global reference for existing classes without rewriting their identity", async () => {
  await cleanClassDatabase();
  await ensureTeacherUser();
  const fixtures = await seedClassCatalogFixtures();
  const created = await createRegularFixture(fixtures);
  await db.class.update({ where: { id: created.id }, data: { capacity: 18 } });
  const detail = await caller().classes.byId({ id: created.id });
  const list = await caller().classes.list({ search: created.internalCode });
  assert.equal(detail.capacity, 25);
  assert.equal(list.rows[0]?.capacity, 25);
  assert.equal(detail.internalCode, created.internalCode);
  assert.equal(detail.sharedStageId, fixtures.stageId);
  assert.equal(detail.scheduleSlots[0]?.weekday, "TUESDAY");
});

void it("archives a class", async () => {
  await cleanClassDatabase();
  await ensureTeacherUser();
  const fixtures = await seedClassCatalogFixtures();
  const created = await createRegularFixture(fixtures);

  const archived = await caller().classes.archive({ id: created.id });

  assert.equal(archived.status, "ARCHIVED");
});

void it("clones a regular class for the next period preserving lineage", async () => {
  await cleanClassDatabase();
  await ensureTeacherUser();
  const fixtures = await seedClassCatalogFixtures();
  const source = await createRegularFixture(fixtures);

  const result = await caller().classes.cloneForNextPeriod({
    id: source.id,

    semesterId: fixtures.nextSemesterId,
  });

  assert.match(result.successor.internalCode, /^TUR-2026-[A-F0-9]{12}$/u);
  assert.notEqual(result.successor.internalCode, source.internalCode);
  assert.equal(result.source.internalCode, source.internalCode);
  assert.equal(result.source.status, "ARCHIVED");
  assert.equal(result.successor.previousClassId, source.id);
  assert.equal(result.successor.sharedStageId, fixtures.nextStageId);
  assert.equal(result.successor.portalClassName, "REG/GRE29S2-TER-14:00/16:00-2S/26-1");
});

void it("enqueues session generation without creating sessions inline", async () => {
  await cleanClassDatabase();
  await ensureTeacherUser();
  const fixtures = await seedClassCatalogFixtures();
  const created = await createRegularFixture(fixtures);
  const queue = recordingSessionsGenerateQueue("job-1");

  const result = await createCaller(contextWithQueue({ queue })).classes.generateSessions({
    classId: created.id,
  });
  const sessionCount = await db.classSession.count({ where: { classId: created.id } });

  assert.equal(result.workflowName, "sessions-generate");
  assert.equal(result.jobId, "job-1");
  assert.deepEqual(queue.calls, [{ classId: created.id }]);
  assert.equal(sessionCount, 0);
});

type CreatedClass = Awaited<ReturnType<ReturnType<typeof caller>["classes"]["create"]>>;

async function createRegularFixture(
  fixtures: Awaited<ReturnType<typeof seedClassCatalogFixtures>>,
): Promise<CreatedClass> {
  return caller().classes.create({
    teacherId: TEACHER_USER_ID,
    scheduleType: "REGULAR",
    format: "IN_PERSON",
    sharedStageId: fixtures.stageId,
    semesterId: fixtures.semesterId,

    slots: [{ weekday: "TUESDAY", startTime: "14:00", endTime: "16:00" }],
  });
}
