import assert from "node:assert/strict";
import { after, before, describe } from "node:test";

import { db } from "@lazuli/db";
import { databaseIt } from "@lazuli/db/test";

import {
  caller,
  cleanClassDatabase,
  ensureTeacherUser,
  seedClassCatalogFixtures,
  TEACHER_USER_ID,
  TEST_PREFIX,
} from "./class-test-support.js";

void describe("classes catalog API", () => {
  void before(async () => {
    await db.$connect();
  });

  void after(async () => {
    await cleanClassDatabase();
    await db.$disconnect();
  });

  databaseIt("creates a regular class with generated portal name", createRegularClass);

  databaseIt("creates a personalized class with manual portal name", createPersonalizedClass);

  databaseIt("archives a class", archiveClass);

  databaseIt("clones a regular class for the next period preserving lineage", cloneRegularClass);
});

type CreatedClass = Awaited<ReturnType<ReturnType<typeof caller>["classes"]["create"]>>;

async function createRegularClass(): Promise<void> {
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
}

async function createPersonalizedClass(): Promise<void> {
  await cleanClassDatabase();
  await ensureTeacherUser();

  const created = await caller().classes.create({
    internalCode: `${TEST_PREFIX}Personalized`,
    teacherId: TEACHER_USER_ID,
    scheduleType: "PERSONALIZED",
    format: "ONLINE",
    year: 2026,
    capacity: 1,
    portalClassName: `${TEST_PREFIX}PPT Portal`,
    slots: [{ weekday: "FRIDAY", startTime: "10:00", endTime: "11:00" }],
  });

  assert.equal(created.portalClassName, `${TEST_PREFIX}PPT Portal`);
  assert.equal(created.sharedStageId, null);
}

async function archiveClass(): Promise<void> {
  await cleanClassDatabase();
  await ensureTeacherUser();
  const fixtures = await seedClassCatalogFixtures();
  const created = await createRegularFixture(fixtures);

  const archived = await caller().classes.archive({ id: created.id });

  assert.equal(archived.status, "ARCHIVED");
}

async function cloneRegularClass(): Promise<void> {
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
}

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
