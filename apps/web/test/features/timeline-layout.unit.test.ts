import assert from "node:assert/strict";
import { test } from "node:test";
import {
  timelineGroups,
  timelineOverflow,
} from "../../src/features/class-records/timeline-layout.js";
import type { CalendarLesson } from "../../src/features/class-records/calendar-model.js";

function lesson(id: string, [startTime, endTime]: [string, string]): CalendarLesson {
  return {
    id,
    classId: id,
    className: id,
    teacherId: id,
    teacher: id,
    date: "2026-10-13",
    startTime,
    endTime,
    scheduleType: "REGULAR",
    stageName: "Stage 1",
    state: "UPCOMING",
    attendanceOnly: false,
    guestCount: 0,
  };
}

void test("successive teachers reuse space rather than allocating a column per teacher", () => {
  const groups = timelineGroups([lesson("a", ["08:00", "09:00"]), lesson("b", ["09:00", "10:00"])]);
  assert.deepEqual(
    groups.map((group) => ({ start: group.start, end: group.end, lanes: group.lanes })),
    [
      { start: 480, end: 540, lanes: 1 },
      { start: 540, end: 600, lanes: 1 },
    ],
  );
});

void test("partial overlaps reuse a free lane without colliding with the continuing lesson", () => {
  const rows = [
    lesson("c", ["09:00", "10:00"]),
    lesson("b", ["08:30", "09:30"]),
    lesson("a", ["08:00", "09:00"]),
  ];
  const groups = timelineGroups(rows);
  assert.equal(groups.length, 1);
  assert.equal(groups[0]!.lanes, 2);
  assert.deepEqual(
    groups[0]!.placed.map(({ lesson: row, lane }) => [row.id, lane]),
    [
      ["a", 0],
      ["b", 1],
      ["c", 0],
    ],
  );
  assert.deepEqual(
    rows.map((row) => row.id),
    ["c", "b", "a"],
  );
});

void test("sixty concurrent lessons retain their identities for expansion", () => {
  const rows = Array.from({ length: 60 }, (_unused, index) =>
    lesson(String(index).padStart(2, "0"), ["14:00", "15:30"]),
  );
  const groups = timelineGroups(rows);
  assert.equal(groups.length, 1);
  assert.equal(groups[0]!.lanes, 60);
  assert.deepEqual(
    groups[0]!.placed.map(({ lesson: row }) => row.id),
    rows.map((row) => row.id),
  );
  assert.equal(new Set(groups[0]!.placed.map((row) => row.lane)).size, 60);
});

void test("different dates and empty schedules do not create false overlaps", () => {
  const first = lesson("a", ["08:00", "09:00"]);
  const second = { ...lesson("b", ["08:00", "09:00"]), date: "2026-10-14" };
  assert.deepEqual(
    timelineGroups([second, first]).map((group) => group.placed.map((row) => row.lesson.id)),
    [["a"], ["b"]],
  );
  assert.deepEqual(timelineGroups([]), []);
});

void test("overflow counts follow actual concurrent lessons instead of counting the entire day", () => {
  const rows = [
    lesson("a", ["08:00", "10:00"]),
    lesson("b", ["08:00", "10:00"]),
    lesson("c", ["08:00", "10:00"]),
    lesson("d", ["08:00", "10:00"]),
    lesson("e", ["08:00", "09:00"]),
  ];
  assert.deepEqual(timelineOverflow(timelineGroups(rows)[0]!), [
    { start: 480, end: 540, count: 2 },
    { start: 540, end: 600, count: 1 },
  ]);
});
