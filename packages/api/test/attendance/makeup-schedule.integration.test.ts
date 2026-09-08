import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, describe } from "node:test";

import { db } from "@lazuli/db";
import { databaseIt } from "@lazuli/db/test";

import { SESSION_NOT_FOUND_MESSAGE } from "../../src/attendance/errors.js";
import {
  MAKEUP_DUPLICATE_MESSAGE,
  MAKEUP_SAME_CLASS_MESSAGE,
  MAKEUP_TARGET_CANCELLED_MESSAGE,
  MAKEUP_TARGET_IN_PAST_MESSAGE,
  ORIGIN_ENROLLMENT_NOT_FOUND_MESSAGE,
} from "../../src/attendance/makeup-errors.js";
import { expectRejects } from "../support/attendance-test-support.js";
import { scheduleHarness as harness } from "../support/makeup-namespaces.js";
import { FAR_FUTURE_DATE } from "../support/makeup-test-support.js";

type Setup = {
  scenarioClassId: string;
  semesterId: string;
  stageId: string;
  originEnrollmentId: string;
  targetClassId: string;
};

async function setup(): Promise<Setup> {
  const scenario = await harness.seedBaseScenario();
  const student = await harness.enrollStudent({
    classId: scenario.classId,
    stageId: scenario.stageId,
    suffix: "Bento",
  });
  const targetClassId = await harness.createClass({
    code: "target",
    teacherId: harness.ns.otherTeacher.id,
    stageId: scenario.stageId,
    semesterId: scenario.semesterId,
  });

  return {
    scenarioClassId: scenario.classId,
    semesterId: scenario.semesterId,
    stageId: scenario.stageId,
    originEnrollmentId: student.enrollmentId,
    targetClassId,
  };
}

void describe("attendance.scheduleMakeup", () => {
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

  registerAcceptTest();
  registerAdvanceDateTest();
  registerSameClassTests();
  registerDuplicateTest();
  registerCancelledTargetTest();
  registerNotFoundTests();
  registerScopeTest();
});

function registerAcceptTest(): void {
  databaseIt(
    "creates a makeup into a future session in another class, stamped by the admin",
    async () => {
      const context = await setup();
      const targetSessionId = await harness.createSession({
        classId: context.targetClassId,
        date: FAR_FUTURE_DATE,
      });

      const result = await harness.caller().attendance.scheduleMakeup({
        originEnrollmentId: context.originEnrollmentId,
        targetClassSessionId: targetSessionId,
      });

      assert.equal(result.targetClassSessionId, targetSessionId);
      const row = await db.makeup.findUnique({
        where: { id: result.makeupId },
        select: { scheduledById: true, reason: true },
      });
      assert.equal(row?.scheduledById, harness.ns.admin.id);
      assert.equal(row?.reason, null);
    },
  );
}

function registerAdvanceDateTest(): void {
  databaseIt("rejects a target session that is not at least tomorrow", async () => {
    const context = await setup();
    const pastSessionId = await harness.createSession({
      classId: context.targetClassId,
      date: harness.ns.sessionDate,
    });

    await expectRejects(
      harness.caller().attendance.scheduleMakeup({
        originEnrollmentId: context.originEnrollmentId,
        targetClassSessionId: pastSessionId,
      }),
      MAKEUP_TARGET_IN_PAST_MESSAGE,
    );
  });
}

function registerSameClassTests(): void {
  databaseIt(
    "rejects a same-class target with no override reason, allows it with one",
    async () => {
      const context = await setup();
      const rejectedId = await harness.createSession({
        classId: context.scenarioClassId,
        date: FAR_FUTURE_DATE,
      });

      await expectRejects(
        harness.caller().attendance.scheduleMakeup({
          originEnrollmentId: context.originEnrollmentId,
          targetClassSessionId: rejectedId,
        }),
        MAKEUP_SAME_CLASS_MESSAGE,
      );

      const result = await harness.caller().attendance.scheduleMakeup({
        originEnrollmentId: context.originEnrollmentId,
        targetClassSessionId: rejectedId,
        reason: "aula extra",
      });
      assert.ok(result.makeupId);
    },
  );
}

function registerDuplicateTest(): void {
  databaseIt("rejects a duplicate makeup for the same origin and target", async () => {
    const context = await setup();
    const targetSessionId = await harness.createSession({
      classId: context.targetClassId,
      date: FAR_FUTURE_DATE,
    });
    const input = {
      originEnrollmentId: context.originEnrollmentId,
      targetClassSessionId: targetSessionId,
    };

    await harness.caller().attendance.scheduleMakeup(input);
    await expectRejects(
      harness.caller().attendance.scheduleMakeup(input),
      MAKEUP_DUPLICATE_MESSAGE,
    );
  });
}

function registerCancelledTargetTest(): void {
  databaseIt("rejects a cancelled target session", async () => {
    const context = await setup();
    const cancelledId = await harness.createSession({
      classId: context.targetClassId,
      date: FAR_FUTURE_DATE,
      status: "CANCELLED",
    });

    await expectRejects(
      harness.caller().attendance.scheduleMakeup({
        originEnrollmentId: context.originEnrollmentId,
        targetClassSessionId: cancelledId,
      }),
      MAKEUP_TARGET_CANCELLED_MESSAGE,
    );
  });
}

function registerNotFoundTests(): void {
  databaseIt("rejects an unknown origin enrollment or target session", async () => {
    const context = await setup();
    const targetSessionId = await harness.createSession({
      classId: context.targetClassId,
      date: FAR_FUTURE_DATE,
    });

    await expectRejects(
      harness.caller().attendance.scheduleMakeup({
        originEnrollmentId: randomUUID(),
        targetClassSessionId: targetSessionId,
      }),
      ORIGIN_ENROLLMENT_NOT_FOUND_MESSAGE,
    );
    await expectRejects(
      harness.caller().attendance.scheduleMakeup({
        originEnrollmentId: context.originEnrollmentId,
        targetClassSessionId: randomUUID(),
      }),
      SESSION_NOT_FOUND_MESSAGE,
    );
  });
}

function registerScopeTest(): void {
  databaseIt("forbids a teacher (schedule is admin-only)", async () => {
    const context = await setup();
    const targetSessionId = await harness.createSession({
      classId: context.targetClassId,
      date: FAR_FUTURE_DATE,
    });

    await assert.rejects(
      harness.caller(harness.ns.teacher).attendance.scheduleMakeup({
        originEnrollmentId: context.originEnrollmentId,
        targetClassSessionId: targetSessionId,
      }),
      /FORBIDDEN/,
    );
  });
}
