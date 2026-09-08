import assert from "node:assert/strict";
import { after, before, beforeEach, describe } from "node:test";

import { db } from "@lazuli/db";
import { databaseIt } from "@lazuli/db/test";

import {
  ALREADY_CONFIRMED_MESSAGE,
  DUPLICATE_ROSTER_ROW_MESSAGE,
  ENROLLMENT_NOT_ON_ROSTER_MESSAGE,
  SESSION_CANCELLED_MESSAGE,
} from "../../src/attendance/errors.js";
import { confirmHarness as harness } from "../support/attendance-namespaces.js";
import { expectRejects } from "../support/attendance-test-support.js";

const SAME_DAY_NOW = new Date("2013-03-10T12:00:00.000Z");
const NEXT_SP_DAY_NOW = new Date("2013-03-11T03:01:00.000Z");

void describe("attendance.confirmSession", () => {
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

  registerNoDraftThenAtomicCommitTest();
  registerAllPresentDefaultTest();
  registerReconfirmRejectedTest();
  registerCancelledSessionRejectedTest();
  registerOffRosterRowRejectedTest();
  registerDuplicateRowRejectedTest();
  registerWindowEnforcedTest();
  registerTeacherSameDayWriteWindowTest();
  registerScopeTest();
});

function registerNoDraftThenAtomicCommitTest(): void {
  databaseIt("persists nothing before confirm, then commits every row atomically", async () => {
    const scenario = await harness.seedBaseScenario();
    const ana = await harness.enrollStudent({
      classId: scenario.classId,
      stageId: scenario.stageId,
      suffix: "Ana",
    });
    const bruno = await harness.enrollStudent({
      classId: scenario.classId,
      stageId: scenario.stageId,
      suffix: "Bruno",
    });

    const before = await db.attendance.count({ where: { classSessionId: scenario.sessionId } });
    assert.equal(before, 0);

    const result = await harness.caller().attendance.confirmSession({
      sessionId: scenario.sessionId,
      rows: [{ enrollmentId: bruno.enrollmentId, status: "ABSENT" }],
    });

    assert.equal(result.rosterCount, 2);
    assert.equal(result.presentCount, 1);
    assert.equal(result.absentCount, 1);
    await assertCommitted(scenario.sessionId, [
      { enrollmentId: ana.enrollmentId, status: "PRESENT" },
      { enrollmentId: bruno.enrollmentId, status: "ABSENT" },
    ]);
  });
}

async function assertCommitted(
  sessionId: string,
  expected: { enrollmentId: string; status: "PRESENT" | "ABSENT" }[],
): Promise<void> {
  const rows = await db.attendance.findMany({
    where: { classSessionId: sessionId },
    select: { enrollmentId: true, status: true, recordedById: true },
  });
  assert.equal(rows.length, expected.length);
  for (const want of expected) {
    const row = rows.find((candidate) => candidate.enrollmentId === want.enrollmentId);
    assert.equal(row?.status, want.status);
    assert.equal(row?.recordedById, harness.ns.admin.id);
  }
  const session = await db.classSession.findUniqueOrThrow({ where: { id: sessionId } });
  assert.notEqual(session.attendanceConfirmedAt, null);
  assert.equal(session.attendanceConfirmedById, harness.ns.admin.id);
  assert.notEqual(session.attendanceLastCommittedAt, null);
}

function registerAllPresentDefaultTest(): void {
  databaseIt(
    "defaults every untouched active enrollment to PRESENT when rows is empty",
    async () => {
      const scenario = await harness.seedBaseScenario();
      await harness.enrollStudent({
        classId: scenario.classId,
        stageId: scenario.stageId,
        suffix: "Ana",
      });
      await harness.enrollStudent({
        classId: scenario.classId,
        stageId: scenario.stageId,
        suffix: "Bruno",
      });

      const result = await harness
        .caller()
        .attendance.confirmSession({ sessionId: scenario.sessionId, rows: [] });

      assert.equal(result.presentCount, 2);
      assert.equal(result.absentCount, 0);
      const present = await db.attendance.count({
        where: { classSessionId: scenario.sessionId, status: "PRESENT" },
      });
      assert.equal(present, 2);
    },
  );
}

function registerReconfirmRejectedTest(): void {
  databaseIt("rejects confirming a session whose attendance is already confirmed", async () => {
    const scenario = await harness.seedBaseScenario();
    await harness.enrollStudent({
      classId: scenario.classId,
      stageId: scenario.stageId,
      suffix: "Ana",
    });
    await harness.caller().attendance.confirmSession({ sessionId: scenario.sessionId, rows: [] });

    await expectRejects(
      harness.caller().attendance.confirmSession({ sessionId: scenario.sessionId, rows: [] }),
      ALREADY_CONFIRMED_MESSAGE,
    );
  });
}

