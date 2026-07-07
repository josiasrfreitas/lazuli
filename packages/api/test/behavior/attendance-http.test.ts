import assert from "node:assert/strict";
import { after, before, beforeEach, describe } from "node:test";

import { db } from "@lazuli/db";
import { databaseIt } from "@lazuli/db/test";

import { behaviorHarness as harness } from "../db/attendance-namespaces.js";
import {
  HTTP_FORBIDDEN,
  HTTP_OK,
  callHttpMutation,
  callHttpQuery,
} from "../db/attendance-test-support.js";

type RosterResponseBody = { result: { data: { json: { entries: { enrollmentId: string }[] } } } };
type ConfirmResponseBody = { result: { data: { json: { presentCount: number } } } };

void describe("attendance API over the tRPC HTTP boundary", () => {
  void before(async () => {
    await db.$connect();
  });
  void beforeEach(async () => {
    await harness.clean();
  });
  void after(async () => {
    await harness.clean();
    await db.$disconnect();
  });

  registerRosterQueryTest();
  registerConfirmMutationTest();
  registerForbiddenConfirmTest();
});

function registerRosterQueryTest(): void {
  databaseIt("reads a session roster over HTTP", async () => {
    const scenario = await harness.seedBaseScenario();
    await harness.enrollStudent({
      classId: scenario.classId,
      stageId: scenario.stageId,
      suffix: "Ana",
    });

    const response = await callHttpQuery({
      path: "attendance.sessionRoster",
      input: { sessionId: scenario.sessionId },
      staffUser: harness.ns.admin,
    });
    const payload = (await response.json()) as RosterResponseBody;

    assert.equal(response.status, HTTP_OK);
    assert.equal(payload.result.data.json.entries.length, 1);
  });
}

function registerConfirmMutationTest(): void {
  databaseIt("confirms a session over HTTP and persists the roster", async () => {
    const scenario = await harness.seedBaseScenario();
    await harness.enrollStudent({
      classId: scenario.classId,
      stageId: scenario.stageId,
      suffix: "Ana",
    });

    const response = await callHttpMutation({
      path: "attendance.confirmSession",
      body: { sessionId: scenario.sessionId, rows: [] },
      staffUser: harness.ns.admin,
    });
    const payload = (await response.json()) as ConfirmResponseBody;

    assert.equal(response.status, HTTP_OK);
    assert.equal(payload.result.data.json.presentCount, 1);
    const committed = await db.attendance.count({ where: { classSessionId: scenario.sessionId } });
    assert.equal(committed, 1);
  });
}

function registerForbiddenConfirmTest(): void {
  databaseIt("returns 403 when another teacher confirms a class they do not own", async () => {
    const scenario = await harness.seedBaseScenario();
    await harness.enrollStudent({
      classId: scenario.classId,
      stageId: scenario.stageId,
      suffix: "Ana",
    });

    const response = await callHttpMutation({
      path: "attendance.confirmSession",
      body: { sessionId: scenario.sessionId, rows: [] },
      staffUser: harness.ns.otherTeacher,
    });

    assert.equal(response.status, HTTP_FORBIDDEN);
    const committed = await db.attendance.count({ where: { classSessionId: scenario.sessionId } });
    assert.equal(committed, 0);
  });
}
