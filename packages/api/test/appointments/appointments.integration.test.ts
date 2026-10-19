import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, beforeEach, it } from "node:test";
import { db } from "@lazuli/db";
import { weekdayOf } from "@lazuli/domain";
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
beforeEach(() => harness.clean());
after(async () => {
  await harness.clean();
  await db.$disconnect();
});
const actual = {
  attended: true,
  performedContent: "Prática oral e escuta com devolutiva individual.",
  performedMinutes: 45,
  notes: "",
  reason: "",
};

void it("reserves source time without changing frequency, then compensates actual minutes in the original semester", async () => {
  const f = await appointmentFixture(harness);
  const scheduled = await harness.caller(undefined, f.before).appointments.schedule(f.input);
  const percent = () =>
    harness.caller().attendance.enrollmentSemesterPercent({
      enrollmentId: f.enrollmentId,
      semesterId: f.semesterId,
    });
  assert.equal((await percent()).percent, 0);
  await harness.caller(harness.ns.otherTeacher, f.after).appointments.record({
    ...actual,
    id: scheduled.id,
    expectedVersion: 1,
    coverages: [{ attendanceId: f.absence.id, minutes: 45 }],
  });
  const result = await percent();
  assert.equal(result.percent, 45 / 120);
  assert.equal(result.compensatedMinutes, 45);
  assert.equal(result.missingMinutes, 75);
  assert.equal(result.presentCount, 0);
  assert.equal(
    (await db.attendance.findUniqueOrThrow({ where: { id: f.absence.id } })).status,
    "ABSENT",
  );
  assert.equal(
    await db.attendance.count({
      where: { classSessionId: f.targetId, enrollmentId: f.enrollmentId },
    }),
    0,
  );
  assert.equal(await db.stageAssessment.count({ where: { studentId: f.studentId } }), 0);
  const detail = await harness.caller().appointments.detail({ id: scheduled.id });
  assert.deepEqual(
    detail.history.map((row) => row.version),
    [2, 1],
  );
  assert.equal(detail.history[1]?.snapshot.coverages[0]?.minutes, 120);
  assert.equal(detail.history[0]?.author?.id, harness.ns.otherTeacher.id);
});
void it("releases a no-show reservation and preserves prior delivery through justified correction", async () => {
  const f = await appointmentFixture(harness);
  await harness.caller(undefined, f.before).appointments.schedule(f.input);
  await harness.caller(undefined, f.after).appointments.record({
    ...actual,
    id: f.input.id,
    expectedVersion: 1,
    coverages: [{ attendanceId: f.absence.id, minutes: 45 }],
  });
  await assert.rejects(
    harness.caller(undefined, f.after).appointments.record({
      ...actual,
      id: f.input.id,
      expectedVersion: 2,
      attended: false,
      coverages: [],
    }),
    { code: "BAD_REQUEST", message: /motivo/ },
  );
  await harness.caller(undefined, f.after).appointments.record({
    ...actual,
    id: f.input.id,
    expectedVersion: 2,
    attended: false,
    coverages: [],
    reason: "Comparecimento atribuído ao aluno errado; contato confirmou ausência.",
  });
  const detail = await harness.caller().appointments.detail({ id: f.input.id });
  assert.equal(detail.snapshot.status, "NO_SHOW");
  assert.equal(detail.snapshot.coverages.length, 0);
  assert.equal(detail.absences.find((row) => row.id === f.absence.id)?.available, 120);
  assert.equal(detail.history[1]?.snapshot.status, "ATTENDED");
  assert.equal(
    await db.makeupCoverage.count({
      where: { appointmentId: f.input.id, deletedAt: { not: null } },
    }),
    1,
  );
});
void it("serializes competing reservations and rejects stale records, foreign origins and early completion", async () => {
  const f = await appointmentFixture(harness);
  const otherDate = new Date(f.before.getTime() + 86400000).toISOString().slice(0, 10);
  const second = {
    ...f.input,
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
    harness.caller(undefined, f.before).appointments.schedule(f.input),
    harness.caller(undefined, f.before).appointments.schedule(second),
  ]);
  assert.equal(results.filter((row) => row.status === "fulfilled").length, 1);
  assert.equal(results.filter((row) => row.status === "rejected").length, 1);
  const coverage = await db.makeupCoverage.findFirstOrThrow({
    where: { attendanceId: f.absence.id },
  });
  await assert.rejects(
    harness.caller(undefined, f.before).appointments.record({
      ...actual,
      id: coverage.appointmentId,
      expectedVersion: 0,
      coverages: [],
    }),
    { code: "CONFLICT" },
  );
  await assert.rejects(
    harness.caller(undefined, f.before).appointments.record({
      ...actual,
      id: coverage.appointmentId,
      expectedVersion: 1,
      coverages: [{ attendanceId: f.absence.id, minutes: 45 }],
    }),
    { code: "BAD_REQUEST", message: /término/ },
  );
  const stranger = await harness.enrollStudent({
    classId: f.classId,
    stageId: f.stageId,
    suffix: "Outra pessoa",
  });
  await assert.rejects(
    harness.caller(undefined, f.before).appointments.schedule({
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
void it("reconciles source correction without counting both presence and compensation", async () => {
  const f = await appointmentFixture(harness);
  await harness.caller(undefined, f.before).appointments.schedule(f.input);
  await harness.caller(undefined, f.after).appointments.record({
    ...actual,
    id: f.input.id,
    expectedVersion: 1,
    coverages: [{ attendanceId: f.absence.id, minutes: 45 }],
  });
  await harness.caller(undefined, f.after).attendance.editSession({
    sessionId: f.sessionId,
    rows: [{ enrollmentId: f.enrollmentId, status: "PRESENT" }],
  });
  const result = await harness.caller().attendance.enrollmentSemesterPercent({
    enrollmentId: f.enrollmentId,
    semesterId: f.semesterId,
  });
  assert.equal(result.percent, 1);
  assert.equal(result.compensatedMinutes, 0);
  const detail = await harness.caller().appointments.detail({ id: f.input.id });
  assert.equal(detail.snapshot.coverages[0]?.applicable, false);
  assert.equal(detail.history[0]?.snapshot.coverages[0]?.applicable, true);
});
void it("reschedules atomically and keeps cancelled reservations available to the successor", async () => {
  const f = await appointmentFixture(harness);
  await harness.caller(undefined, f.before).appointments.schedule(f.input);
  const replacement = {
    ...f.input,
    id: randomUUID(),
    meeting: {
      kind: "INDEPENDENT" as const,
      teacherId: harness.ns.otherTeacher.id,
      date: f.before.toISOString().slice(0, 10),
      startTime: "17:00",
      endTime: "19:00",
      format: "IN_PERSON" as const,
    },
  };
  await harness.caller(undefined, f.before).appointments.reschedule({
    id: f.input.id,
    expectedVersion: 1,
    reason: "Horário solicitado pela família.",
    replacement,
  });
  const before = await harness.caller().appointments.detail({ id: f.input.id });
  const next = await harness.caller().appointments.detail({ id: replacement.id });
  assert.equal(before.snapshot.status, "CANCELLED");
  assert.equal(before.rescheduledToId, replacement.id);
  assert.equal(next.snapshot.rescheduledFromId, f.input.id);
  assert.equal(next.snapshot.coverages[0]?.minutes, 120);
  assert.equal(before.history[1]?.snapshot.status, "SCHEDULED");
});
void it("scopes teacher access and same-day recording", async () => {
  const f = await appointmentFixture(harness);
  await harness.caller(undefined, f.before).appointments.schedule(f.input);
  await assert.rejects(
    harness.caller(harness.ns.teacher, f.after).appointments.detail({ id: f.input.id }),
    { code: "FORBIDDEN" },
  );
  await assert.rejects(
    harness
      .caller(harness.ns.otherTeacher, new Date(f.after.getTime() + 86400000))
      .appointments.record({
        ...actual,
        id: f.input.id,
        expectedVersion: 1,
        coverages: [{ attendanceId: f.absence.id, minutes: 45 }],
      }),
    { code: "BAD_REQUEST", message: /administração/ },
  );
});

void it("blocks a later class from occupying an independent appointment and frees the slot after cancellation", async () => {
  const f = await appointmentFixture(harness);
  const date = f.before.toISOString().slice(0, 10);
  const before = new Date(`${date}T11:00:00Z`);
  await harness.caller(undefined, before).appointments.schedule({
    ...f.input,
    purpose: "REINFORCEMENT",
    coverages: [],
    meeting: {
      kind: "INDEPENDENT",
      teacherId: harness.ns.otherTeacher.id,
      date,
      startTime: "10:00",
      endTime: "11:00",
      format: "ONLINE",
    },
  });
  const values = {
    teacherId: harness.ns.otherTeacher.id,
    semesterId: f.semesterId,
    scheduleType: "REGULAR" as const,
    format: "ONLINE" as const,
    sharedStageId: f.stageId,
    slots: [{ weekday: weekdayOf(date), startTime: "10:30", endTime: "11:30" }],
  };
  await assert.rejects(harness.caller(undefined, before).classes.create(values), {
    code: "BAD_REQUEST",
    message: /Conflito com atendimento/,
  });
  const week = await harness
    .caller(undefined, before)
    .teachers.week({ id: harness.ns.otherTeacher.id, week: date });
  assert.equal(week.appointments.find((row) => row.id === f.input.id)?.studentId, f.studentId);
  await harness.caller(undefined, before).appointments.cancel({
    id: f.input.id,
    expectedVersion: 1,
    reason: "Família solicitou outro dia.",
  });
  const created = await harness.caller(undefined, before).classes.create(values);
  const stored = await db.class.findUniqueOrThrow({
    where: { id: created.id },
    include: { scheduleSlots: true },
  });
  assert.equal(stored.teacherId, harness.ns.otherTeacher.id);
  assert.equal(stored.scheduleSlots[0]?.startTime.toISOString().slice(11, 16), "10:30");
});

void it("requires a dated PPT enrollment and keeps an assessment appointment independent from grades and frequency", async () => {
  const f = await appointmentFixture(harness);
  await assert.rejects(
    harness
      .caller(undefined, f.before)
      .appointments.schedule({ ...f.input, purpose: "PPT_COMPLEMENT", coverages: [] }),
    { code: "BAD_REQUEST", message: /matrícula PPT vigente/ },
  );
  const scheduled = await harness
    .caller(undefined, f.before)
    .appointments.schedule({ ...f.input, purpose: "ASSESSMENT", coverages: [] });
  await harness
    .caller(undefined, f.after)
    .appointments.record({ ...actual, id: scheduled.id, expectedVersion: 1, coverages: [] });
  const percent = await harness.caller().attendance.enrollmentSemesterPercent({
    enrollmentId: f.enrollmentId,
    semesterId: f.semesterId,
  });
  assert.equal(percent.compensatedMinutes, 0);
  assert.equal(percent.missingMinutes, 120);
  assert.equal(await db.stageAssessment.count({ where: { studentId: f.studentId } }), 0);
  assert.equal(
    (await harness.caller().appointments.detail({ id: scheduled.id })).snapshot.performedContent,
    actual.performedContent,
  );
});

void it("excludes the exit day from the frequency denominator just as the dated roster does", async () => {
  const f = await appointmentFixture(harness);
  await harness
    .caller(undefined, new Date(`${harness.ns.sessionDate.toISOString().slice(0, 10)}T20:00:00Z`))
    .enrollment.close({
      enrollmentId: f.enrollmentId,
      reason: "SUSPENDED",
      effectiveDate: harness.ns.sessionDate,
    });
  const result = await harness.caller().attendance.enrollmentSemesterPercent({
    enrollmentId: f.enrollmentId,
    semesterId: f.semesterId,
  });
  assert.equal(result.heldSessions, 0);
  assert.equal(result.percent, null);
  assert.equal(
    (await harness.caller().appointments.student({ studentId: f.studentId })).absences.length,
    0,
  );
});

for (const state of ["ended", "future", "deleted"] as const) {
  void it(`rejects appointments for an ACTIVE student whose enrollment is ${state}`, async () => {
    const f = await appointmentFixture(harness);
    await db.$transaction(async (tx) => {
      if (state === "ended") {
        await tx.pedagogicalProgress.updateMany({
          where: { enrollmentId: f.enrollmentId },
          data: { endDate: new Date("2091-04-01"), endReason: "DROPPED" },
        });
        await tx.enrollment.update({
          where: { id: f.enrollmentId },
          data: { exitDate: new Date("2091-04-01"), exitReason: "DROPPED" },
        });
      } else if (state === "future") {
        await tx.pedagogicalProgress.updateMany({
          where: { enrollmentId: f.enrollmentId },
          data: { startDate: new Date("2091-04-02") },
        });
        await tx.enrollment.update({
          where: { id: f.enrollmentId },
          data: { entryDate: new Date("2091-04-02") },
        });
      } else
        await tx.enrollment.update({
          where: { id: f.enrollmentId },
          data: { deletedAt: f.before },
        });
    });
    await assert.rejects(harness.caller(undefined, f.before).appointments.schedule(f.input), {
      code: "BAD_REQUEST",
      message: /sem matrícula vigente/,
    });
    assert.equal(await db.pedagogicalAppointment.count({ where: { id: f.input.id } }), 0);
    const options = await harness
      .caller(undefined, f.before)
      .appointments.student({ studentId: f.studentId });
    assert.equal(options.hasCurrentEnrollment, false);
  });
}
