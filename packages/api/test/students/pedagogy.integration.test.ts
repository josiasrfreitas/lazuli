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
