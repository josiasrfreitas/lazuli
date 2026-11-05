import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import { db, computeEnrollmentsPercentInWindow } from "@lazuli/db";

import { percentHarness as harness } from "../support/attendance-namespaces.js";
import { insertMakeup } from "../support/makeup-test-support.js";

const CONFIRM_NOW = new Date("3000-03-10T12:00:00.000Z");
const INCLUDED_PRESENT_DATE = new Date("3000-05-01T00:00:00.000Z");
const INCLUDED_ABSENT_DATE = new Date("3000-06-01T00:00:00.000Z");
const UNCONFIRMED_FUTURE_DATE = new Date("3000-06-15T00:00:00.000Z");
const CANCELLED_DATE = new Date("3000-04-15T00:00:00.000Z");
const BEFORE_ENROLLMENT_DATE = new Date("3000-02-15T00:00:00.000Z");
const AFTER_SEMESTER_DATE = new Date("3000-07-01T00:00:00.000Z");
const EXPECTED_HELD_SESSIONS = 3;
const EXPECTED_PRESENT_COUNT = 2;
const EXPECTED_PERCENT = EXPECTED_PRESENT_COUNT / EXPECTED_HELD_SESSIONS;

void describe("attendance.enrollmentSemesterPercent", () => {
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

  registerFormulaTest();
  registerEmptyDenominatorTest();
  registerScopeTest();
  registerBatchPercentTest();
});

function registerBatchPercentTest(): void {
  void it("batches classmates without sharing enrollment windows or treating missing rows as present", async () => {
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
    await seedPercentFacts({
      classId: scenario.classId,
      homeSessionId: scenario.sessionId,
      enrollmentId: ana.enrollmentId,
    });
    // This enrollment has no recorded rows in the already confirmed sessions.
    const carla = await harness.enrollStudent({
      classId: scenario.classId,
      stageId: scenario.stageId,
      suffix: "Carla",
    });
    await db.$transaction(async (database) => {
      await database.pedagogicalProgress.updateMany({
        where: { enrollmentId: bruno.enrollmentId, endDate: null },
        data: { endDate: INCLUDED_ABSENT_DATE, endReason: "DROPPED" },
      });
      await database.enrollment.update({
        where: { id: bruno.enrollmentId },
        data: {
          entryDate: INCLUDED_PRESENT_DATE,
          exitDate: INCLUDED_ABSENT_DATE,
          exitReason: "DROPPED",
        },
      });
    });
    const enrollments = await db.enrollment.findMany({
      where: { id: { in: [ana.enrollmentId, bruno.enrollmentId, carla.enrollmentId] } },
      select: { id: true, classId: true, entryDate: true, exitDate: true },
    });
    const semester = await db.period.findUniqueOrThrow({ where: { id: scenario.semesterId } });

    const result = await computeEnrollmentsPercentInWindow({
      database: db,
      values: { enrollments, semester },
    });

    assert.deepEqual(result.get(ana.enrollmentId), {
      heldSessions: 3,
      presentCount: 2,
      heldMinutes: 360,
      presentMinutes: 240,
      compensatedMinutes: 0,
      missingMinutes: 120,
      percent: 2 / 3,
      flagged: true,
    });
    assert.deepEqual(result.get(bruno.enrollmentId), {
      heldSessions: 1,
      presentCount: 1,
      heldMinutes: 120,
      presentMinutes: 120,
      compensatedMinutes: 0,
      missingMinutes: 0,
      percent: 1,
      flagged: false,
    });
    assert.deepEqual(result.get(carla.enrollmentId), {
      heldSessions: 3,
      presentCount: 0,
      heldMinutes: 360,
      presentMinutes: 0,
      compensatedMinutes: 0,
      missingMinutes: 360,
      percent: 0,
      flagged: true,
    });
    // Deleted attendance is missing attendance, not a removed lesson.
    await db.attendance.updateMany({
      where: { enrollmentId: ana.enrollmentId, status: "PRESENT" },
      data: { deletedAt: CONFIRM_NOW },
    });
    const withoutPresentRows = await computeEnrollmentsPercentInWindow({
      database: db,
      values: { enrollments, semester },
    });
    assert.deepEqual(withoutPresentRows.get(ana.enrollmentId), {
      heldSessions: 3,
      presentCount: 0,
      heldMinutes: 360,
      presentMinutes: 0,
      compensatedMinutes: 0,
      missingMinutes: 360,
      percent: 0,
      flagged: true,
    });
    await db.classSession.update({
      where: { id: scenario.sessionId },
      data: { deletedAt: CONFIRM_NOW },
    });
    const withoutDeletedSession = await computeEnrollmentsPercentInWindow({
      database: db,
      values: { enrollments, semester },
    });
    assert.equal(withoutDeletedSession.get(ana.enrollmentId)?.heldSessions, 2);
    assert.equal(withoutDeletedSession.get(carla.enrollmentId)?.heldMinutes, 240);
  });
}

