import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, beforeEach, it } from "node:test";
import { db } from "@lazuli/db";
import { createHarness, defineNamespace } from "../support/attendance-test-support.js";
import { appointmentFixture } from "../support/appointment-fixtures.js";

const harness = createHarness(
  defineNamespace({
    label: "appointments184",
    startDate: "2091-02-01",
    endDate: "2091-06-30",
    sessionDate: "2091-03-10",
    afterSessionDate: "2091-04-01",
    adminId: "00000000-0000-0000-0000-000000001840",
    teacherId: "00000000-0000-0000-0000-000000001841",
    otherTeacherId: "00000000-0000-0000-0000-000000001842",
  }),
);
async function clean(): Promise<void> {
  const appointment = { student: { fullName: { startsWith: harness.ns.prefix } } };
  await db.appointmentRevision.deleteMany({ where: { appointment } });
  await db.makeupCoverage.deleteMany({ where: { appointment } });
  await db.pedagogicalAppointment.deleteMany({ where: appointment });
  await harness.clean();
}
beforeEach(clean);
after(async () => {
  await clean();
  await db.$disconnect();
});
const actual = {
  attended: true,
  performedContent: "Prática oral e escuta com devolutiva individual.",
  performedMinutes: 45,
  notes: "",
  reason: "",
};
void it("serializes competing reservations and rejects stale records, foreign origins and early completion", async () => {
  const fixture = await appointmentFixture(harness);
  const otherDate = new Date(fixture.before.getTime() + 86400000).toISOString().slice(0, 10);
  const second = {
    ...fixture.input,
    id: randomUUID(),
    meeting: {
      kind: "INDEPENDENT" as const,
      teacherId: harness.ns.otherTeacher.id,
      date: otherDate,
      startTime: "10:00",
      endTime: "12:00",
      format: "IN_PERSON" as const,
    },
  };
  const results = await Promise.allSettled([
    harness.caller(undefined, fixture.before).appointments.schedule(fixture.input),
    harness.caller(undefined, fixture.before).appointments.schedule(second),
  ]);
  assert.equal(results.filter((row) => row.status === "fulfilled").length, 1);
  assert.equal(results.filter((row) => row.status === "rejected").length, 1);
  const coverage = await db.makeupCoverage.findFirstOrThrow({
    where: { attendanceId: fixture.absence.id },
  });
  await assert.rejects(
    harness.caller(undefined, fixture.before).appointments.record({
      ...actual,
      id: coverage.appointmentId,
      expectedVersion: 0,
      coverages: [],
    }),
    { code: "CONFLICT" },
  );
  await assert.rejects(
    harness.caller(undefined, fixture.before).appointments.record({
      ...actual,
      id: coverage.appointmentId,
      expectedVersion: 1,
      coverages: [{ attendanceId: fixture.absence.id, minutes: 45 }],
    }),
    { code: "BAD_REQUEST", message: /término/ },
  );
  const stranger = await harness.enrollStudent({
    classId: fixture.classId,
    stageId: fixture.stageId,
    suffix: "Outra pessoa",
  });
  await assert.rejects(
    harness.caller(undefined, fixture.before).appointments.schedule({
      ...second,
      id: randomUUID(),
      studentId: stranger.studentId,
      enrollmentId: stranger.enrollmentId,
      meeting: { ...second.meeting, startTime: "20:00", endTime: "22:00" },
    }),
    { code: "BAD_REQUEST", message: /não pertence/ },
  );
  assert.equal(
    await db.pedagogicalAppointment.count({ where: { studentId: stranger.studentId } }),
    0,
  );
});
void it("reschedules atomically and keeps cancelled reservations available to the successor", async () => {
  const fixture = await appointmentFixture(harness);
  await harness.caller(undefined, fixture.before).appointments.schedule(fixture.input);
  const replacement = {
    ...fixture.input,
    id: randomUUID(),
    meeting: {
      kind: "INDEPENDENT" as const,
      teacherId: harness.ns.otherTeacher.id,
      date: fixture.before.toISOString().slice(0, 10),
      startTime: "17:00",
      endTime: "19:00",
      format: "IN_PERSON" as const,
    },
  };
  await harness.caller(undefined, fixture.before).appointments.reschedule({
    id: fixture.input.id,
    expectedVersion: 1,
    reason: "Horário solicitado pela família.",
    replacement,
  });
  const before = await harness.caller().appointments.detail({ id: fixture.input.id });
  const next = await harness.caller().appointments.detail({ id: replacement.id });
  assert.equal(before.snapshot.status, "CANCELLED");
  assert.equal(before.rescheduledToId, replacement.id);
  assert.equal(next.snapshot.rescheduledFromId, fixture.input.id);
  assert.equal(next.snapshot.coverages[0]?.minutes, 120);
  assert.equal(before.history[1]?.snapshot.status, "SCHEDULED");
});

