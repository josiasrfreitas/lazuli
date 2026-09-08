import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import { db } from "@lazuli/db";

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
});

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
