import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, beforeEach, it } from "node:test";
import { db } from "@lazuli/db";
import { cancelHarness as harness } from "../support/makeup-namespaces.js";
import { appointmentFixture } from "../support/appointment-fixtures.js";
import { insertMakeup } from "../support/makeup-test-support.js";
beforeEach(() => harness.clean());
after(async () => {
  await harness.clean();
  await db.$disconnect();
});

void it("preserves a legacy import and stamps cancellation with the versioned appointment", async () => {
  const f = await appointmentFixture(harness);
  const makeupId = await insertMakeup({
    originEnrollmentId: f.enrollmentId,
    targetClassSessionId: f.targetId,
    scheduledById: harness.ns.admin.id,
  });
  await harness.caller(undefined, f.before).attendance.cancelMakeup({
    makeupId,
    expectedVersion: 0,
    reason: "Família cancelou o horário.",
  });
  const row = await db.makeup.findUniqueOrThrow({
    where: { id: makeupId },
    include: { appointment: true },
  });
  assert.equal(row.cancelledAt?.toISOString(), f.before.toISOString());
  assert.equal(row.cancelledById, harness.ns.admin.id);
  assert.equal(row.cancellationReason, "Família cancelou o horário.");
  const detail = await harness.caller().appointments.detail({ id: row.appointment!.id });
  assert.deepEqual(
    detail.history.map((item) => item.kind),
    ["CANCELLED", "IMPORTED"],
  );
  assert.equal(detail.history[1]?.snapshot.status, "SCHEDULED");
  await assert.rejects(
    harness
      .caller(undefined, f.before)
      .attendance.cancelMakeup({ makeupId, expectedVersion: 0, reason: "Repetição" }),
    { code: "CONFLICT" },
  );
  await assert.rejects(
    harness
      .caller(undefined, f.before)
      .attendance.cancelMakeup({ makeupId, expectedVersion: 1, reason: "Repetição" }),
    { code: "BAD_REQUEST", message: /pendentes/ },
  );
});
void it("does not cancel completed work and preserves the legacy attendance evidence", async () => {
  const f = await appointmentFixture(harness);
  const makeupId = await insertMakeup({
    originEnrollmentId: f.enrollmentId,
    targetClassSessionId: f.targetId,
    attendedAt: f.after,
    attendedById: harness.ns.otherTeacher.id,
  });
  await assert.rejects(
    harness
      .caller(undefined, f.after)
      .attendance.cancelMakeup({ makeupId, expectedVersion: 0, reason: "Remover" }),
    { code: "BAD_REQUEST", message: /correção/ },
  );
  const row = await db.makeup.findUniqueOrThrow({ where: { id: makeupId } });
  assert.equal(row.attendedAt?.toISOString(), f.after.toISOString());
  assert.equal(row.cancelledAt, null);
});
void it("rejects unknown records and denies teachers the cancellation operation", async () => {
  const f = await appointmentFixture(harness);
  await assert.rejects(
    harness
      .caller()
      .attendance.cancelMakeup({ makeupId: randomUUID(), expectedVersion: 0, reason: "Cancelar" }),
    { code: "NOT_FOUND" },
  );
  const makeupId = await insertMakeup({
    originEnrollmentId: f.enrollmentId,
    targetClassSessionId: f.targetId,
  });
  await assert.rejects(
    harness
      .caller(harness.ns.teacher)
      .attendance.cancelMakeup({ makeupId, expectedVersion: 0, reason: "Cancelar" }),
    { code: "FORBIDDEN" },
  );
  assert.equal((await db.makeup.findUniqueOrThrow({ where: { id: makeupId } })).cancelledAt, null);
});
