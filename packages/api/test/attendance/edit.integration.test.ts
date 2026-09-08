import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import { db } from "@lazuli/db";

import {
  ATTENDANCE_NOT_CONFIRMED_MESSAGE,
  DUPLICATE_ROSTER_ROW_MESSAGE,
  ENROLLMENT_NOT_ON_ROSTER_MESSAGE,
  SESSION_CANCELLED_MESSAGE,
} from "../../src/attendance/errors.js";
import { editHarness as harness } from "../support/attendance-namespaces.js";
import { rejectionMessage } from "../support/attendance-test-support.js";

const FIRST_COMMIT_AT = new Date("2014-03-10T12:00:00.000Z");
const SAME_DAY_EDIT_AT = new Date("2014-03-10T18:00:00.000Z");
const NEXT_SP_DAY_NOW = new Date("2014-03-11T03:01:00.000Z");
const PORTAL_SUBMITTED_AT = new Date("2014-03-10T20:00:00.000Z");

void describe("attendance.editSession", () => {
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

  registerOwningTeacherEditTest();
  registerTeacherWindowTest();
  registerOtherTeacherScopeTest();
  registerAdminPastEditTest();
  registerUnconfirmedRejectedTest();
  registerCancelledRejectedTest();
  registerDuplicateRowRejectedTest();
  registerOffRosterRejectedTest();
});

function registerOwningTeacherEditTest(): void {
  void it("lets the owning teacher edit same-day committed rows and stamps changed records", async () => {
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
    await harness.caller(harness.ns.admin, FIRST_COMMIT_AT).attendance.confirmSession({
      sessionId: scenario.sessionId,
      rows: [{ enrollmentId: ana.enrollmentId, status: "ABSENT" }],
    });

    const result = await harness
      .caller(harness.ns.teacher, SAME_DAY_EDIT_AT)
      .attendance.editSession({
        sessionId: scenario.sessionId,
        rows: [
          { enrollmentId: ana.enrollmentId, status: "PRESENT" },
          { enrollmentId: bruno.enrollmentId, status: "PRESENT" },
        ],
      });

    assert.equal(result.changedCount, 1);
    assert.equal(result.presentCount, 2);
    assert.equal(result.absentCount, 0);
    assert.equal(result.latestCommittedAt.toISOString(), SAME_DAY_EDIT_AT.toISOString());

    await assertChangedRowStamped({
      sessionId: scenario.sessionId,
      changedEnrollmentId: ana.enrollmentId,
      unchangedEnrollmentId: bruno.enrollmentId,
      expectedStatus: "PRESENT",
      modifiedAt: SAME_DAY_EDIT_AT,
      modifiedById: harness.ns.teacher.id,
    });
  });
}

async function assertChangedRowStamped(input: {
  sessionId: string;
  changedEnrollmentId: string;
  unchangedEnrollmentId: string;
  expectedStatus: "PRESENT" | "ABSENT";
  modifiedAt: Date;
  modifiedById: string;
}): Promise<void> {
  const rows = await db.attendance.findMany({
    where: { classSessionId: input.sessionId },
    select: { enrollmentId: true, status: true, lastModifiedAt: true, lastModifiedById: true },
  });
  const changedRow = rows.find((row) => row.enrollmentId === input.changedEnrollmentId);
  const unchangedRow = rows.find((row) => row.enrollmentId === input.unchangedEnrollmentId);
  assert.equal(changedRow?.status, input.expectedStatus);
  assert.equal(changedRow?.lastModifiedAt?.toISOString(), input.modifiedAt.toISOString());
  assert.equal(changedRow?.lastModifiedById, input.modifiedById);
  assert.equal(unchangedRow?.status, "PRESENT");
  assert.equal(unchangedRow?.lastModifiedAt, null);
  assert.equal(unchangedRow?.lastModifiedById, null);

  const session = await db.classSession.findUniqueOrThrow({ where: { id: input.sessionId } });
  assert.equal(session.attendanceLastCommittedAt?.toISOString(), input.modifiedAt.toISOString());
}

function registerTeacherWindowTest(): void {
  void it("blocks an owning teacher from editing outside the same Sao Paulo day", async () => {
    const scenario = await harness.seedBaseScenario();
    const ana = await harness.enrollStudent({
      classId: scenario.classId,
      stageId: scenario.stageId,
      suffix: "Ana",
    });
    await harness.caller(harness.ns.admin, FIRST_COMMIT_AT).attendance.confirmSession({
      sessionId: scenario.sessionId,
      rows: [],
    });

    await assert.rejects(
      harness.caller(harness.ns.teacher, NEXT_SP_DAY_NOW).attendance.editSession({
        sessionId: scenario.sessionId,
        rows: [{ enrollmentId: ana.enrollmentId, status: "ABSENT" }],
      }),
      /FORBIDDEN/,
    );

    const row = await db.attendance.findFirstOrThrow({
      where: { classSessionId: scenario.sessionId, enrollmentId: ana.enrollmentId },
    });
    assert.equal(row.status, "PRESENT");
    assert.equal(row.lastModifiedAt, null);
  });
}

function registerOtherTeacherScopeTest(): void {
  void it("blocks another teacher even on the session day", async () => {
    const scenario = await harness.seedBaseScenario();
    const ana = await harness.enrollStudent({
      classId: scenario.classId,
      stageId: scenario.stageId,
      suffix: "Ana",
    });
    await harness.caller(harness.ns.admin, FIRST_COMMIT_AT).attendance.confirmSession({
      sessionId: scenario.sessionId,
      rows: [],
    });

    await assert.rejects(
      harness.caller(harness.ns.otherTeacher, SAME_DAY_EDIT_AT).attendance.editSession({
        sessionId: scenario.sessionId,
        rows: [{ enrollmentId: ana.enrollmentId, status: "ABSENT" }],
      }),
      /FORBIDDEN/,
    );
  });
}

