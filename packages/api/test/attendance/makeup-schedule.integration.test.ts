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
  const f = await appointmentFixture(harness);
  const result = await harness.caller(undefined, f.before).attendance.scheduleMakeup({
    originEnrollmentId: f.enrollmentId,
    targetClassSessionId: f.targetId,
    coverages: f.input.coverages,
    plannedContent: "Revisão orientada.",
  });
  const row = await db.makeup.findUniqueOrThrow({
    where: { id: result.makeupId },
    include: { appointment: true },
  });
  assert.equal(row.scheduledById, harness.ns.admin.id);
  assert.equal(row.targetClassSessionId, f.targetId);
  assert.equal(row.appointment?.studentId, f.studentId);
  assert.equal(row.appointment?.plannedContent, "Revisão orientada.");
  assert.equal(
    await db.makeupCoverage.count({
      where: { appointmentId: row.appointment!.id, attendanceId: f.absence.id },
    }),
    1,
  );
  await assert.rejects(
    harness.caller(undefined, f.before).attendance.scheduleMakeup({
      originEnrollmentId: f.enrollmentId,
      targetClassSessionId: f.targetId,
      coverages: f.input.coverages,
    }),
    { code: "BAD_REQUEST", message: /Já existe/ },
  );
});
void it("rejects elapsed or cancelled targets without leaving either kind of booking", async () => {
  const f = await appointmentFixture(harness);
  const input = {
    originEnrollmentId: f.enrollmentId,
    targetClassSessionId: f.targetId,
    coverages: f.input.coverages,
  };
  await assert.rejects(harness.caller(undefined, f.after).attendance.scheduleMakeup(input), {
    code: "BAD_REQUEST",
    message: /ainda não começou/,
  });
  await db.classSession.update({
    where: { id: f.targetId },
    data: { status: "CANCELLED", cancelledAt: f.before, cancelReason: "Cancelada no cenário" },
  });
  await assert.rejects(harness.caller(undefined, f.before).attendance.scheduleMakeup(input), {
    code: "BAD_REQUEST",
    message: /não está disponível/,
  });
  assert.equal(await db.makeup.count({ where: { originEnrollmentId: f.enrollmentId } }), 0);
  assert.equal(await db.pedagogicalAppointment.count({ where: { studentId: f.studentId } }), 0);
});
void it("rejects unknown and foreign origins and an overlap with the student's own class", async () => {
  const f = await appointmentFixture(harness);
  const input = {
    originEnrollmentId: f.enrollmentId,
    targetClassSessionId: f.targetId,
    coverages: f.input.coverages,
  };
  await assert.rejects(
    harness
      .caller(undefined, f.before)
      .attendance.scheduleMakeup({ ...input, originEnrollmentId: randomUUID() }),
    { code: "NOT_FOUND" },
  );
  await assert.rejects(
    harness
      .caller(undefined, f.before)
      .attendance.scheduleMakeup({ ...input, targetClassSessionId: randomUUID() }),
    { code: "NOT_FOUND" },
  );
  await assert.rejects(
    harness.caller(undefined, f.before).attendance.scheduleMakeup({
      ...input,
      coverages: [{ attendanceId: randomUUID(), minutes: 120 }],
    }),
    { code: "BAD_REQUEST", message: /matrícula de origem/ },
  );
  const ownSession = await harness.createSession({
    classId: f.classId,
    date: harness.ns.afterSessionDate,
  });
  await assert.rejects(
    harness.caller(undefined, f.before).attendance.scheduleMakeup({
      ...input,
      targetClassSessionId: ownSession,
      reason: "Aula extra",
    }),
    { code: "BAD_REQUEST", message: /aluno já tem aula/ },
  );
  assert.equal(await db.makeup.count({ where: { originEnrollmentId: f.enrollmentId } }), 0);
});
void it("keeps scheduling administrative", async () => {
  const f = await appointmentFixture(harness);
  await assert.rejects(
    harness.caller(harness.ns.teacher, f.before).attendance.scheduleMakeup({
      originEnrollmentId: f.enrollmentId,
      targetClassSessionId: f.targetId,
      coverages: f.input.coverages,
    }),
    { code: "FORBIDDEN" },
  );
  assert.equal(await db.makeup.count({ where: { originEnrollmentId: f.enrollmentId } }), 0);
});
