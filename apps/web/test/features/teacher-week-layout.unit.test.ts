import assert from "node:assert/strict";
import test from "node:test";
import { visibleWeekSlots } from "../../src/features/teachers/week-layout.js";
import type { Meeting } from "../../src/features/teachers/meeting-dialog.js";

function meeting(startTime: string, endTime: string): Meeting {
  return {
    classId: "class",
    slotId: "slot",
    sessionId: null,
    date: "2026-10-08",
    startTime,
    endTime,
    usualTeacherId: "teacher",
    usualTeacherName: "Professor",
    substituteTeacherId: null,
    substituteTeacherName: null,
    cancelled: false,
    className: "Turma",
    classCode: "R1",
    scheduleType: "REGULAR",
    format: "IN_PERSON",
    stageName: "Stage 1",
    minutes: 120,
    editable: true,
  };
}
void test("a morning lesson retains all morning hours as individual one-hour cells", () => {
  assert.deepEqual(visibleWeekSlots([meeting("09:00", "11:00")]), [
    { start: "07:00", end: "08:00" },
    { start: "08:00", end: "09:00" },
    { start: "09:00", end: "10:00" },
    { start: "10:00", end: "11:00" },
    { start: "11:00", end: "12:00" },
  ]);
});
void test("empty afternoon shifts disappear without merging the remaining hourly cells", () => {
  assert.deepEqual(visibleWeekSlots([meeting("11:00", "12:00"), meeting("19:00", "21:00")]), [
    { start: "07:00", end: "08:00" },
    { start: "08:00", end: "09:00" },
    { start: "09:00", end: "10:00" },
    { start: "10:00", end: "11:00" },
    { start: "11:00", end: "12:00" },
    { start: "19:00", end: "20:00" },
    { start: "20:00", end: "21:00" },
    { start: "21:00", end: "22:00" },
  ]);
});
void test("a lesson spanning noon keeps both shifts but does not activate the night", () => {
  const slots = visibleWeekSlots([meeting("11:00", "13:00")]);
  assert.equal(slots.length, 12);
  assert.deepEqual(slots[4], { start: "11:00", end: "12:00" });
  assert.deepEqual(slots[5], { start: "12:00", end: "13:00" });
  assert.deepEqual(slots[11], { start: "18:00", end: "19:00" });
  assert.deepEqual(visibleWeekSlots([]), []);
});
