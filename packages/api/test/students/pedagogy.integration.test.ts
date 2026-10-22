import assert from "node:assert/strict";
import { it } from "node:test";
import { db } from "@lazuli/db";
import {
  caller,
  cleanStudentsListFixture,
  seedStudentsListFixture,
  fullNameOf,
  PREFIX,
  CLASS_A_CODE,
  TEACHER_A_NAME,
  TEACHER_B_NAME,
} from "../support/students-list-test-support.js";

void it("reads the student's real learning context and classifies membership at São Paulo date boundaries", async () => {
  await cleanStudentsListFixture();
  try {
    await seedStudentsListFixture();
    const student = await db.student.findFirstOrThrow({
      where: { fullName: fullNameOf("Ana Attend") },
    });
    const result = await caller().students.pedagogy({ id: student.id });
    assert.equal(result.today, "2044-04-15");
    assert.equal(result.enrollments.length, 1);
    const enrollment = result.enrollments[0];
    assert.ok(enrollment);
    assert.equal(enrollment.current, true);
    assert.equal(enrollment.class.name, `${CLASS_A_CODE} portal`);
    assert.equal(enrollment.class.teacher?.name, TEACHER_A_NAME);
    assert.deepEqual(
      enrollment.class.schedule
        .map(({ weekday, startTime, endTime }) => ({ weekday, startTime, endTime }))
        .toSorted((left, right) => left.weekday.localeCompare(right.weekday)),
      [
        { weekday: "MONDAY", startTime: "19:00", endTime: "20:30" },
        { weekday: "WEDNESDAY", startTime: "19:00", endTime: "20:30" },
      ],
    );
    assert.equal(enrollment.progress[0]?.stage, `${PREFIX}Stage`);
    assert.equal(enrollment.progress[0]?.track, `${PREFIX}Track`);
    // Four confirmed sessions, three presences: the listing and profile share the same rule.
    assert.deepEqual(enrollment.attendance, {
      heldSessions: 4,
      presentCount: 3,
      heldMinutes: 360,
      presentMinutes: 270,
      compensatedMinutes: 0,
      missingMinutes: 90,
      percent: 0.75,
      flagged: false,
    });

    const beforeEntry = await caller(new Date("2044-02-01T02:59:59Z")).students.pedagogy({
      id: student.id,
    });
    assert.equal(beforeEntry.today, "2044-01-31");
    assert.deepEqual(
      beforeEntry.enrollments.map((row) => row.current),
      [false],
    );
    const entryDay = await caller(new Date("2044-02-01T03:00:00Z")).students.pedagogy({
      id: student.id,
    });
    assert.equal(entryDay.today, "2044-02-01");
    assert.deepEqual(
      entryDay.enrollments.map((row) => row.current),
      [true],
    );

    await db.$transaction(async (transaction) => {
      await transaction.pedagogicalProgress.updateMany({
        where: { enrollmentId: enrollment.id },
        data: { endDate: new Date("2044-04-15"), endReason: "DROPPED" },
      });
      await transaction.enrollment.update({
        where: { id: enrollment.id },
        data: { exitDate: new Date("2044-04-15"), exitReason: "DROPPED" },
      });
    });
    const beforeExit = await caller(new Date("2044-04-15T02:59:59Z")).students.pedagogy({
      id: student.id,
    });
    assert.deepEqual(
      beforeExit.enrollments.map((row) => row.current),
      [true],
    );
    const exitDay = await caller(new Date("2044-04-15T03:00:00Z")).students.pedagogy({
      id: student.id,
    });
    assert.equal(exitDay.enrollments[0]?.current, false);
    assert.equal(exitDay.enrollments[0]?.exitReason, "DROPPED");
    assert.equal(exitDay.enrollments[0]?.progress[0]?.endDate, "2044-04-15");

    await db.class.update({ where: { id: enrollment.class.id }, data: { deletedAt: new Date() } });
    const removed = await caller().students.pedagogy({ id: student.id });
    assert.deepEqual(removed.enrollments, []);
    const empty = await db.student.findFirstOrThrow({
      where: { fullName: fullNameOf("Davi NoClass") },
    });
    const unenrolled = await caller().students.pedagogy({ id: empty.id });
    assert.deepEqual(unenrolled.enrollments, []);
  } finally {
    await db.class.updateMany({
      where: { internalCode: { startsWith: PREFIX } },
      data: { deletedAt: null },
    });
    await cleanStudentsListFixture();
    await db.$disconnect();
  }
});

