import assert from "node:assert/strict";
import { it } from "node:test";
import {
  effectiveTeacherId,
  intervalsOverlap,
  teacherWeekMinutes,
  type TeacherCommitment,
} from "../src/teacher-schedule.js";

void it("counts two one-hour meetings and one two-hour meeting as two hours each", () => {
  const rows: TeacherCommitment[] = [
    {
      classId: "a",
      slotId: "tue",
      date: "2026-10-06",
      startTime: "18:00",
      endTime: "19:00",
      usualTeacherId: "one",
      substituteTeacherId: null,
      cancelled: false,
    },
    {
      classId: "a",
      slotId: "thu",
      date: "2026-10-08",
      startTime: "18:00",
      endTime: "19:00",
      usualTeacherId: "one",
      substituteTeacherId: null,
      cancelled: false,
    },
    {
      classId: "b",
      slotId: "sat",
      date: "2026-10-10",
      startTime: "09:00",
      endTime: "11:00",
      usualTeacherId: "two",
      substituteTeacherId: null,
      cancelled: false,
    },
  ];
  assert.equal(teacherWeekMinutes(rows, "one"), 120);
  assert.equal(teacherWeekMinutes(rows, "two"), 120);
  rows[1] = { ...rows[1]!, substituteTeacherId: "two" };
  assert.equal(teacherWeekMinutes(rows, "one"), 60);
  assert.equal(teacherWeekMinutes(rows, "two"), 180);
});

void it("uses half-open intervals and dated responsibility", () => {
  assert.equal(
    intervalsOverlap(
      { startTime: "09:00", endTime: "11:00" },
      { startTime: "10:30", endTime: "12:00" },
    ),
    true,
  );
  assert.equal(
    intervalsOverlap(
      { startTime: "09:00", endTime: "11:00" },
      { startTime: "11:00", endTime: "12:00" },
    ),
    false,
  );
  const assignment = {
    initialTeacherId: "old",
    assignments: [{ teacherId: "new", effectiveDate: "2026-10-08" }],
    departureDates: new Map([
      ["old", "2026-10-07"],
      ["new", null],
    ]),
  };
  assert.equal(effectiveTeacherId({ ...assignment, date: "2026-10-06" }), "old");
  assert.equal(effectiveTeacherId({ ...assignment, date: "2026-10-07" }), null);
  assert.equal(effectiveTeacherId({ ...assignment, date: "2026-10-08" }), "new");
});
