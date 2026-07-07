import assert from "node:assert/strict";
import { after, before, beforeEach, describe } from "node:test";

import { db } from "@lazuli/db";
import { databaseIt } from "@lazuli/db/test";

import {
  MAKEUP_ALREADY_CANCELLED_MESSAGE,
  MAKEUP_TARGET_CANCELLED_MESSAGE,
} from "../../src/attendance/makeup-errors.js";
import { expectRejects } from "./attendance-test-support.js";
import { outcomeHarness as harness } from "./makeup-namespaces.js";
import { attendanceRowCount, insertMakeup } from "./makeup-test-support.js";

type OutcomeSetup = {
  originEnrollmentId: string;
  targetClassSessionId: string;
  cancelledSessionId: string;
};

// The target session lives in the base class owned by ns.teacher; the origin enrollment is in a separate
// class owned by ns.otherTeacher, so outcome resource-scope is exercised on the target owner only.
async function setup(): Promise<OutcomeSetup> {
  const scenario = await harness.seedBaseScenario();
  const originClassId = await harness.createClass({
    code: "origin",
    teacherId: harness.ns.otherTeacher.id,
    stageId: scenario.stageId,
    semesterId: scenario.semesterId,
  });
  const student = await harness.enrollStudent({
    classId: originClassId,
    stageId: scenario.stageId,
    suffix: "Bento",
  });
  const cancelledSessionId = await harness.createSession({
    classId: scenario.classId,
    date: harness.ns.afterSessionDate,
    status: "CANCELLED",
  });

  return {
    originEnrollmentId: student.enrollmentId,
    targetClassSessionId: scenario.sessionId,
    cancelledSessionId,
  };
}

void describe("attendance.markMakeupOutcome", () => {
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

  registerAttendedTest();
  registerClearTest();
  registerScopeTest();
  registerCancelledMakeupTest();
  registerCancelledTargetTest();
  registerNoAttendanceRowTest();
});

function registerAttendedTest(): void {
  databaseIt("stamps attendedAt/attendedById when the owning teacher marks attended", async () => {
    const context = await setup();
    const makeupId = await insertMakeup(context);

    const result = await harness.caller(harness.ns.teacher).attendance.markMakeupOutcome({
      makeupId,
      attended: true,
    });

    assert.equal(result.attended, true);
    const row = await db.makeup.findUnique({
      where: { id: makeupId },
      select: { attendedAt: true, attendedById: true },
    });
    assert.notEqual(row?.attendedAt, null);
    assert.equal(row?.attendedById, harness.ns.teacher.id);
  });
}

function registerClearTest(): void {
  databaseIt("clears attendance when re-marked as not attended (reversible)", async () => {
    const context = await setup();
    const makeupId = await insertMakeup(context);
    const caller = harness.caller(harness.ns.admin);

    await caller.attendance.markMakeupOutcome({ makeupId, attended: true });
    await caller.attendance.markMakeupOutcome({ makeupId, attended: false });

    const row = await db.makeup.findUnique({
      where: { id: makeupId },
      select: { attendedAt: true, attendedById: true },
    });
    assert.equal(row?.attendedAt, null);
    assert.equal(row?.attendedById, null);
  });
}

function registerScopeTest(): void {
  databaseIt("forbids a teacher who does not own the target session", async () => {
    const context = await setup();
    const makeupId = await insertMakeup(context);

    await assert.rejects(
      harness.caller(harness.ns.otherTeacher).attendance.markMakeupOutcome({
        makeupId,
        attended: true,
      }),
      /FORBIDDEN/,
    );
  });
}

function registerCancelledMakeupTest(): void {
  databaseIt("rejects marking a cancelled makeup", async () => {
    const context = await setup();
    const makeupId = await insertMakeup({ ...context, cancelledAt: new Date() });

    await expectRejects(
      harness.caller(harness.ns.teacher).attendance.markMakeupOutcome({ makeupId, attended: true }),
      MAKEUP_ALREADY_CANCELLED_MESSAGE,
    );
  });
}

function registerCancelledTargetTest(): void {
  databaseIt("rejects marking a makeup whose target session is cancelled", async () => {
    const context = await setup();
    const makeupId = await insertMakeup({
      originEnrollmentId: context.originEnrollmentId,
      targetClassSessionId: context.cancelledSessionId,
    });

    await expectRejects(
      harness.caller(harness.ns.teacher).attendance.markMakeupOutcome({ makeupId, attended: true }),
      MAKEUP_TARGET_CANCELLED_MESSAGE,
    );
  });
}

function registerNoAttendanceRowTest(): void {
  databaseIt("never writes an Attendance row (makeups do not affect the %)", async () => {
    const context = await setup();
    const makeupId = await insertMakeup(context);

    await harness.caller(harness.ns.teacher).attendance.markMakeupOutcome({ makeupId, attended: true });

    const count = await attendanceRowCount({
      enrollmentId: context.originEnrollmentId,
      classSessionId: context.targetClassSessionId,
    });
    assert.equal(count, 0);
  });
}