void it("counts delivered compensation by minutes in its source enrollment and never counts it again after source correction", async () => {
  const fixture = await appointmentFixture(harness);
  const presentSession = await harness.createSession({
    classId: fixture.classId,
    date: new Date("2091-03-12"),
  });
  await db.classSession.update({
    where: { id: presentSession },
    data: { endTime: new Date("1970-01-01T15:00:00Z") },
  });
  const api = harness.caller(undefined, fixture.after);
  await api.attendance.confirmSession({ sessionId: presentSession, rows: [] });
  await harness.caller(undefined, fixture.before).appointments.schedule(fixture.input);
  const readPercent = (): ReturnType<typeof api.attendance.enrollmentSemesterPercent> =>
    api.attendance.enrollmentSemesterPercent({
      enrollmentId: fixture.enrollmentId,
      semesterId: fixture.semesterId,
    });
  const planned = await readPercent();
  assert.equal(planned.heldMinutes, 180);
  assert.equal(planned.presentMinutes, 60);
  assert.equal(planned.compensatedMinutes, 0);
  assert.equal(planned.percent, 1 / 3);
  await api.appointments.record({
    ...actual,
    id: fixture.input.id,
    expectedVersion: 1,
    coverages: [{ attendanceId: fixture.absence.id, minutes: 45 }],
  });
  const completed = await readPercent();
  assert.deepEqual(
    {
      heldSessions: completed.heldSessions,
      presentCount: completed.presentCount,
      heldMinutes: completed.heldMinutes,
      presentMinutes: completed.presentMinutes,
      compensatedMinutes: completed.compensatedMinutes,
      missingMinutes: completed.missingMinutes,
      percent: completed.percent,
      flagged: completed.flagged,
    },
    {
      heldSessions: 2,
      presentCount: 1,
      heldMinutes: 180,
      presentMinutes: 60,
      compensatedMinutes: 45,
      missingMinutes: 75,
      percent: 105 / 180,
      flagged: true,
    },
  );
  const history = await api.students.attendanceHistory({ id: fixture.studentId, status: "ABSENT" });
  assert.equal(history.totalItems, 1);
  assert.equal(history.rows[0]?.sessionId, fixture.sessionId);
  assert.equal(history.rows[0]?.compensatedMinutes, 45);
  assert.equal(history.attendance.percent, 105 / 180);
  assert.deepEqual(history.counts, { ALL: 2, PRESENT: 1, ABSENT: 1, PENDING: 0, CANCELLED: 0 });
  const source = await db.attendance.findUniqueOrThrow({ where: { id: fixture.absence.id } });
  assert.equal(source.status, "ABSENT");
  const profile = await api.students.pedagogy({ id: fixture.studentId });
  assert.equal(
    profile.enrollments.find((row) => row.id === fixture.enrollmentId)?.attendance.percent,
    105 / 180,
  );
  await api.attendance.editSession({
    sessionId: fixture.sessionId,
    rows: [{ enrollmentId: fixture.enrollmentId, status: "PRESENT" }],
  });
  const corrected = await readPercent();
  assert.equal(corrected.percent, 1);
  assert.equal(corrected.presentMinutes, 180);
  assert.equal(corrected.compensatedMinutes, 0);
  assert.equal(corrected.missingMinutes, 0);
  assert.equal(
    await db.makeupCoverage.count({
      where: { attendanceId: fixture.absence.id, appointmentId: fixture.input.id, deletedAt: null },
    }),
    1,
  );
});
