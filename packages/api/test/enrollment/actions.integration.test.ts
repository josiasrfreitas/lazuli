import assert from "node:assert/strict";
import { after, before, beforeEach, it } from "node:test";

import { createCaller } from "@lazuli/api";
import { db } from "@lazuli/db";

import { gre30Enrollment } from "../support/enrollment.js";

const {
  ADMIN,
  cleanDatabase,
  createPersonalizedClass,
  createStudent,
  ensureTeacherUser,
  seedCatalog,
} = gre30Enrollment;

function callerAt(day: string): ReturnType<typeof createCaller> {
  return createCaller({ db, staffUser: ADMIN, now: new Date(`${day}T15:00:00Z`) });
}

void before(async () => {
  await db.$connect();
});
void beforeEach(async () => {
  await cleanDatabase();
  await ensureTeacherUser();
});
void after(async () => {
  await cleanDatabase();
  await db.$disconnect();
});

void it("keeps a future entry out of current occupancy and records cancellation with its author", async () => {
  const catalog = await seedCatalog();
  const classRow = await createPersonalizedClass({
    code: "future-entry",
    semesterId: catalog.semesterId,
    capacity: 1,
  });
  const student = await createStudent({ suffix: "Future Entry" });
  const created = await callerAt("2026-09-10").enrollment.create({
    studentId: student.id,
    classId: classRow.id,
    stageId: catalog.activeStageId,
    entryDate: new Date("2026-09-20"),
  });
  const before = await callerAt("2026-09-10").classes.byId({ id: classRow.id });
  const action = await db.enrollmentAction.findFirstOrThrow({
    where: { enrollmentId: created.enrollment.id },
  });

  assert.equal(before.occupancy, 0);
  assert.equal(before.scheduledEntries, 1);
  await assert.rejects(
    callerAt("2026-09-10").enrollment.advanceStage({ enrollmentId: created.enrollment.id }),
    { code: "BAD_REQUEST" },
  );
  const studentBefore = await callerAt("2026-09-10").students.list({ search: "Future Entry" });
  assert.equal(studentBefore.rows.find((row) => row.id === student.id)?.enrollment, null);
  const studentAfter = await callerAt("2026-09-20").students.list({ search: "Future Entry" });
  const storedClass = await db.class.findUniqueOrThrow({ where: { id: classRow.id } });
  assert.equal(
    studentAfter.rows.find((row) => row.id === student.id)?.enrollment?.classCode,
    storedClass.internalCode,
  );
  assert.equal(action.status, "SCHEDULED");
  await callerAt("2026-09-11").enrollment.cancelScheduled({ actionId: action.id });
  const cancelled = await db.enrollmentAction.findUniqueOrThrow({ where: { id: action.id } });
  assert.equal(cancelled.status, "CANCELLED");
  assert.equal(cancelled.cancelledById, ADMIN.id);
  assert.equal(await db.enrollment.count({ where: { id: created.enrollment.id } }), 0);
});

void it("programs a pause without closing progress early and returns with fresh placement", async () => {
  const catalog = await seedCatalog();
  const sourceClass = await createPersonalizedClass({
    code: "pause-source",
    semesterId: catalog.semesterId,
  });
  const targetClass = await createPersonalizedClass({
    code: "pause-target",
    semesterId: catalog.semesterId,
  });
  const student = await createStudent({ suffix: "Pause Return" });
  const created = await callerAt("2026-09-10").enrollment.create({
    studentId: student.id,
    classId: sourceClass.id,
    stageId: catalog.activeStageId,
  });
  await callerAt("2026-09-10").enrollment.close({
    enrollmentId: created.enrollment.id,
    reason: "SUSPENDED",
    effectiveDate: new Date("2026-09-20"),
  });

  const enrollmentBeforePause = await db.enrollment.findUniqueOrThrow({
    where: { id: created.enrollment.id },
  });
  assert.equal(enrollmentBeforePause.exitDate, null);
  assert.equal(
    await db.pedagogicalProgress.count({
      where: { enrollmentId: created.enrollment.id, endDate: null },
    }),
    1,
  );
  const scheduled = await db.enrollmentAction.findFirstOrThrow({
    where: { enrollmentId: created.enrollment.id, kind: "PAUSE" },
  });
  assert.equal(scheduled.status, "SCHEDULED");
  await callerAt("2026-09-11").enrollment.cancelScheduled({ actionId: scheduled.id });
  await callerAt("2026-09-12").enrollment.close({
    enrollmentId: created.enrollment.id,
    reason: "SUSPENDED",
  });
  const returned = await callerAt("2026-09-13").enrollment.return({
    sourceEnrollmentId: created.enrollment.id,
    targetClassId: targetClass.id,
    stageId: catalog.activeStageId,
  });

  assert.equal(returned.progress.stageId, catalog.activeStageId);
  assert.equal(
    await db.pedagogicalProgress.count({
      where: { enrollmentId: created.enrollment.id, endReason: "SUSPENDED" },
    }),
    1,
  );
  assert.equal(
    await db.enrollmentAction.count({
      where: {
        enrollmentId: returned.enrollment.id,
        sourceEnrollmentId: created.enrollment.id,
        kind: "RETURN",
      },
    }),
    1,
  );
  await assert.rejects(
    callerAt("2026-09-13").enrollment.return({
      sourceEnrollmentId: created.enrollment.id,
      targetClassId: sourceClass.id,
      stageId: catalog.activeStageId,
    }),
    { code: "BAD_REQUEST" },
  );
});

