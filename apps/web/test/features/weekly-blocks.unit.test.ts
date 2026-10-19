import assert from "node:assert/strict";
import { test } from "node:test";
import { weeklyLaneGeometry } from "../../src/features/class-records/weekly-layout.js";
import {
  revealWeeklyBlocks,
  weeklyBlocks,
} from "../../src/features/class-records/weekly-blocks.js";
import type { CalendarLesson } from "../../src/features/class-records/calendar-model.js";

function lesson(id: string, [startTime, endTime] = ["14:00", "15:00"]): CalendarLesson {
  return {
    id,
    classId: id,
    className: `Turma ${id}`,
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

void test("four simultaneous lessons occupy separate horizontal lanes at their real start and end times", () => {
  const events = weeklyBlocks([lesson("a"), lesson("b"), lesson("c"), lesson("d")], "2026-10-13");
  assert.deepEqual(
    events.map((event) => [
      event.kind,
      event.lessons[0]!.id,
      event.lane,
      event.columns,
      event.startTime,
      event.endTime,
    ]),
    [
      ["lesson", "a", 0, 4, "14:00", "15:00"],
      ["lesson", "b", 1, 4, "14:00", "15:00"],
      ["lesson", "c", 2, 4, "14:00", "15:00"],
      ["lesson", "d", 3, 4, "14:00", "15:00"],
    ],
  );
  assert.deepEqual(
    events.map((event) => weeklyLaneGeometry(event)),
    [
      { left: 0, width: 25 },
      { left: 25, width: 25 },
      { left: 50, width: 25 },
      { left: 75, width: 25 },
    ],
  );
});

void test("the fifth horizontal lane counts only the simultaneous lessons beyond the four visible cards", () => {
  const events = weeklyBlocks(
    [lesson("f"), lesson("b"), lesson("d"), lesson("a"), lesson("e"), lesson("c")],
    "2026-10-13",
  );
  assert.deepEqual(
    events.filter((event) => event.kind === "lesson").map((event) => event.lessons[0]!.id),
    ["a", "b", "c", "d"],
  );
  const overflow = events.find((event) => event.kind === "overflow")!;
  assert.deepEqual(
    [overflow.lane, overflow.title, overflow.startTime, overflow.endTime],
    [4, "Mais 2", "14:00", "15:00"],
  );
  assert.deepEqual(
    overflow.lessons.map((row) => row.id),
    ["e", "f"],
  );
});

void test("transitive overlaps do not count sequential lessons as simultaneous or change their duration", () => {
  const events = weeklyBlocks(
    [
      lesson("a", ["14:00", "15:00"]),
      lesson("b", ["14:45", "15:30"]),
      lesson("c", ["15:15", "16:00"]),
      lesson("d", ["15:45", "16:30"]),
      lesson("e", ["16:15", "17:00"]),
      lesson("touching", ["17:00", "18:00"]),
      { ...lesson("tomorrow"), date: "2026-10-14" },
    ],
    "2026-10-13",
  );
  assert.deepEqual(
    events.map((event) => [event.kind, event.lessons[0]!.id, event.startTime, event.endTime]),
    [
      ["lesson", "a", "14:00", "15:00"],
      ["lesson", "b", "14:45", "15:30"],
      ["lesson", "c", "15:15", "16:00"],
      ["lesson", "d", "15:45", "16:30"],
      ["lesson", "e", "16:15", "17:00"],
      ["lesson", "touching", "17:00", "18:00"],
      ["lesson", "tomorrow", "14:00", "15:00"],
    ],
  );
});

void test("overflow updates at each actual collision boundary and a remaining lesson becomes visible when a lane frees up", () => {
  const events = weeklyBlocks(
    [
      lesson("a"),
      lesson("b"),
      lesson("c"),
      lesson("d"),
      lesson("e", ["14:15", "15:30"]),
      lesson("f", ["14:30", "14:45"]),
    ],
    "2026-10-13",
  );
  assert.deepEqual(
    events
      .filter((event) => event.kind === "overflow")
      .map((event) => [event.startTime, event.endTime, event.lessons.map((row) => row.id)]),
    [
      ["14:15", "14:30", ["e"]],
      ["14:30", "14:45", ["e", "f"]],
      ["14:45", "15:00", ["e"]],
    ],
  );
  const remaining = events.find(
    (event) => event.kind === "lesson" && event.lessons[0]!.id === "e",
  )!;
  assert.deepEqual(
    [remaining.startTime, remaining.endTime, remaining.lessons[0]!.startTime],
    ["15:00", "15:30", "14:15"],
  );
});

void test("short appointments remain individual cards instead of being hidden because of their height", () => {
  const events = weeklyBlocks(
    [
      lesson("a", ["10:00", "10:15"]),
      lesson("b", ["10:00", "10:15"]),
      lesson("c", ["10:00", "10:15"]),
    ],
    "2026-10-13",
  );
  assert.deepEqual(
    events.map((event) => [event.kind, event.lane, event.startTime, event.endTime]),
    [
      ["lesson", 0, "10:00", "10:15"],
      ["lesson", 1, "10:00", "10:15"],
      ["lesson", 2, "10:00", "10:15"],
    ],
  );
  assert.deepEqual(weeklyBlocks([lesson("outside")], "2026-10-19"), []);
});

void test("horizontal expansion redistributes space without covering a neighboring lane", () => {
  const events = weeklyBlocks([lesson("a"), lesson("b"), lesson("c"), lesson("d")], "2026-10-13");
  const selected = events[1]!;
  const boxes = events.map((event) => weeklyLaneGeometry(event, selected));
  assert.equal(boxes[0]!.left, 0);
  for (let index = 1; index < boxes.length; index++) {
    const previous = boxes.at(index - 1)!;
    assert.ok(Math.abs(boxes.at(index)!.left - previous.left - previous.width) < 0.0001);
  }
  assert.ok(Math.abs(boxes[3]!.left + boxes[3]!.width - 100) < 0.0001);
  assert.ok(boxes[1]!.width > 25);
});

void test("opening overflow reveals every simultaneous lesson in equal horizontal lanes without changing times", () => {
  const events = weeklyBlocks(
    [
      lesson("a"),
      lesson("b"),
      lesson("c"),
      lesson("d"),
      lesson("e", ["14:15", "15:30"]),
      lesson("f", ["14:30", "14:45"]),
    ],
    "2026-10-13",
  );
  const overflow = events.find((event) => event.kind === "overflow")!;
  const revealed = revealWeeklyBlocks(events, overflow.groupId);
  assert.deepEqual(
    revealed.map((event) => [
      event.lessons[0]!.id,
      event.kind,
      event.lane,
      event.startTime,
      event.endTime,
    ]),
    [
      ["a", "lesson", 0, "14:00", "15:00"],
      ["b", "lesson", 1, "14:00", "15:00"],
      ["c", "lesson", 2, "14:00", "15:00"],
      ["d", "lesson", 3, "14:00", "15:00"],
      ["e", "lesson", 4, "14:15", "15:30"],
      ["f", "lesson", 5, "14:30", "14:45"],
    ],
  );
  assert.deepEqual(
    revealed.map((event) => Number(weeklyLaneGeometry(event, revealed[0]).width.toFixed(4))),
    [16.6667, 16.6667, 16.6667, 16.6667, 16.6667, 16.6667],
  );
  assert.deepEqual(revealWeeklyBlocks(events, null), events);
});
