import assert from "node:assert/strict";
import { it } from "node:test";
import { createCaller } from "@lazuli/api";
import { db } from "@lazuli/db";
import { gre31AdvanceEnrollment as fixtures } from "../support/enrollment.js";

fixtures.registerDbLifecycle();

void it("counts current classes and students per stage, including a mixed-stage PPT class", async () => {
  await fixtures.ensureTeacherUser();
  const { firstStageId, secondStageId, semesterId } = await fixtures.seedTwoStageCatalog();
  const schoolDay = new Date("2072-04-20T15:00:00Z");
  const admin = createCaller({ db, staffUser: fixtures.ADMIN, now: schoolDay });
  const regular = { semesterId, sharedStageId: firstStageId };
  await fixtures.createRegularClass({ ...regular, code: "Empty" });
  const upcoming = await fixtures.createRegularClass({ ...regular, code: "Upcoming" });
  const startsOn = new Date("2072-04-22");
  await db.class.update({ where: { id: upcoming.id }, data: { startDate: startsOn } });
  const regularStudent = await fixtures.createStudent("Regular student");
  await admin.enrollment.create({
    studentId: regularStudent.id,
    classId: upcoming.id,
    entryDate: startsOn,
  });
  const archived = await fixtures.createRegularClass({ ...regular, code: "Archived" });
  await db.class.update({ where: { id: archived.id }, data: { status: "ARCHIVED" } });
  const removed = await fixtures.createRegularClass({ ...regular, code: "Removed" });
  await db.class.update({ where: { id: removed.id }, data: { deletedAt: schoolDay } });

  const ppt = await fixtures.createPersonalizedClass("Mixed", semesterId);
  for (const suffix of ["First", "Second"]) {
    const student = await fixtures.createStudent(suffix);
    await admin.enrollment.create({
      studentId: student.id,
      classId: ppt.id,
      stageId: firstStageId,
    });
  }
  const leaving = await fixtures.createStudent("Leaving");
  const { enrollment } = await admin.enrollment.create({
    studentId: leaving.id,
    classId: ppt.id,
    stageId: secondStageId,
  });
  await admin.enrollment.close({
    enrollmentId: enrollment.id,
    reason: "SUSPENDED",
    effectiveDate: new Date("2072-04-21"),
  });
  const arriving = await fixtures.createStudent("Arriving");
  await admin.enrollment.create({
    studentId: arriving.id,
    classId: ppt.id,
    stageId: secondStageId,
    entryDate: new Date("2072-04-22"),
  });

  async function countsAt(instant: string): Promise<number[][]> {
    const caller = createCaller({ db, staffUser: fixtures.ADMIN, now: new Date(instant) });
    const directory = await caller.teachingPrograms.directory();
    return directory.tracks
      .flatMap((track) => track.stages)
      .filter((stage) => stage.id === firstStageId || stage.id === secondStageId)
      .map(({ classCount, studentCount }) => [classCount, studentCount]);
  }

  // The first instant still falls on April 20 in São Paulo.
  assert.deepEqual(await countsAt("2072-04-21T02:30:00Z"), [
    [2, 2],
    [1, 1],
  ]);
  assert.deepEqual(await countsAt("2072-04-21T15:00:00Z"), [
    [2, 2],
    [0, 0],
  ]);
  assert.deepEqual(await countsAt("2072-04-22T15:00:00Z"), [
    [3, 3],
    [1, 1],
  ]);
  assert.deepEqual(await countsAt("2072-07-01T15:00:00Z"), [
    [0, 0],
    [0, 0],
  ]);
});