function registerCancelledSessionRejectedTest(): void {
  databaseIt("rejects confirming a cancelled session", async () => {
    const scenario = await harness.seedBaseScenario();
    await harness.enrollStudent({
      classId: scenario.classId,
      stageId: scenario.stageId,
      suffix: "Ana",
    });
    const cancelledId = await harness.createSession({
      classId: scenario.classId,
      date: harness.ns.afterSessionDate,
      status: "CANCELLED",
    });

    await expectRejects(
      harness.caller().attendance.confirmSession({ sessionId: cancelledId, rows: [] }),
      SESSION_CANCELLED_MESSAGE,
    );
  });
}

function registerOffRosterRowRejectedTest(): void {
  databaseIt("rejects a row for an enrollment that is not on the session roster", async () => {
    const scenario = await harness.seedBaseScenario();
    await harness.enrollStudent({
      classId: scenario.classId,
      stageId: scenario.stageId,
      suffix: "Ana",
    });
    const late = await harness.enrollStudent({
      classId: scenario.classId,
      stageId: scenario.stageId,
      suffix: "Late",
      entryDate: harness.ns.afterSessionDate,
    });

    await expectRejects(
      harness.caller().attendance.confirmSession({
        sessionId: scenario.sessionId,
        rows: [{ enrollmentId: late.enrollmentId, status: "ABSENT" }],
      }),
      ENROLLMENT_NOT_ON_ROSTER_MESSAGE,
    );
    const committed = await db.attendance.count({ where: { classSessionId: scenario.sessionId } });
    assert.equal(committed, 0);
  });
}

function registerDuplicateRowRejectedTest(): void {
  databaseIt("rejects duplicate enrollment rows in the same confirm", async () => {
    const scenario = await harness.seedBaseScenario();
    const ana = await harness.enrollStudent({
      classId: scenario.classId,
      stageId: scenario.stageId,
      suffix: "Ana",
    });

    await expectRejects(
      harness.caller().attendance.confirmSession({
        sessionId: scenario.sessionId,
        rows: [
          { enrollmentId: ana.enrollmentId, status: "PRESENT" },
          { enrollmentId: ana.enrollmentId, status: "ABSENT" },
        ],
      }),
      DUPLICATE_ROSTER_ROW_MESSAGE,
    );
  });
}

function registerWindowEnforcedTest(): void {
  databaseIt("commits only in-window enrollments (enrollment window enforced)", async () => {
    const scenario = await harness.seedBaseScenario();
    const ana = await harness.enrollStudent({
      classId: scenario.classId,
      stageId: scenario.stageId,
      suffix: "Ana",
    });
    const late = await harness.enrollStudent({
      classId: scenario.classId,
      stageId: scenario.stageId,
      suffix: "Late",
      entryDate: harness.ns.afterSessionDate,
    });

    const result = await harness
      .caller()
      .attendance.confirmSession({ sessionId: scenario.sessionId, rows: [] });

    assert.equal(result.rosterCount, 1);
    const anaRow = await db.attendance.count({
      where: { classSessionId: scenario.sessionId, enrollmentId: ana.enrollmentId },
    });
    const lateRow = await db.attendance.count({
      where: { classSessionId: scenario.sessionId, enrollmentId: late.enrollmentId },
    });
    assert.equal(anaRow, 1);
    assert.equal(lateRow, 0);
  });
}

function registerScopeTest(): void {
  databaseIt("lets the owning teacher confirm, but forbids another teacher", async () => {
    const scenario = await harness.seedBaseScenario();
    await harness.enrollStudent({
      classId: scenario.classId,
      stageId: scenario.stageId,
      suffix: "Ana",
    });

    await assert.rejects(
      harness.caller(harness.ns.otherTeacher, SAME_DAY_NOW).attendance.confirmSession({
        sessionId: scenario.sessionId,
        rows: [],
      }),
      /FORBIDDEN/,
    );

    const result = await harness
      .caller(harness.ns.teacher, SAME_DAY_NOW)
      .attendance.confirmSession({
        sessionId: scenario.sessionId,
        rows: [],
      });
    assert.equal(result.presentCount, 1);
  });
}

function registerTeacherSameDayWriteWindowTest(): void {
  databaseIt(
    "blocks an owning teacher from first-confirming outside the same Sao Paulo day",
    async () => {
      const scenario = await harness.seedBaseScenario();
      await harness.enrollStudent({
        classId: scenario.classId,
        stageId: scenario.stageId,
        suffix: "Ana",
      });

      await assert.rejects(
        harness.caller(harness.ns.teacher, NEXT_SP_DAY_NOW).attendance.confirmSession({
          sessionId: scenario.sessionId,
          rows: [],
        }),
        /FORBIDDEN/,
      );

      const committed = await db.attendance.count({
        where: { classSessionId: scenario.sessionId },
      });
      assert.equal(committed, 0);
    },
  );
}