void it("records only one scheduled close when two requests race", async () => {
  const catalog = await seedCatalog();
  const classRow = await createPersonalizedClass({
    code: "concurrent-close",
    semesterId: catalog.semesterId,
  });
  const student = await createStudent({ suffix: "Concurrent Close" });
  const created = await callerAt("2026-09-10").enrollment.create({
    studentId: student.id,
    classId: classRow.id,
    stageId: catalog.activeStageId,
  });
  const close = (): ReturnType<ReturnType<typeof callerAt>["enrollment"]["close"]> =>
    callerAt("2026-09-10").enrollment.close({
      enrollmentId: created.enrollment.id,
      reason: "SUSPENDED",
      effectiveDate: new Date("2026-09-20"),
    });
  const outcomes = await Promise.allSettled([close(), close()]);

  assert.equal(outcomes.filter((outcome) => outcome.status === "fulfilled").length, 1);
  assert.equal(
    await db.enrollmentAction.count({
      where: { enrollmentId: created.enrollment.id, kind: "PAUSE", status: "SCHEDULED" },
    }),
    1,
  );
});

void it("schedules a new class in the same track after a future pause", async () => {
  const catalog = await seedCatalog();
  const sourceClass = await createPersonalizedClass({
    code: "future-source",
    semesterId: catalog.semesterId,
  });
  const targetClass = await createPersonalizedClass({
    code: "future-target",
    semesterId: catalog.semesterId,
  });
  const student = await createStudent({ suffix: "Future Same Track" });
  const source = await callerAt("2026-09-10").enrollment.create({
    studentId: student.id,
    classId: sourceClass.id,
    stageId: catalog.activeStageId,
  });
  await callerAt("2026-09-10").enrollment.close({
    enrollmentId: source.enrollment.id,
    reason: "SUSPENDED",
    effectiveDate: new Date("2026-09-15"),
  });

  const target = await callerAt("2026-09-10").enrollment.create({
    studentId: student.id,
    classId: targetClass.id,
    stageId: catalog.activeStageId,
    entryDate: new Date("2026-09-20"),
  });

  assert.equal(target.enrollment.entryDate.toISOString().slice(0, 10), "2026-09-20");
  const targetBeforeEntry = await callerAt("2026-09-10").classes.byId({ id: targetClass.id });
  assert.equal(targetBeforeEntry.occupancy, 0);
  const scheduledPause = await db.enrollmentAction.findFirstOrThrow({
    where: { enrollmentId: source.enrollment.id, kind: "PAUSE" },
  });
  await assert.rejects(
    callerAt("2026-09-11").enrollment.cancelScheduled({ actionId: scheduledPause.id }),
  );
  const pauseAfterAttempt = await db.enrollmentAction.findUniqueOrThrow({
    where: { id: scheduledPause.id },
  });
  assert.equal(pauseAfterAttempt.status, "SCHEDULED");
});

void it("keeps a pause before its linked return when correcting either action", async () => {
  const catalog = await seedCatalog();
  const sourceClass = await createPersonalizedClass({
    code: "return-order-source",
    semesterId: catalog.semesterId,
  });
  const targetClass = await createPersonalizedClass({
    code: "return-order-target",
    semesterId: catalog.semesterId,
  });
  const student = await createStudent({ suffix: "Return Order" });
  const source = await callerAt("2026-09-01").enrollment.create({
    studentId: student.id,
    classId: sourceClass.id,
    stageId: catalog.activeStageId,
  });
  await callerAt("2026-09-10").enrollment.close({
    enrollmentId: source.enrollment.id,
    reason: "SUSPENDED",
  });
  const returned = await callerAt("2026-09-20").enrollment.return({
    sourceEnrollmentId: source.enrollment.id,
    targetClassId: targetClass.id,
    stageId: catalog.activeStageId,
  });
  const pauseAction = await db.enrollmentAction.findFirstOrThrow({
    where: { enrollmentId: source.enrollment.id, kind: "PAUSE" },
  });
  const returnAction = await db.enrollmentAction.findFirstOrThrow({
    where: { enrollmentId: returned.enrollment.id, kind: "RETURN" },
  });

  await assert.rejects(
    callerAt("2026-10-07").enrollment.previewCorrection({
      actionId: returnAction.id,
      effectiveDate: new Date("2026-09-05"),
    }),
    { code: "BAD_REQUEST" },
  );
  await assert.rejects(
    callerAt("2026-10-07").enrollment.previewCorrection({
      actionId: pauseAction.id,
      effectiveDate: new Date("2026-09-25"),
    }),
    { code: "BAD_REQUEST" },
  );

  const returnPreview = await callerAt("2026-10-07").enrollment.previewCorrection({
    actionId: returnAction.id,
    effectiveDate: new Date("2026-09-15"),
  });
  const pausePreview = await callerAt("2026-10-07").enrollment.previewCorrection({
    actionId: pauseAction.id,
    effectiveDate: new Date("2026-09-18"),
  });
  await callerAt("2026-10-07").enrollment.applyCorrection({
    actionId: pauseAction.id,
    effectiveDate: new Date("2026-09-18"),
    expectedVersion: pausePreview.version,
    justification: "Pausa registrada antes da data real.",
  });
  await assert.rejects(
    callerAt("2026-10-07").enrollment.applyCorrection({
      actionId: returnAction.id,
      effectiveDate: new Date("2026-09-15"),
      expectedVersion: returnPreview.version,
      justification: "Prévia anterior à mudança da pausa.",
    }),
    { code: "BAD_REQUEST" },
  );
});

