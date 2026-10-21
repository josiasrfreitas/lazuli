import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, beforeEach, it } from "node:test";
import { db } from "@lazuli/db";
import { createHarness, defineNamespace } from "../support/attendance-test-support.js";
import { appointmentFixture } from "../support/appointment-fixtures.js";

const harness = createHarness(
  defineNamespace({
    label: "departure207",
    startDate: "2091-02-01",
    endDate: "2091-06-30",
    sessionDate: "2091-03-10",
    afterSessionDate: "2091-04-01",
    adminId: "00000000-0000-0000-0000-000000207580",
    teacherId: "00000000-0000-0000-0000-000000207581",
    otherTeacherId: "00000000-0000-0000-0000-000000207582",
  }),
);
async function clean(): Promise<void> {
  await db.teacherProfile.deleteMany({
    where: { userId: { in: [harness.ns.teacher.id, harness.ns.otherTeacher.id] } },
  });
  await harness.clean();
}
beforeEach(clean);
after(async () => {
  await clean();
  await db.$disconnect();
});

void it("includes independent appointments in departure impact and coverage without cancelling them", async () => {
  const fixtureData = await appointmentFixture(harness);
  const caller = harness.caller(undefined, fixtureData.before);
  const departure = { id: harness.ns.otherTeacher.id, effectiveDate: "2091-04-02" };
  const stalePreview = await caller.teachers.previewDeparture(departure);
  const meeting = {
    kind: "INDEPENDENT" as const,
    teacherId: departure.id,
    date: "2091-04-03",
    startTime: "17:00",
    endTime: "18:00",
    format: "IN_PERSON" as const,
  };
  await caller.appointments.schedule({
    ...fixtureData.input,
    meeting,
    coverages: [{ attendanceId: fixtureData.absence.id, minutes: 60 }],
  });
  await assert.rejects(
    caller.teachers.depart({ ...departure, token: stalePreview.token }),
    /A prévia mudou/u,
  );
  const preview = await caller.teachers.previewDeparture(departure);
  assert.deepEqual(
    preview.appointments.map((row) => row.id),
    [fixtureData.input.id],
  );
  assert.equal(preview.appointments[0]?.date, "2091-04-03");
  const original = await caller.appointments.detail({ id: fixtureData.input.id });
  await caller.teachers.depart({ ...departure, token: preview.token });
  const afterDeparture = await caller.appointments.detail({ id: fixtureData.input.id });
  assert.deepEqual(afterDeparture.snapshot, original.snapshot);
  assert.deepEqual(afterDeparture.history, original.history);
  const pending = await caller.teachers.uncovered({ page: 1, pageSize: 25 });
  assert.equal(pending.rows.find((row) => row.id === fixtureData.input.id)?.kind, "APPOINTMENT");
  const replacementId = randomUUID();
  await caller.appointments.reschedule({
    id: fixtureData.input.id,
    expectedVersion: 1,
    reason: "Recompor cobertura após saída docente.",
    replacement: {
      ...fixtureData.input,
      id: replacementId,
      meeting: { ...meeting, teacherId: harness.ns.teacher.id },
      coverages: [{ attendanceId: fixtureData.absence.id, minutes: 60 }],
    },
  });
  const resolved = await caller.teachers.uncovered({ page: 1, pageSize: 25 });
  assert.equal(
    resolved.rows.filter((row) => row.id === fixtureData.input.id || row.id === replacementId)
      .length,
    0,
  );
  const successor = await caller.appointments.detail({ id: replacementId });
  assert.equal(successor.snapshot.rescheduledFromId, fixtureData.input.id);
  assert.equal(successor.snapshot.teacher?.id, harness.ns.teacher.id);
});
