import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, describe } from "node:test";

import { db } from "@lazuli/db";
import { databaseIt } from "@lazuli/db/test";

import {
  MAKEUP_ALREADY_ATTENDED_MESSAGE,
  MAKEUP_ALREADY_CANCELLED_MESSAGE,
  MAKEUP_NOT_FOUND_MESSAGE,
} from "../../src/attendance/makeup-errors.js";
import { expectRejects } from "./attendance-test-support.js";
import { cancelHarness as harness } from "./makeup-namespaces.js";
import { FAR_FUTURE_DATE, insertMakeup } from "./makeup-test-support.js";

const CANCEL_REASON = "aluno desistiu";

type CancelSetup = { originEnrollmentId: string; targetClassSessionId: string };

async function setup(): Promise<CancelSetup> {
  const scenario = await harness.seedBaseScenario();
  const targetClassId = await harness.createClass({
    code: "target",
    teacherId: harness.ns.otherTeacher.id,
    stageId: scenario.stageId,
    semesterId: scenario.semesterId,
  });
  const student = await harness.enrollStudent({
    classId: scenario.classId,
    stageId: scenario.stageId,
    suffix: "Bento",
  });
  const targetClassSessionId = await harness.createSession({
    classId: targetClassId,
    date: FAR_FUTURE_DATE,
  });

  return { originEnrollmentId: student.enrollmentId, targetClassSessionId };
}

void describe("attendance.cancelMakeup", () => {
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

  registerCancelTest();
  registerDoubleCancelTest();
  registerCancelAfterAttendedTest();
  registerNotFoundTest();
  registerScopeTest();
});

function registerCancelTest(): void {
  databaseIt("stamps cancellation fields on the makeup", async () => {
    const context = await setup();
    const makeupId = await insertMakeup(context);

    const result = await harness.caller().attendance.cancelMakeup({
      makeupId,
      reason: CANCEL_REASON,
    });

    assert.equal(result.makeupId, makeupId);
    const row = await db.makeup.findUnique({
      where: { id: makeupId },
      select: { cancelledAt: true, cancelledById: true, cancellationReason: true },
    });
    assert.notEqual(row?.cancelledAt, null);
    assert.equal(row?.cancelledById, harness.ns.admin.id);
    assert.equal(row?.cancellationReason, CANCEL_REASON);
  });
}

function registerDoubleCancelTest(): void {
  databaseIt("rejects cancelling an already-cancelled makeup", async () => {
    const context = await setup();
    const makeupId = await insertMakeup({ ...context, cancelledAt: new Date() });

    await expectRejects(
      harness.caller().attendance.cancelMakeup({ makeupId, reason: CANCEL_REASON }),
      MAKEUP_ALREADY_CANCELLED_MESSAGE,
    );
  });
}

function registerCancelAfterAttendedTest(): void {
  databaseIt("rejects cancelling a makeup that was already attended", async () => {
    const context = await setup();
    const makeupId = await insertMakeup({ ...context, attendedAt: new Date() });

    await expectRejects(
      harness.caller().attendance.cancelMakeup({ makeupId, reason: CANCEL_REASON }),
      MAKEUP_ALREADY_ATTENDED_MESSAGE,
    );
  });
}

function registerNotFoundTest(): void {
  databaseIt("rejects an unknown makeup", async () => {
    await setup();

    await expectRejects(
      harness.caller().attendance.cancelMakeup({ makeupId: randomUUID(), reason: CANCEL_REASON }),
      MAKEUP_NOT_FOUND_MESSAGE,
    );
  });
}

function registerScopeTest(): void {
  databaseIt("forbids a teacher (cancel is admin-only)", async () => {
    const context = await setup();
    const makeupId = await insertMakeup(context);

    await assert.rejects(
      harness
        .caller(harness.ns.teacher)
        .attendance.cancelMakeup({ makeupId, reason: CANCEL_REASON }),
      /FORBIDDEN/,
    );
  });
}
