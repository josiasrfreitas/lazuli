import assert from "node:assert/strict";
import { test } from "node:test";
import {
  groupCalendarLessons,
  visibleLessonCount,
  lessonStage,
  type CalendarLesson,
} from "../../src/features/class-records/calendar-model.js";

function lesson(
  id: string,
  {
    startTime = "14:00",
    endTime = "15:30",
    date = "2026-10-13",
  }: { startTime?: string; endTime?: string; date?: string } = {},
): CalendarLesson {
  return {
    id,
    classId: id,
    className: `Turma ${id}`,
    scheduleType: "REGULAR",
    stageName: "Stage 2",
    date,
    startTime,
    endTime,
    teacher: "Camila",
    state: "UPCOMING",
    attendanceOnly: false,
  };
}

void test("six concurrent one-hour lessons retain their identity behind an explicit overflow count", () => {
  const rows = Array.from({ length: 6 }, (unused, index) =>
    lesson(String(index), { startTime: "14:00", endTime: "15:00" }),
  );
  const groups = groupCalendarLessons(rows);
  assert.equal(groups.length, 1);
  assert.equal(visibleLessonCount(groups[0]!), 3);
  assert.deepEqual(
    groups[0]!.rows.map((row) => row.id),
    ["0", "1", "2", "3", "4", "5"],
  );
});

void test("partial and transitive overlaps share one block without changing individual lesson times", () => {
  const rows = [
    lesson("c", { startTime: "15:15", endTime: "16:00" }),
    lesson("a", { startTime: "14:00", endTime: "15:00" }),
    lesson("b", { startTime: "14:45", endTime: "15:30" }),
  ];
  const groups = groupCalendarLessons(rows);
  assert.equal(groups.length, 1);
  assert.equal(groups[0]!.startTime, "14:00");
  assert.equal(groups[0]!.endTime, "16:00");
  assert.deepEqual(
    groups[0]!.rows.map(({ id, startTime, endTime }) => ({ id, startTime, endTime })),
    [
      { id: "a", startTime: "14:00", endTime: "15:00" },
      { id: "b", startTime: "14:45", endTime: "15:30" },
      { id: "c", startTime: "15:15", endTime: "16:00" },
    ],
  );
  assert.deepEqual(
    rows.map((row) => row.id),
    ["c", "a", "b"],
  );
});

void test("touching lessons and matching times on different dates remain separate", () => {
  const groups = groupCalendarLessons([
    lesson("next-day", { startTime: "14:00", endTime: "15:30", date: "2026-10-14" }),
    lesson("later", { startTime: "15:30", endTime: "17:00" }),
    lesson("first"),
  ]);
  assert.deepEqual(
    groups.map((group) => group.rows.map((row) => row.id)),
    [["first"], ["later"], ["next-day"]],
  );
});

void test("short dense blocks reserve an explicit overflow action while retaining every lesson", () => {
  const group = groupCalendarLessons(
    Array.from({ length: 6 }, (unused, index) =>
      lesson(String(index), { startTime: "14:00", endTime: "14:30" }),
    ),
  )[0]!;
  assert.equal(visibleLessonCount(group), 0);
  assert.equal(group.rows.length, 6);
  assert.deepEqual(groupCalendarLessons([]), []);
});

void test("pedagogical identity distinguishes shared, individual and missing stages", () => {
  assert.equal(lessonStage(lesson("regular")), "Stage 2");
  assert.equal(
    lessonStage({ ...lesson("ppt"), scheduleType: "PERSONALIZED", stageName: null }),
    "Estágios individuais",
  );
  assert.equal(lessonStage({ ...lesson("missing"), stageName: null }), "Estágio não informado");
});
