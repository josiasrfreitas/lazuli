import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, beforeEach, it } from "node:test";
import { db } from "@lazuli/db";
import { scheduleHarness as harness } from "../support/makeup-namespaces.js";
import { appointmentFixture } from "../support/appointment-fixtures.js";
beforeEach(() => harness.clean());
after(async () => {
  await harness.clean();
  await db.$disconnect();
});

void it("schedules the compatibility makeup with verified origins, same-day notice and attributed appointment evidence", async () => {
  const fixtureData = await appointmentFixture(harness);
  const result = await harness.caller(undefined, fixtureData.before).attendance.scheduleMakeup({
    originEnrollmentId: fixtureData.enrollmentId,
    targetClassSessionId: fixtureData.targetId,
    coverages: fixtureData.input.coverages,
    plannedContent: "Revisão orientada.",
  });
  const row = await db.makeup.findUniqueOrThrow({
    where: { id: result.makeupId },
    include: { appointment: true },
  });
  assert.equal(row.scheduledById, harness.ns.admin.id);
  assert.equal(row.targetClassSessionId, fixtureData.targetId);
  assert.equal(row.appointment?.studentId, fixtureData.studentId);
  assert.equal(row.appointment?.plannedContent, "Revisão orientada.");
  assert.equal(
    await db.makeupCoverage.count({
      where: { appointmentId: row.appointment.id, attendanceId: fixtureData.absence.id },
    }),
    1,
  );
  await assert.rejects(
    harness.caller(undefined, fixtureData.before).attendance.scheduleMakeup({
      originEnrollmentId: fixtureData.enrollmentId,
      targetClassSessionId: fixtureData.targetId,
      coverages: fixtureData.input.coverages,
    }),
    { code: "BAD_REQUEST", message: /Já existe/ },
  );
});
void it("rejects elapsed or cancelled targets without leaving either kind of booking", async () => {
  const fixtureData = await appointmentFixture(harness);
  const input = {
    originEnrollmentId: fixtureData.enrollmentId,
    targetClassSessionId: fixtureData.targetId,
    coverages: fixtureData.input.coverages,
  };
  await assert.rejects(
    harness.caller(undefined, fixtureData.after).attendance.scheduleMakeup(input),
    {
      code: "BAD_REQUEST",
      message: /ainda não começou/,
    },
  );
  await db.classSession.update({
    where: { id: fixtureData.targetId },
    data: {
      status: "CANCELLED",
      cancelledAt: fixtureData.before,
      cancelReason: "Cancelada no cenário",
    },
  });
  await assert.rejects(
    harness.caller(undefined, fixtureData.before).attendance.scheduleMakeup(input),
    {
      code: "BAD_REQUEST",
      message: /não está disponível/,
    },
  );
  assert.equal(
    await db.makeup.count({ where: { originEnrollmentId: fixtureData.enrollmentId } }),
    0,
  );
  assert.equal(
    await db.pedagogicalAppointment.count({ where: { studentId: fixtureData.studentId } }),
    0,
  );
});
void it("rejects unknown and foreign origins and an overlap with the student's own class", async () => {
  const fixtureData = await appointmentFixture(harness);
  const input = {
    originEnrollmentId: fixtureData.enrollmentId,
    targetClassSessionId: fixtureData.targetId,
    coverages: fixtureData.input.coverages,
  };
  await assert.rejects(
    harness
      .caller(undefined, fixtureData.before)
      .attendance.scheduleMakeup({ ...input, originEnrollmentId: randomUUID() }),
    { code: "NOT_FOUND" },
  );
  await assert.rejects(
    harness
      .caller(undefined, fixtureData.before)
      .attendance.scheduleMakeup({ ...input, targetClassSessionId: randomUUID() }),
    { code: "NOT_FOUND" },
  );
  await assert.rejects(
    harness.caller(undefined, fixtureData.before).attendance.scheduleMakeup({
      ...input,
      coverages: [{ attendanceId: randomUUID(), minutes: 120 }],
    }),
    { code: "BAD_REQUEST", message: /matrícula de origem/ },
  );
  const ownSession = await harness.createSession({
    classId: fixtureData.classId,
    date: harness.ns.afterSessionDate,
  });
  await assert.rejects(
    harness.caller(undefined, fixtureData.before).attendance.scheduleMakeup({
      ...input,
      targetClassSessionId: ownSession,
      reason: "Aula extra",
    }),
    { code: "BAD_REQUEST", message: /aluno já tem aula/ },
  );
  assert.equal(
    await db.makeup.count({ where: { originEnrollmentId: fixtureData.enrollmentId } }),
    0,
  );
});
void it("keeps scheduling administrative", async () => {
  const fixtureData = await appointmentFixture(harness);
  await assert.rejects(
    harness.caller(harness.ns.teacher, fixtureData.before).attendance.scheduleMakeup({
      originEnrollmentId: fixtureData.enrollmentId,
      targetClassSessionId: fixtureData.targetId,
      coverages: fixtureData.input.coverages,
    }),
    { code: "FORBIDDEN" },
  );
  assert.equal(
    await db.makeup.count({ where: { originEnrollmentId: fixtureData.enrollmentId } }),
    0,
  );
});
