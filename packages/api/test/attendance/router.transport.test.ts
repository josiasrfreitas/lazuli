import assert from "node:assert/strict";
import { after, before, beforeEach, describe } from "node:test";

import { db } from "@lazuli/db";
import { databaseIt } from "@lazuli/db/test";

import { behaviorHarness as harness } from "../support/attendance-namespaces.js";
import {
  HTTP_FORBIDDEN,
  HTTP_OK,
  callHttpMutation,
  callHttpQuery,
} from "../support/attendance-test-support.js";

type RosterResponseBody = { result: { data: { json: { entries: { enrollmentId: string }[] } } } };
type ConfirmResponseBody = { result: { data: { json: { presentCount: number } } } };
type EditResponseBody = {
  result: { data: { json: { changedCount: number; absentCount: number } } };
};
type PercentResponseBody = {
  result: {
    data: { json: { heldSessions: number; presentCount: number; percent: number | null } };
  };
};

const SAME_DAY_NOW = new Date("2015-03-10T12:00:00.000Z");
const NEXT_SP_DAY_NOW = new Date("2015-03-11T03:01:00.000Z");
const PORTAL_SUBMITTED_AT = new Date("2015-03-10T20:00:00.000Z");
const CONFIRM_SESSION_PATH = "attendance.confirmSession";
const EDIT_SESSION_PATH = "attendance.editSession";
const PERCENT_PATH = "attendance.enrollmentSemesterPercent";

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
  registerPercentQueryTest();
  registerConfirmMutationTest();
  registerEditMutationTest();
  registerForbiddenPercentTest();
  registerForbiddenConfirmTest();
  registerForbiddenEditWindowTest();
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

function registerPercentQueryTest(): void {
  databaseIt("reads an enrollment semester percent over HTTP", async () => {
    const scenario = await harness.seedBaseScenario();
    const ana = await harness.enrollStudent({
      classId: scenario.classId,
      stageId: scenario.stageId,
      suffix: "Ana",
    });
    await callHttpMutation({
      path: CONFIRM_SESSION_PATH,
      body: { sessionId: scenario.sessionId, rows: [] },
      staffUser: harness.ns.admin,
    });

    const response = await callHttpQuery({
      path: PERCENT_PATH,
      input: { enrollmentId: ana.enrollmentId, semesterId: scenario.semesterId },
      staffUser: harness.ns.admin,
    });
    const payload = (await response.json()) as PercentResponseBody;

    assert.equal(response.status, HTTP_OK);
    assert.equal(payload.result.data.json.heldSessions, 1);
    assert.equal(payload.result.data.json.presentCount, 1);
    assert.equal(payload.result.data.json.percent, 1);
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
      path: CONFIRM_SESSION_PATH,
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
      path: CONFIRM_SESSION_PATH,
      body: { sessionId: scenario.sessionId, rows: [] },
      staffUser: harness.ns.otherTeacher,
    });

    assert.equal(response.status, HTTP_FORBIDDEN);
    const committed = await db.attendance.count({ where: { classSessionId: scenario.sessionId } });
    assert.equal(committed, 0);
  });
}

function registerForbiddenPercentTest(): void {
  databaseIt("returns 403 when another teacher reads a class they do not own", async () => {
    const scenario = await harness.seedBaseScenario();
    const ana = await harness.enrollStudent({
      classId: scenario.classId,
      stageId: scenario.stageId,
      suffix: "Ana",
    });

    const response = await callHttpQuery({
      path: PERCENT_PATH,
      input: { enrollmentId: ana.enrollmentId, semesterId: scenario.semesterId },
      staffUser: harness.ns.otherTeacher,
    });

    assert.equal(response.status, HTTP_FORBIDDEN);
  });
}

function registerEditMutationTest(): void {
  databaseIt("edits a confirmed session over HTTP and persists changed rows", async () => {
    const scenario = await harness.seedBaseScenario();
    const ana = await harness.enrollStudent({
      classId: scenario.classId,
      stageId: scenario.stageId,
      suffix: "Ana",
    });
    await callHttpMutation({
      path: CONFIRM_SESSION_PATH,
      body: { sessionId: scenario.sessionId, rows: [] },
      staffUser: harness.ns.admin,
      now: SAME_DAY_NOW,
    });
    await db.classSession.update({
      where: { id: scenario.sessionId },
      data: { portalSubmittedAt: PORTAL_SUBMITTED_AT },
    });

    const response = await callHttpMutation({
      path: EDIT_SESSION_PATH,
      body: {
        sessionId: scenario.sessionId,
        rows: [{ enrollmentId: ana.enrollmentId, status: "ABSENT" }],
      },
      staffUser: harness.ns.admin,
      now: NEXT_SP_DAY_NOW,
    });
    const payload = (await response.json()) as EditResponseBody;

    assert.equal(response.status, HTTP_OK);
    assert.equal(payload.result.data.json.changedCount, 1);
    assert.equal(payload.result.data.json.absentCount, 1);
    const committed = await db.attendance.findFirstOrThrow({
      where: { classSessionId: scenario.sessionId, enrollmentId: ana.enrollmentId },
    });
    assert.equal(committed.status, "ABSENT");
    const session = await db.classSession.findUniqueOrThrow({
      where: { id: scenario.sessionId },
      select: { attendanceLastCommittedAt: true, portalSubmittedAt: true },
    });
    assert.equal(session.portalSubmittedAt?.toISOString(), PORTAL_SUBMITTED_AT.toISOString());
    assert.equal(session.attendanceLastCommittedAt?.toISOString(), NEXT_SP_DAY_NOW.toISOString());
    assert.ok(
      session.attendanceLastCommittedAt !== null &&
        session.portalSubmittedAt !== null &&
        session.attendanceLastCommittedAt > session.portalSubmittedAt,
    );
  });
}

function registerForbiddenEditWindowTest(): void {
  databaseIt("returns 403 when an owning teacher edits outside the same-day window", async () => {
    const scenario = await harness.seedBaseScenario();
    const ana = await harness.enrollStudent({
      classId: scenario.classId,
      stageId: scenario.stageId,
      suffix: "Ana",
    });
    await callHttpMutation({
      path: CONFIRM_SESSION_PATH,
      body: { sessionId: scenario.sessionId, rows: [] },
      staffUser: harness.ns.admin,
      now: SAME_DAY_NOW,
    });

    const response = await callHttpMutation({
      path: EDIT_SESSION_PATH,
      body: {
        sessionId: scenario.sessionId,
        rows: [{ enrollmentId: ana.enrollmentId, status: "ABSENT" }],
      },
      staffUser: harness.ns.teacher,
      now: NEXT_SP_DAY_NOW,
    });

    assert.equal(response.status, HTTP_FORBIDDEN);
    const committed = await db.attendance.findFirstOrThrow({
      where: { classSessionId: scenario.sessionId, enrollmentId: ana.enrollmentId },
    });
    assert.equal(committed.status, "PRESENT");
  });
}
