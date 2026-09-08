import assert from "node:assert/strict";
import { after, before, describe } from "node:test";

import { db } from "@lazuli/db";
import { databaseIt } from "@lazuli/db/test";

import {
  callHttpMutation,
  cleanClassDatabase,
  ensureTeacherUser,
  HTTP_OK,
  seedClassCatalogFixtures,
  TEACHER_USER_ID,
  TEST_PREFIX,
} from "../support/class-test-support.js";
import { recordingSessionsGenerateQueue } from "../support/session-generation-queue-support.js";

void describe("classes HTTP behavior", { concurrency: false }, () => {
  void before(async () => {
    await db.$connect();
  });

  void after(async () => {
    await cleanClassDatabase();
    await db.$disconnect();
  });

  databaseIt("creates a regular class through the HTTP adapter", createRegularClassOverHttp);

  databaseIt("clones a class through the HTTP adapter", cloneClassOverHttp);

  databaseIt("enqueues session generation through the HTTP adapter", generateSessionsOverHttp);
});

async function createRegularClassOverHttp(): Promise<void> {
  await cleanClassDatabase();
  await ensureTeacherUser();
  const fixtures = await seedClassCatalogFixtures();

  const response = await callHttpMutation({
    path: "classes.create",
    body: {
      internalCode: `${TEST_PREFIX}HTTP Regular`,
      teacherId: TEACHER_USER_ID,
      scheduleType: "REGULAR",
      format: "IN_PERSON",
      sharedStageId: fixtures.stageId,
      semesterId: fixtures.semesterId,
      year: 2026,
      capacity: 10,
      slots: [{ weekday: "TUESDAY", startTime: "14:00", endTime: "16:00" }],
    },
  });

  assert.equal(response.status, HTTP_OK);
  const payload = (await response.json()) as {
    result: { data: { json: { portalClassName: string; status: string } } };
  };
  assert.equal(payload.result.data.json.status, "ACTIVE");
  assert.equal(payload.result.data.json.portalClassName, "REG/GRE29S1-TER-14:00/16:00-1S/26-1");
}

async function cloneClassOverHttp(): Promise<void> {
  await cleanClassDatabase();
  await ensureTeacherUser();
  const fixtures = await seedClassCatalogFixtures();
  const created = await createSourceClassOverHttp(fixtures);

  const cloneResponse = await callHttpMutation({
    path: "classes.cloneForNextPeriod",
    body: {
      id: created.result.data.json.id,
      internalCode: `${TEST_PREFIX}HTTP Successor`,
      semesterId: fixtures.nextSemesterId,
      year: 2026,
    },
  });

  assert.equal(cloneResponse.status, HTTP_OK);
  const payload = (await cloneResponse.json()) as ClonePayload;

  assert.equal(payload.result.data.json.source.status, "ARCHIVED");
  assert.equal(payload.result.data.json.successor.previousClassId, created.result.data.json.id);
  assert.equal(payload.result.data.json.successor.sharedStageId, fixtures.nextStageId);
}

async function generateSessionsOverHttp(): Promise<void> {
  await cleanClassDatabase();
  await ensureTeacherUser();
  const fixtures = await seedClassCatalogFixtures();
  const created = await createSourceClassOverHttp(fixtures);
  const queue = recordingSessionsGenerateQueue("job-http");

  const response = await callHttpMutation({
    path: "classes.generateSessions",
    body: { classId: created.result.data.json.id },
    queue,
  });
  const sessionCount = await db.classSession.count({
    where: { classId: created.result.data.json.id },
  });

  assert.equal(response.status, HTTP_OK);
  const payload = (await response.json()) as GeneratePayload;
  assert.equal(payload.result.data.json.workflowName, "sessions-generate");
  assert.deepEqual(queue.calls, [{ classId: created.result.data.json.id }]);
  assert.equal(sessionCount, 0);
}

async function createSourceClassOverHttp(
  fixtures: Awaited<ReturnType<typeof seedClassCatalogFixtures>>,
): Promise<CreatePayload> {
  const createResponse = await callHttpMutation({
    path: "classes.create",
    body: {
      internalCode: `${TEST_PREFIX}HTTP Source`,
      teacherId: TEACHER_USER_ID,
      scheduleType: "REGULAR",
      format: "IN_PERSON",
      sharedStageId: fixtures.stageId,
      semesterId: fixtures.semesterId,
      year: 2026,
      capacity: 10,
      slots: [{ weekday: "TUESDAY", startTime: "14:00", endTime: "16:00" }],
    },
  });

  return (await createResponse.json()) as CreatePayload;
}

type CreatePayload = {
  result: { data: { json: { id: string } } };
};

type ClonePayload = {
  result: {
    data: {
      json: {
        source: { status: string };
        successor: { previousClassId: string; sharedStageId: string };
      };
    };
  };
};

type GeneratePayload = {
  result: { data: { json: { workflowName: string; jobId: string } } };
};
