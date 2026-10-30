import assert from "node:assert/strict";
import { after, beforeEach, it } from "node:test";
import { db } from "@lazuli/db";
import { outcomeHarness as harness } from "../support/makeup-namespaces.js";
import { appointmentFixture } from "../support/appointment-fixtures.js";
import { insertMakeup, attendanceRowCount } from "../support/makeup-test-support.js";
beforeEach(() => harness.clean());
after(async () => {
  await harness.clean();
  await db.$disconnect();
});
const actual = {
  attended: true,
  expectedVersion: 0,
  performedContent: "Retomada de escuta e perguntas em duplas.",
  performedMinutes: 120,
  notes: "",
  reason: "",
};

void it("records actual delivery through the legacy entry point without rewriting original attendance", async () => {
  const fixtureData = await appointmentFixture(harness);
  const makeupId = await insertMakeup({
    originEnrollmentId: fixtureData.enrollmentId,
    targetClassSessionId: fixtureData.targetId,
  });
  await harness
    .caller(harness.ns.otherTeacher, fixtureData.after)
    .attendance.markMakeupOutcome({ ...actual, makeupId, coverages: fixtureData.input.coverages });
  const row = await db.makeup.findUniqueOrThrow({
    where: { id: makeupId },
    include: { appointment: true },
  });
  assert.equal(row.attendedAt?.toISOString(), fixtureData.after.toISOString());
  assert.equal(row.attendedById, harness.ns.otherTeacher.id);
  assert.equal(row.appointment?.performedMinutes, 120);
  assert.equal(row.appointment?.performedContent, actual.performedContent);
  assert.equal(
    await attendanceRowCount({
      enrollmentId: fixtureData.enrollmentId,
      classSessionId: fixtureData.targetId,
    }),
    0,
  );
  const originalAttendance = await db.attendance.findUniqueOrThrow({
    where: { id: fixtureData.absence.id },
  });
  assert.equal(originalAttendance.status, "ABSENT");
  const percent = await harness.caller().attendance.enrollmentSemesterPercent({
    enrollmentId: fixtureData.enrollmentId,
    semesterId: fixtureData.semesterId,
  });
  assert.equal(percent.percent, 1);
  assert.equal(percent.presentCount, 0);
});
void it("corrects to a no-show with a reason while preserving actual delivery in history", async () => {
  const fixtureData = await appointmentFixture(harness);
  const makeupId = await insertMakeup({
    originEnrollmentId: fixtureData.enrollmentId,
    targetClassSessionId: fixtureData.targetId,
  });
  const caller = harness.caller(undefined, fixtureData.after);
  await caller.attendance.markMakeupOutcome({
    ...actual,
    makeupId,
    coverages: fixtureData.input.coverages,
  });
  await assert.rejects(
    caller.attendance.markMakeupOutcome({
      ...actual,
      makeupId,
      expectedVersion: 1,
      attended: false,
      coverages: [],
    }),
    { code: "BAD_REQUEST", message: /motivo/ },
  );
  await caller.attendance.markMakeupOutcome({
    ...actual,
    makeupId,
    expectedVersion: 1,
    attended: false,
    coverages: [],
    reason: "Registro conferido; o aluno não compareceu.",
  });
  const row = await db.makeup.findUniqueOrThrow({
    where: { id: makeupId },
    include: { appointment: true },
  });
  assert.equal(row.attendedAt, null);
  assert.equal(row.attendedById, null);
  const detail = await caller.appointments.detail({ id: row.appointment!.id });
  assert.equal(detail.snapshot.status, "NO_SHOW");
  assert.equal(detail.history[1]?.snapshot.performedContent, actual.performedContent);
  assert.equal(detail.absences.find((item) => item.id === fixtureData.absence.id)?.available, 120);
});
void it("enforces teacher scope and encounter end while allowing a late first record", async () => {
  const fixtureData = await appointmentFixture(harness);
  const makeupId = await insertMakeup({
    originEnrollmentId: fixtureData.enrollmentId,
    targetClassSessionId: fixtureData.targetId,
  });
  const input = { ...actual, makeupId, coverages: fixtureData.input.coverages };
  await assert.rejects(
    harness.caller(harness.ns.teacher, fixtureData.after).attendance.markMakeupOutcome(input),
    { code: "FORBIDDEN" },
  );
  await assert.rejects(
    harness.caller(harness.ns.otherTeacher, fixtureData.before).attendance.markMakeupOutcome(input),
    { code: "BAD_REQUEST", message: /término/ },
  );
  const late = new Date(fixtureData.after.getTime() + 86400000);
  await harness.caller(harness.ns.otherTeacher, late).attendance.markMakeupOutcome(input);
  const recorded = await db.makeup.findUniqueOrThrow({ where: { id: makeupId } });
  assert.equal(recorded.attendedAt?.toISOString(), late.toISOString());
});
void it("rejects cancelled bookings and cancelled destination classes", async () => {
  const fixtureData = await appointmentFixture(harness);
  const makeupId = await insertMakeup({
    originEnrollmentId: fixtureData.enrollmentId,
    targetClassSessionId: fixtureData.targetId,
  });
  const input = { ...actual, makeupId, coverages: fixtureData.input.coverages };
  await db.classSession.update({
    where: { id: fixtureData.targetId },
    data: {
      status: "CANCELLED",
      cancelledAt: fixtureData.before,
      cancelReason: "Cancelada no cenário",
    },
  });
  await assert.rejects(
    harness.caller(undefined, fixtureData.after).attendance.markMakeupOutcome(input),
    {
      code: "BAD_REQUEST",
      message: /destino foi cancelada/,
    },
  );
  await db.classSession.update({
    where: { id: fixtureData.targetId },
    data: { status: "SCHEDULED", cancelledAt: null, cancelReason: null },
  });
  await db.makeup.update({ where: { id: makeupId }, data: { cancelledAt: fixtureData.before } });
  await assert.rejects(
    harness.caller(undefined, fixtureData.after).attendance.markMakeupOutcome(input),
    {
      code: "BAD_REQUEST",
      message: /atendimento foi cancelado/,
    },
  );
  const unchanged = await db.makeup.findUniqueOrThrow({ where: { id: makeupId } });
  assert.equal(unchanged.attendedAt, null);
});
