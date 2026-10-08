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
  TEST_PREFIX,
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
    internalCode: `${TEST_PREFIX}Regular`,
    teacherId: TEACHER_USER_ID,
    scheduleType: "REGULAR",
    format: "IN_PERSON",
    sharedStageId: fixtures.stageId,
    semesterId: fixtures.semesterId,
    year: 2026,
    capacity: 12,
    slots: [{ weekday: "TUESDAY", startTime: "14:00", endTime: "16:00" }],
  });

  assert.equal(created.internalCode, `${TEST_PREFIX}Regular`);
  assert.equal(created.portalClassName, "REG/GRE29S1-TER-14:00/16:00-1S/26-1");
  assert.equal(created.status, "ACTIVE");
});

void it("creates a personalized class with manual portal name", async () => {
  await cleanClassDatabase();
  await ensureTeacherUser();
  const fixtures = await seedClassCatalogFixtures();

  const created = await caller().classes.create({
    internalCode: `${TEST_PREFIX}Personalized`,
    teacherId: TEACHER_USER_ID,
    scheduleType: "PERSONALIZED",
    format: "ONLINE",
    semesterId: fixtures.semesterId,
    year: 2026,
    capacity: 1,
    portalClassName: `${TEST_PREFIX}PPT Portal`,
    slots: [{ weekday: "FRIDAY", startTime: "10:00", endTime: "11:00" }],
  });

  assert.equal(created.portalClassName, `${TEST_PREFIX}PPT Portal`);
  assert.equal(created.sharedStageId, null);
});

void it("lists created classes with current occupancy and reads their roster", async () => {
  await cleanClassDatabase();
  await ensureTeacherUser();
  const fixtures = await seedClassCatalogFixtures();
  const created = await createRegularFixture(fixtures);

  const list = await caller().classes.list({ search: `${TEST_PREFIX}Source` });
  const detail = await caller().classes.byId({ id: created.id });

  assert.equal(list.total, 1);
  assert.equal(list.rows[0]?.id, created.id);
  assert.equal(list.rows[0]?.occupancy, 0);
  assert.equal(detail.internalCode, `${TEST_PREFIX}Source`);
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
    internalCode: `${TEST_PREFIX}Online`,
    teacherId: TEACHER_USER_ID,
    scheduleType: "PERSONALIZED",
    format: "ONLINE",
    semesterId: fixtures.semesterId,
    year: 2026,
    capacity: 1,
    portalClassName: `${TEST_PREFIX}Online Portal`,
    slots: [{ weekday: "FRIDAY", startTime: "10:00", endTime: "11:00" }],
  });
  const both = await caller().classes.list({
    search: TEST_PREFIX,
    scheduleTypes: ["REGULAR", "PERSONALIZED"],
    formats: ["IN_PERSON", "ONLINE"],
  });
  assert.deepEqual(new Set(both.rows.map((row) => row.id)), new Set([regular.id, personalized.id]));
  const online = await caller().classes.list({
    search: TEST_PREFIX,
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

void it("updates only safe class identification and capacity fields", async () => {
  await cleanClassDatabase();
  await ensureTeacherUser();
  const fixtures = await seedClassCatalogFixtures();
  const created = await createRegularFixture(fixtures);

  await caller().classes.updateBasic({
    id: created.id,
    internalCode: `${TEST_PREFIX}Renamed`,
    capacity: 18,
  });
  const detail = await caller().classes.byId({ id: created.id });

  assert.equal(detail.internalCode, `${TEST_PREFIX}Renamed`);
  assert.equal(detail.capacity, 18);
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
    internalCode: `${TEST_PREFIX}Successor`,
    semesterId: fixtures.nextSemesterId,
    year: 2026,
  });

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
    internalCode: `${TEST_PREFIX}Source`,
    teacherId: TEACHER_USER_ID,
    scheduleType: "REGULAR",
    format: "IN_PERSON",
    sharedStageId: fixtures.stageId,
    semesterId: fixtures.semesterId,
    year: 2026,
    capacity: 12,
    slots: [{ weekday: "TUESDAY", startTime: "14:00", endTime: "16:00" }],
  });
}