void it("preserves membership while hiding the removed effective teacher without falling back", async () => {
  await cleanStudentsListFixture();
  try {
    await seedStudentsListFixture();
    const student = await db.student.findFirstOrThrow({
      where: { fullName: fullNameOf("Ana Attend") },
    });
    const initial = await db.user.findFirstOrThrow({ where: { name: TEACHER_A_NAME } });
    const replacement = await db.user.findFirstOrThrow({ where: { name: TEACHER_B_NAME } });
    const group = await db.class.findFirstOrThrow({ where: { internalCode: CLASS_A_CODE } });

    await db.user.update({ where: { id: initial.id }, data: { deletedAt: new Date() } });
    const removedInitial = await caller().students.pedagogy({ id: student.id });
    assert.equal(removedInitial.enrollments.length, 1);
    assert.equal(removedInitial.enrollments[0]?.class.teacher, null);
    assert.equal(removedInitial.enrollments[0]?.attendance.percent, 0.75);
    await db.user.update({ where: { id: initial.id }, data: { deletedAt: null } });

    const assignment = await db.classTeacherAssignment.create({
      data: {
        classId: group.id,
        teacherId: replacement.id,
        effectiveDate: new Date("2044-03-01"),
      },
    });
    const assigned = await caller().students.pedagogy({ id: student.id });
    assert.equal(assigned.enrollments[0]?.class.teacher?.name, TEACHER_B_NAME);
    await db.user.update({ where: { id: replacement.id }, data: { deletedAt: new Date() } });
    const removedEffective = await caller().students.pedagogy({ id: student.id });
    assert.equal(removedEffective.enrollments.length, 1);
    assert.equal(removedEffective.enrollments[0]?.class.teacher, null);
    assert.equal(removedEffective.enrollments[0]?.progress[0]?.stage, `${PREFIX}Stage`);

    await db.user.update({ where: { id: replacement.id }, data: { deletedAt: null } });
    await db.classTeacherAssignment.update({
      where: { id: assignment.id },
      data: { deletedAt: new Date() },
    });
    const removedAssignment = await caller().students.pedagogy({ id: student.id });
    assert.equal(removedAssignment.enrollments[0]?.class.teacher?.name, TEACHER_A_NAME);
  } finally {
    await db.classTeacherAssignment.deleteMany({
      where: { class: { internalCode: { startsWith: PREFIX } } },
    });
    await db.user.updateMany({
      where: { name: { in: [TEACHER_A_NAME, TEACHER_B_NAME] } },
      data: { deletedAt: null },
    });
    await cleanStudentsListFixture();
    await db.$disconnect();
  }
});

void it("resolves historical responsibility before the exclusive exit day, including an exit today", async () => {
  await cleanStudentsListFixture();
  try {
    await seedStudentsListFixture();
    const student = await db.student.findFirstOrThrow({
      where: { fullName: fullNameOf("Ana Attend") },
    });
    const enrollment = await db.enrollment.findFirstOrThrow({ where: { studentId: student.id } });
    const initial = await db.user.findFirstOrThrow({ where: { name: TEACHER_A_NAME } });
    const replacement = await db.user.findFirstOrThrow({ where: { name: TEACHER_B_NAME } });
    await db.$transaction(async (transaction) => {
      await transaction.pedagogicalProgress.updateMany({
        where: { enrollmentId: enrollment.id },
        data: { endDate: new Date("2044-04-15"), endReason: "DROPPED" },
      });
      await transaction.enrollment.update({
        where: { id: enrollment.id },
        data: { exitDate: new Date("2044-04-15"), exitReason: "DROPPED" },
      });
    });
    const assignment = await db.classTeacherAssignment.create({
      data: {
        classId: enrollment.classId,
        teacherId: replacement.id,
        effectiveDate: new Date("2044-04-15"),
      },
    });
    const exitToday = await caller().students.pedagogy({ id: student.id });
    assert.equal(exitToday.enrollments[0]?.current, false);
    assert.equal(exitToday.enrollments[0]?.class.teacher?.name, TEACHER_A_NAME);
    const afterExit = await caller(new Date("2044-04-16T12:00:00Z")).students.pedagogy({
      id: student.id,
    });
    assert.equal(afterExit.enrollments[0]?.class.teacher?.name, TEACHER_A_NAME);

    await db.classTeacherAssignment.delete({ where: { id: assignment.id } });
    await db.teacherProfile.create({
      data: { userId: initial.id, departureDate: new Date("2044-04-15") },
    });
    const departed = await caller().students.pedagogy({ id: student.id });
    assert.equal(departed.enrollments[0]?.class.teacher?.name, TEACHER_A_NAME);
  } finally {
    await db.classTeacherAssignment.deleteMany({
      where: { class: { internalCode: { startsWith: PREFIX } } },
    });
    await db.teacherProfile.deleteMany({ where: { user: { name: TEACHER_A_NAME } } });
    await cleanStudentsListFixture();
    await db.$disconnect();
  }
});