function registerAdminPastEditTest(): void {
  void it("lets an admin edit a past confirmed session and marks it for Portal retry", async () => {
    const scenario = await seedPortalSubmittedScenario();
    const { ana, bruno } = scenario;

    const result = await harness.caller(harness.ns.admin, NEXT_SP_DAY_NOW).attendance.editSession({
      sessionId: scenario.sessionId,
      rows: [
        { enrollmentId: ana.enrollmentId, status: "ABSENT" },
        { enrollmentId: bruno.enrollmentId, status: "PRESENT" },
      ],
    });

    assert.equal(result.changedCount, 1);
    assert.equal(result.presentCount, 1);
    assert.equal(result.absentCount, 1);
    assert.equal(result.latestCommittedAt.toISOString(), NEXT_SP_DAY_NOW.toISOString());

    await assertChangedRowStamped({
      sessionId: scenario.sessionId,
      changedEnrollmentId: ana.enrollmentId,
      unchangedEnrollmentId: bruno.enrollmentId,
      expectedStatus: "ABSENT",
      modifiedAt: NEXT_SP_DAY_NOW,
      modifiedById: harness.ns.admin.id,
    });
    await assertPortalRetryPredicate(scenario.sessionId);
  });
}

async function seedPortalSubmittedScenario(): Promise<{
  sessionId: string;
  ana: { enrollmentId: string };
  bruno: { enrollmentId: string };
}> {
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
  await harness.caller(harness.ns.admin, FIRST_COMMIT_AT).attendance.confirmSession({
    sessionId: scenario.sessionId,
    rows: [],
  });
  await db.classSession.update({
    where: { id: scenario.sessionId },
    data: { portalSubmittedAt: PORTAL_SUBMITTED_AT },
  });

  return { sessionId: scenario.sessionId, ana, bruno };
}

async function assertPortalRetryPredicate(sessionId: string): Promise<void> {
  const session = await db.classSession.findUniqueOrThrow({
    where: { id: sessionId },
    select: { attendanceLastCommittedAt: true, portalSubmittedAt: true },
  });
  assert.equal(session.portalSubmittedAt?.toISOString(), PORTAL_SUBMITTED_AT.toISOString());
  assert.equal(session.attendanceLastCommittedAt?.toISOString(), NEXT_SP_DAY_NOW.toISOString());
  assert.ok(
    session.attendanceLastCommittedAt !== null &&
      session.portalSubmittedAt !== null &&
      session.attendanceLastCommittedAt > session.portalSubmittedAt,
  );
}

function registerUnconfirmedRejectedTest(): void {
  void it("rejects editing an unconfirmed session", async () => {
    const scenario = await harness.seedBaseScenario();
    const ana = await harness.enrollStudent({
      classId: scenario.classId,
      stageId: scenario.stageId,
      suffix: "Ana",
    });

    assert.equal(
      await rejectionMessage(
        harness.caller().attendance.editSession({
          sessionId: scenario.sessionId,
          rows: [{ enrollmentId: ana.enrollmentId, status: "ABSENT" }],
        }),
      ),
      ATTENDANCE_NOT_CONFIRMED_MESSAGE,
    );
  });
}

function registerCancelledRejectedTest(): void {
  void it("rejects editing a cancelled session", async () => {
    const scenario = await harness.seedBaseScenario();
    const ana = await harness.enrollStudent({
      classId: scenario.classId,
      stageId: scenario.stageId,
      suffix: "Ana",
    });
    const cancelledId = await harness.createSession({
      classId: scenario.classId,
      date: harness.ns.afterSessionDate,
      status: "CANCELLED",
    });

    assert.equal(
      await rejectionMessage(
        harness.caller().attendance.editSession({
          sessionId: cancelledId,
          rows: [{ enrollmentId: ana.enrollmentId, status: "ABSENT" }],
        }),
      ),
      SESSION_CANCELLED_MESSAGE,
    );
  });
}

function registerDuplicateRowRejectedTest(): void {
  void it("rejects duplicate enrollment rows in an edit", async () => {
    const scenario = await harness.seedBaseScenario();
    const ana = await harness.enrollStudent({
      classId: scenario.classId,
      stageId: scenario.stageId,
      suffix: "Ana",
    });
    await harness.caller().attendance.confirmSession({ sessionId: scenario.sessionId, rows: [] });

    assert.equal(
      await rejectionMessage(
        harness.caller().attendance.editSession({
          sessionId: scenario.sessionId,
          rows: [
            { enrollmentId: ana.enrollmentId, status: "PRESENT" },
            { enrollmentId: ana.enrollmentId, status: "ABSENT" },
          ],
        }),
      ),
      DUPLICATE_ROSTER_ROW_MESSAGE,
    );
  });
}

function registerOffRosterRejectedTest(): void {
  void it("rejects editing a row for an enrollment outside the session roster", async () => {
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
    await harness.caller().attendance.confirmSession({ sessionId: scenario.sessionId, rows: [] });

    assert.equal(
      await rejectionMessage(
        harness.caller().attendance.editSession({
          sessionId: scenario.sessionId,
          rows: [{ enrollmentId: late.enrollmentId, status: "ABSENT" }],
        }),
      ),
      ENROLLMENT_NOT_ON_ROSTER_MESSAGE,
    );
  });
}
