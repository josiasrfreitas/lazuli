import assert from "node:assert/strict";
import { it } from "node:test";
import { DEV_CLASSES, DEV_STUDENTS, DEV_TEACHERS } from "../src/seed-dev-data.js";

void it("models a mostly underage school with ten students per class and seven teachers", () => {
  assert.equal(DEV_CLASSES.length, 16);
  assert.equal(DEV_STUDENTS.length, 160);
  assert.equal(DEV_TEACHERS.length, 7);
  assert.equal(new Set(DEV_STUDENTS.map((student) => student.fullName)).size, 160);
  assert.equal(new Set(DEV_STUDENTS.map((student) => student.key)).size, 160);
  const minors = DEV_STUDENTS.filter((student) => student.ageYears! < 18);
  assert.equal(minors.length, 126);
  assert.equal(minors.filter((student) => student.guardian !== undefined).length, 126);
  const occupancy = DEV_CLASSES.map(
    (classroom) =>
      DEV_STUDENTS.filter((student) =>
        student.enrollments.some((enrollment) => enrollment.classKey === classroom.key),
      ).length,
  );
  assert.equal(occupancy.reduce((sum, count) => sum + count, 0) / occupancy.length, 10);
  assert.equal(Math.min(...occupancy), 4);
  assert.equal(Math.max(...occupancy), 14);
  assert.equal(occupancy.filter((count) => count >= 8 && count <= 12).length, 14);
});

void it("gives each student one class and keeps teachers free of overlapping meetings", () => {
  const keys = new Set(DEV_CLASSES.map((classroom) => classroom.key));
  for (const student of DEV_STUDENTS) {
    assert.equal(student.enrollments.length, 1);
    assert.equal(keys.has(student.enrollments[0]!.classKey), true);
    assert.doesNotMatch(student.fullName, /exemplo|estudante|\d/iu);
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