void it("previews and saves a past correction while preserving attendance records", async () => {
  const catalog = await seedCatalog();
  const classRow = await createPersonalizedClass({
    code: "correction",
    semesterId: catalog.semesterId,
  });
  const student = await createStudent({ suffix: "Correction" });
  const created = await callerAt("2026-09-01").enrollment.create({
    studentId: student.id,
    classId: classRow.id,
    stageId: catalog.activeStageId,
  });
  await callerAt("2026-09-10").enrollment.close({
    enrollmentId: created.enrollment.id,
    reason: "SUSPENDED",
  });
  const session = await db.classSession.create({
    data: {
      classId: classRow.id,
      date: new Date("2026-09-07"),
      startTime: new Date("1970-01-01T14:00:00Z"),
      endTime: new Date("1970-01-01T15:00:00Z"),
    },
  });
  const attendance = await db.attendance.create({
    data: { enrollmentId: created.enrollment.id, classSessionId: session.id, status: "PRESENT" },
  });
  const firstAffectedSession = await db.classSession.create({
    data: {
      classId: classRow.id,
      date: new Date("2026-09-05"),
      startTime: new Date("1970-01-01T14:00:00Z"),
      endTime: new Date("1970-01-01T15:00:00Z"),
    },
  });
  const firstAffectedAttendance = await db.attendance.create({
    data: {
      enrollmentId: created.enrollment.id,
      classSessionId: firstAffectedSession.id,
      status: "PRESENT",
    },
  });
  const oldExitSession = await db.classSession.create({
    data: {
      classId: classRow.id,
      date: new Date("2026-09-10"),
      startTime: new Date("1970-01-01T14:00:00Z"),
      endTime: new Date("1970-01-01T15:00:00Z"),
    },
  });
  const pause = await db.enrollmentAction.findFirstOrThrow({
    where: { enrollmentId: created.enrollment.id, kind: "PAUSE" },
  });
  const preview = await callerAt("2026-10-07").enrollment.previewCorrection({
    actionId: pause.id,
    effectiveDate: new Date("2026-09-05"),
  });
  assert.deepEqual(
    preview.classSessions.map((row) => row.id),
    [firstAffectedSession.id, session.id],
  );
  assert.deepEqual(
    new Set(preview.attendance.map((row) => row.id)),
    new Set([attendance.id, firstAffectedAttendance.id]),
  );
  assert.equal(
    preview.classSessions.some((row) => row.id === oldExitSession.id),
    false,
  );
  await db.attendance.update({ where: { id: attendance.id }, data: { status: "ABSENT" } });
  await assert.rejects(
    callerAt("2026-10-07").enrollment.applyCorrection({
      actionId: pause.id,
      effectiveDate: new Date("2026-09-05"),
      expectedVersion: preview.version,
      justification: "Prévia antiga.",
    }),
    { code: "BAD_REQUEST" },
  );
  const enrollmentAfterRejected = await db.enrollment.findUniqueOrThrow({
    where: { id: created.enrollment.id },
  });
  assert.equal(enrollmentAfterRejected.exitDate?.toISOString().slice(0, 10), "2026-09-10");
  const freshPreview = await callerAt("2026-10-07").enrollment.previewCorrection({
    actionId: pause.id,
    effectiveDate: new Date("2026-09-05"),
  });
  const applied = await callerAt("2026-10-07").enrollment.applyCorrection({
    actionId: pause.id,
    effectiveDate: new Date("2026-09-05"),
    expectedVersion: freshPreview.version,
    justification: "Data informada incorretamente.",
  });
  const enrollment = await db.enrollment.findUniqueOrThrow({
    where: { id: created.enrollment.id },
  });
  const correction = await db.enrollmentAction.findUniqueOrThrow({ where: { id: applied.id } });

  assert.equal(enrollment.exitDate?.toISOString().slice(0, 10), "2026-09-05");
  assert.equal(correction.previousDate?.toISOString().slice(0, 10), "2026-09-10");
  assert.equal(correction.correctionOfId, pause.id);
  assert.equal(correction.recordedById, ADMIN.id);
  const preservedAttendance = await db.attendance.findUniqueOrThrow({
    where: { id: attendance.id },
  });
  assert.equal(preservedAttendance.status, "ABSENT");
});
