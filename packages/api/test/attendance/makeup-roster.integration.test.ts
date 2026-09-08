import assert from "node:assert/strict";
import { after, before, beforeEach, describe } from "node:test";

import { db } from "@lazuli/db";
import { databaseIt } from "@lazuli/db/test";

import { visitorHarness as harness } from "./makeup-namespaces.js";
import { FAR_FUTURE_DATE, insertMakeup } from "./makeup-test-support.js";

type VisitorSetup = {
  originEnrollmentId: string;
  targetClassId: string;
  stageId: string;
  semesterId: string;
  originClassInternalCode: string;
};

// The target class (roster owner) is the base class owned by ns.teacher; the visitor's home enrollment
// lives in a separate origin class, so it renders as a visitor, never in the roster entries.
async function setup(): Promise<VisitorSetup> {
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
    suffix: "Vera",
  });

  return {
    originEnrollmentId: student.enrollmentId,
    targetClassId: scenario.classId,
    stageId: scenario.stageId,
    semesterId: scenario.semesterId,
    originClassInternalCode: `${harness.ns.prefix}origin`,
  };
}

void describe("attendance.sessionRoster makeup visitors", () => {
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

  registerScheduledVisitorTest();
  registerNoShowTest();
  registerAttendedTest();
  registerCancelledHiddenTest();
  registerSeparationTest();
});

function registerScheduledVisitorTest(): void {
  databaseIt(
    "renders a future visitor with its origin class code and SCHEDULED status",
    async () => {
      const context = await setup();
      const sessionId = await harness.createSession({
        classId: context.targetClassId,
        date: FAR_FUTURE_DATE,
      });
      await insertMakeup({
        originEnrollmentId: context.originEnrollmentId,
        targetClassSessionId: sessionId,
      });

      const roster = await harness.caller().attendance.sessionRoster({ sessionId });

      assert.equal(roster.makeupVisitors.length, 1);
      assert.equal(roster.makeupVisitors[0]?.status, "SCHEDULED");
      assert.equal(
        roster.makeupVisitors[0]?.originClassInternalCode,
        context.originClassInternalCode,
      );
      assert.ok(roster.makeupVisitors[0]?.studentFullName.endsWith("Vera"));
    },
  );
}

function registerNoShowTest(): void {
  databaseIt("derives NO_SHOW for a past visitor with no outcome", async () => {
    const context = await setup();
    const sessionId = await harness.createSession({
      classId: context.targetClassId,
      date: harness.ns.afterSessionDate,
    });
    await insertMakeup({
      originEnrollmentId: context.originEnrollmentId,
      targetClassSessionId: sessionId,
    });

    const roster = await harness.caller().attendance.sessionRoster({ sessionId });

    assert.equal(roster.makeupVisitors[0]?.status, "NO_SHOW");
  });
}

function registerAttendedTest(): void {
  databaseIt("derives ATTENDED once the visitor outcome is recorded", async () => {
    const context = await setup();
    const sessionId = await harness.createSession({
      classId: context.targetClassId,
      date: harness.ns.afterSessionDate,
    });
    await insertMakeup({
      originEnrollmentId: context.originEnrollmentId,
      targetClassSessionId: sessionId,
      attendedAt: new Date(),
    });

    const roster = await harness.caller().attendance.sessionRoster({ sessionId });

    assert.equal(roster.makeupVisitors[0]?.status, "ATTENDED");
  });
}

function registerCancelledHiddenTest(): void {
  databaseIt("hides a cancelled makeup from the visitor list", async () => {
    const context = await setup();
    const sessionId = await harness.createSession({
      classId: context.targetClassId,
      date: FAR_FUTURE_DATE,
    });
    await insertMakeup({
      originEnrollmentId: context.originEnrollmentId,
      targetClassSessionId: sessionId,
      cancelledAt: new Date(),
    });

    const roster = await harness.caller().attendance.sessionRoster({ sessionId });

    assert.equal(roster.makeupVisitors.length, 0);
  });
}

function registerSeparationTest(): void {
  databaseIt("keeps visitors out of roster entries and confirm counts", async () => {
    const context = await setup();
    const sessionId = await harness.createSession({
      classId: context.targetClassId,
      date: FAR_FUTURE_DATE,
    });
    await harness.enrollStudent({
      classId: context.targetClassId,
      stageId: context.stageId,
      suffix: "Real",
      entryDate: FAR_FUTURE_DATE,
    });
    await insertMakeup({
      originEnrollmentId: context.originEnrollmentId,
      targetClassSessionId: sessionId,
    });

    const roster = await harness.caller().attendance.sessionRoster({ sessionId });
    assert.equal(roster.entries.length, 1);
    assert.equal(roster.makeupVisitors.length, 1);

    const confirmed = await harness.caller().attendance.confirmSession({ sessionId, rows: [] });
    assert.equal(confirmed.rosterCount, 1);
  });
}
