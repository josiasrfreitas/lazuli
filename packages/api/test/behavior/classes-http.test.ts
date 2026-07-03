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
} from "../db/class-test-support.js";

void describe("classes HTTP behavior", () => {
  void before(async () => {
    await db.$connect();
  });

  void after(async () => {
    await cleanClassDatabase();
    await db.$disconnect();
  });

  databaseIt("creates a regular class through the HTTP adapter", async () => {
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
  });

  databaseIt("clones a class through the HTTP adapter", async () => {
    await cleanClassDatabase();
    await ensureTeacherUser();
    const fixtures = await seedClassCatalogFixtures();

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
    const created = (await createResponse.json()) as {
      result: { data: { json: { id: string } } };
    };

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
    const payload = (await cloneResponse.json()) as {
      result: {
        data: {
          json: {
            source: { status: string };
            successor: { previousClassId: string; sharedStageId: string };
          };
        };
      };
    };

    assert.equal(payload.result.data.json.source.status, "ARCHIVED");
    assert.equal(payload.result.data.json.successor.previousClassId, created.result.data.json.id);
    assert.equal(payload.result.data.json.successor.sharedStageId, fixtures.nextStageId);
  });
});