function registerFormulaTest(): void {
  void it("computes from confirmed held sessions and excludes unconfirmed, cancelled, out-of-window, and makeup facts", async () => {
    const scenario = await harness.seedBaseScenario();
    const ana = await harness.enrollStudent({
      classId: scenario.classId,
      stageId: scenario.stageId,
      suffix: "Ana",
    });

    await seedPercentFacts({
      classId: scenario.classId,
      homeSessionId: scenario.sessionId,
      enrollmentId: ana.enrollmentId,
    });

    const result = await harness.caller().attendance.enrollmentSemesterPercent({
      enrollmentId: ana.enrollmentId,
      semesterId: scenario.semesterId,
    });

    assert.equal(result.enrollmentId, ana.enrollmentId);
    assert.equal(result.semesterId, scenario.semesterId);
    assert.equal(result.heldSessions, EXPECTED_HELD_SESSIONS);
    assert.equal(result.presentCount, EXPECTED_PRESENT_COUNT);
    assert.equal(result.percent, EXPECTED_PERCENT);
    assert.equal(result.flagged, true);
  });
}

function registerEmptyDenominatorTest(): void {
  void it("returns sem dados and no flag when no sessions are held", async () => {
    const scenario = await harness.seedBaseScenario();
    const ana = await harness.enrollStudent({
      classId: scenario.classId,
      stageId: scenario.stageId,
      suffix: "Ana",
    });

    const result = await harness.caller().attendance.enrollmentSemesterPercent({
      enrollmentId: ana.enrollmentId,
      semesterId: scenario.semesterId,
    });

    assert.equal(result.heldSessions, 0);
    assert.equal(result.presentCount, 0);
    assert.equal(result.percent, null);
    assert.equal(result.flagged, false);
  });
}

function registerScopeTest(): void {
  void it("lets the owning teacher read the percent and forbids another teacher", async () => {
    const scenario = await harness.seedBaseScenario();
    const ana = await harness.enrollStudent({
      classId: scenario.classId,
      stageId: scenario.stageId,
      suffix: "Ana",
    });

    const ownerResult = await harness
      .caller(harness.ns.teacher)
      .attendance.enrollmentSemesterPercent({
        enrollmentId: ana.enrollmentId,
        semesterId: scenario.semesterId,
      });
    assert.equal(ownerResult.enrollmentId, ana.enrollmentId);

    await assert.rejects(
      harness.caller(harness.ns.otherTeacher).attendance.enrollmentSemesterPercent({
        enrollmentId: ana.enrollmentId,
        semesterId: scenario.semesterId,
      }),
      /FORBIDDEN/,
    );
  });
}

async function seedPercentFacts(input: {
  classId: string;
  homeSessionId: string;
  enrollmentId: string;
}): Promise<void> {
  const includedPresentId = await confirmIncludedSessions(input);
  await seedExcludedSessionFacts({
    classId: input.classId,
    enrollmentId: input.enrollmentId,
  });
  await insertMakeup({
    originEnrollmentId: input.enrollmentId,
    targetClassSessionId: includedPresentId,
    attendedAt: CONFIRM_NOW,
    attendedById: harness.ns.admin.id,
  });
}

async function confirmIncludedSessions(input: {
  classId: string;
  homeSessionId: string;
  enrollmentId: string;
}): Promise<string> {
  const includedPresentId = await harness.createSession({
    classId: input.classId,
    date: INCLUDED_PRESENT_DATE,
  });
  const includedAbsentId = await harness.createSession({
    classId: input.classId,
    date: INCLUDED_ABSENT_DATE,
  });

  await harness.caller(harness.ns.admin, CONFIRM_NOW).attendance.confirmSession({
    sessionId: input.homeSessionId,
    rows: [],
  });
  await harness.caller(harness.ns.admin, CONFIRM_NOW).attendance.confirmSession({
    sessionId: includedPresentId,
    rows: [],
  });
  await harness.caller(harness.ns.admin, CONFIRM_NOW).attendance.confirmSession({
    sessionId: includedAbsentId,
    rows: [{ enrollmentId: input.enrollmentId, status: "ABSENT" }],
  });

  return includedPresentId;
}

async function seedExcludedSessionFacts(input: {
  classId: string;
  enrollmentId: string;
}): Promise<void> {
  await harness.createSession({
    classId: input.classId,
    date: UNCONFIRMED_FUTURE_DATE,
  });
  await harness.createSession({
    classId: input.classId,
    date: CANCELLED_DATE,
    status: "CANCELLED",
  });
  await insertConfirmedAttendance({
    classId: input.classId,
    enrollmentId: input.enrollmentId,
    date: BEFORE_ENROLLMENT_DATE,
  });
  await insertConfirmedAttendance({
    classId: input.classId,
    enrollmentId: input.enrollmentId,
    date: AFTER_SEMESTER_DATE,
  });
}

async function insertConfirmedAttendance(input: {
  classId: string;
  enrollmentId: string;
  date: Date;
}): Promise<void> {
  const sessionId = await harness.createSession({ classId: input.classId, date: input.date });
  await db.classSession.update({
    where: { id: sessionId },
    data: { attendanceConfirmedAt: CONFIRM_NOW, attendanceConfirmedById: harness.ns.admin.id },
  });
  await db.attendance.create({
    data: {
      enrollmentId: input.enrollmentId,
      classSessionId: sessionId,
      status: "PRESENT",
      recordedById: harness.ns.admin.id,
    },
  });
}
