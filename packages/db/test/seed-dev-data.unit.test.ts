import assert from "node:assert/strict";
import { it } from "node:test";
import { DEV_CLASSES, DEV_STUDENTS, DEV_TEACHERS } from "../src/seed-dev-data.js";

void it("models 250 students with 220 allocated, waiting and paused records, and shared families", () => {
  assert.equal(DEV_CLASSES.length, 22);
  assert.equal(DEV_STUDENTS.length, 250);
  assert.equal(DEV_TEACHERS.length, 7);
  assert.equal(new Set(DEV_STUDENTS.map((student) => student.fullName)).size, 250);
  assert.equal(new Set(DEV_STUDENTS.map((student) => student.key)).size, 250);
  const minors = DEV_STUDENTS.filter((student) => student.ageYears! < 18);
  assert.equal(minors.length, 172);
  assert.equal(minors.filter((student) => student.guardian !== undefined).length, 172);
  assert.equal(DEV_STUDENTS.filter((student) => student.status === "SUSPENDED").length, 10);
  assert.equal(DEV_STUDENTS.filter((student) => student.status === "INACTIVE").length, 10);
  assert.equal(
    DEV_STUDENTS.filter(
      (student) => student.status === "ACTIVE" && student.enrollments.length === 0,
    ).length,
    10,
  );
  const allocated = DEV_STUDENTS.filter((student) => student.enrollments.length > 0);
  assert.equal(allocated.length, 220);
  assert.equal(allocated.filter((student) => student.financeProfile === "overdue").length, 11);
  assert.equal(allocated.filter((student) => student.financeProfile === "partial").length, 11);
  assert.equal(allocated.filter((student) => student.financeProfile === "late-settled").length, 11);
  assert.equal(new Set(allocated.map((student) => student.guardian?.key ?? student.key)).size, 205);
  const occupancy = DEV_CLASSES.map(
    (classroom) =>
      DEV_STUDENTS.filter((student) =>
        student.enrollments.some((enrollment) => enrollment.classKey === classroom.key),
      ).length,
  );
  assert.deepEqual(
    occupancy,
    [8, 10, 11, 9, 12, 10, 14, 8, 11, 9, 12, 10, 4, 10, 10, 12, 10, 10, 10, 10, 10, 10],
  );
  for (const [index, classroom] of DEV_CLASSES.entries()) {
    assert.equal(occupancy[index]! <= classroom.capacity, true, classroom.key);
  }
  assert.equal(
    allocated.filter((student) => student.enrollments[0]!.classKey.startsWith("PPT")).length,
    32,
  );
});

void it("keeps allocated students in one class and teachers free of overlapping meetings", () => {
  const keys = new Set(DEV_CLASSES.map((classroom) => classroom.key));
  for (const student of DEV_STUDENTS) {
    assert.equal(student.enrollments.length <= 1, true);
    for (const enrollment of student.enrollments) {
      assert.equal(keys.has(enrollment.classKey), true);
    }
    assert.doesNotMatch(student.fullName, /exemplo|estudante|\d/iu);
    assert.match(student.phone!, /^\(82\) 9\d{4}-\d{4}$/u);
  }
  for (const teacher of DEV_TEACHERS) {
    const slots = DEV_CLASSES.filter((classroom) => classroom.teacherKey === teacher.key).flatMap(
      (classroom) => classroom.slots,
    );
    for (let index = 0; index < slots.length; index += 1) {
      const slot = slots[index]!;
      const overlaps = slots
        .slice(index + 1)
        .filter(
          (other) =>
            other.weekday === slot.weekday &&
            slot.startTime < other.endTime &&
            other.startTime < slot.endTime,
        );
      assert.deepEqual(overlaps, [], `${teacher.name} ${slot.weekday} ${slot.startTime}`);
    }
  }
});
