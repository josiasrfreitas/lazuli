import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, describe } from "node:test";

import { db } from "@lazuli/db";
import { databaseIt } from "@lazuli/db/test";

import { SESSION_NOT_FOUND_MESSAGE } from "../../src/attendance/errors.js";
import { rosterHarness as harness } from "../support/attendance-namespaces.js";
import { expectRejects } from "../support/attendance-test-support.js";

void describe("attendance.sessionRoster", () => {
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

  registerRosterOrderingTest();
  registerWindowExclusionTest();
  registerOtherClassExclusionTest();
  registerUntakenFlagTest();
  registerUnknownSessionTest();
  registerScopeTest();
});

function registerRosterOrderingTest(): void {
  databaseIt(
    "returns the active roster ordered by name, PRESENT default, nothing committed",
    async () => {
      const scenario = await harness.seedBaseScenario();
      await harness.enrollStudent({
        classId: scenario.classId,
        stageId: scenario.stageId,
        suffix: "Bruno",
      });
      const ana = await harness.enrollStudent({
        classId: scenario.classId,
        stageId: scenario.stageId,
        suffix: "Ana",
      });

      const roster = await harness
        .caller()
        .attendance.sessionRoster({ sessionId: scenario.sessionId });

      assert.equal(roster.entries.length, 2);
      assert.equal(roster.entries[0]?.enrollmentId, ana.enrollmentId);
      assert.ok(roster.entries[0]?.studentFullName.endsWith("Ana"));
      assert.equal(roster.entries[0]?.defaultStatus, "PRESENT");
      assert.equal(roster.entries[0]?.committedStatus, null);
      assert.deepEqual(roster.makeupVisitors, []);
      assert.equal(roster.session.classId, scenario.classId);
    },
  );
}

function registerWindowExclusionTest(): void {
  databaseIt("excludes an enrollment whose window does not contain the session date", async () => {
    const scenario = await harness.seedBaseScenario();
    const inWindow = await harness.enrollStudent({
      classId: scenario.classId,
      stageId: scenario.stageId,
      suffix: "In Window",
    });
    await harness.enrollStudent({
      classId: scenario.classId,
      stageId: scenario.stageId,
      suffix: "Joins Later",
      entryDate: harness.ns.afterSessionDate,
    });

    const roster = await harness
      .caller()
      .attendance.sessionRoster({ sessionId: scenario.sessionId });

    assert.equal(roster.entries.length, 1);
    assert.equal(roster.entries[0]?.enrollmentId, inWindow.enrollmentId);
  });
}

function registerOtherClassExclusionTest(): void {
  databaseIt("excludes students enrolled in a different class", async () => {
    const scenario = await harness.seedBaseScenario();
    const mine = await harness.enrollStudent({
      classId: scenario.classId,
      stageId: scenario.stageId,
      suffix: "Mine",
    });
    const otherClassId = await harness.createClass({
      code: "other",
      teacherId: harness.ns.otherTeacher.id,
      stageId: scenario.stageId,
      semesterId: scenario.semesterId,
    });
    await harness.enrollStudent({
      classId: otherClassId,
      stageId: scenario.stageId,
      suffix: "Theirs",
    });

    const roster = await harness
      .caller()
      .attendance.sessionRoster({ sessionId: scenario.sessionId });

    assert.equal(roster.entries.length, 1);
    assert.equal(roster.entries[0]?.enrollmentId, mine.enrollmentId);
  });
}

function registerUntakenFlagTest(): void {
  databaseIt(
    "flags a past unconfirmed session untaken; clears the flag after confirm",
    async () => {
      const scenario = await harness.seedBaseScenario();
      await harness.enrollStudent({
        classId: scenario.classId,
        stageId: scenario.stageId,
        suffix: "Only",
      });

      const before = await harness
        .caller()
        .attendance.sessionRoster({ sessionId: scenario.sessionId });
      assert.equal(before.session.untaken, true);
      assert.equal(before.session.attendanceConfirmedAt, null);

      await harness.caller().attendance.confirmSession({ sessionId: scenario.sessionId, rows: [] });

      const afterConfirm = await harness
        .caller()
        .attendance.sessionRoster({ sessionId: scenario.sessionId });
      assert.equal(afterConfirm.session.untaken, false);
      assert.notEqual(afterConfirm.session.attendanceConfirmedAt, null);
      assert.equal(afterConfirm.entries[0]?.committedStatus, "PRESENT");
    },
  );
}

function registerUnknownSessionTest(): void {
  databaseIt("rejects an unknown session with a not-found error", async () => {
    await harness.seedBaseScenario();
    await expectRejects(
      harness.caller().attendance.sessionRoster({ sessionId: randomUUID() }),
      SESSION_NOT_FOUND_MESSAGE,
    );
  });
}

function registerScopeTest(): void {
  databaseIt("lets the owning teacher and admin read, but forbids another teacher", async () => {
    const scenario = await harness.seedBaseScenario();
    await harness.enrollStudent({
      classId: scenario.classId,
      stageId: scenario.stageId,
      suffix: "Only",
    });

    const teacher = harness.caller(harness.ns.teacher);
    const teacherRoster = await teacher.attendance.sessionRoster({ sessionId: scenario.sessionId });
    assert.equal(teacherRoster.entries.length, 1);
    const admin = harness.caller(harness.ns.admin);
    const adminRoster = await admin.attendance.sessionRoster({ sessionId: scenario.sessionId });
    assert.equal(adminRoster.entries.length, 1);

    await assert.rejects(
      harness
        .caller(harness.ns.otherTeacher)
        .attendance.sessionRoster({ sessionId: scenario.sessionId }),
      /FORBIDDEN/,
    );
  });
}
