import assert from "node:assert/strict";
import { test } from "node:test";
import {
  lessonStage,
  type CalendarLesson,
} from "../../src/features/class-records/calendar-model.js";
import { lessonCalendarEvents } from "../../src/features/class-records/weekly-calendar.js";

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
    teacherId: "teacher-camila",
    guestCount: 0,
    state: "UPCOMING",
    attendanceOnly: false,
  };
}

void test("preserves every concurrent lesson and its civil interval in shared calendar events", () => {
  const rows = Array.from({ length: 6 }, (_unused, index) =>
    lesson(String(index), { startTime: "14:00", endTime: "15:00" }),
  );
  const events = lessonCalendarEvents(rows);
  assert.deepEqual(
    events.map(({ id, date, startTime, endTime, title, subtitle }) => ({
      id,
      date,
      startTime,
      endTime,
      title,
      subtitle,
    })),
    ["0", "1", "2", "3", "4", "5"].map((id) => ({
      id,
      date: "2026-10-13",
      startTime: "14:00",
      endTime: "15:00",
      title: `Turma ${id}`,
      subtitle: "Camila",
    })),
  );
  assert.deepEqual(
    events.map((event) => event.lesson),
    rows,
  );
});

void test("keeps original intervals and identities when adapting overlapping and unsorted lessons", () => {
  const rows = [
    lesson("c", { startTime: "15:15", endTime: "16:00" }),
    lesson("a", { startTime: "14:00", endTime: "15:00" }),
    lesson("b", { startTime: "14:45", endTime: "15:30" }),
  ];
  const events = lessonCalendarEvents(rows);
  assert.deepEqual(
    events.map(({ id, startTime, endTime }) => ({ id, startTime, endTime })),
    [
      { id: "c", startTime: "15:15", endTime: "16:00" },
      { id: "a", startTime: "14:00", endTime: "15:00" },
      { id: "b", startTime: "14:45", endTime: "15:30" },
    ],
  );
  assert.deepEqual(
    rows.map((row) => row.id),
    ["c", "a", "b"],
  );
  assert.deepEqual(lessonCalendarEvents([]), []);
});

void test("pedagogical identity distinguishes shared, individual and missing stages", () => {
  assert.equal(lessonStage(lesson("regular")), "Stage 2");
  assert.equal(
    lessonStage({ ...lesson("ppt"), scheduleType: "PERSONALIZED", stageName: null }),
    "Estágios individuais",
  );
  assert.equal(lessonStage({ ...lesson("missing"), stageName: null }), "Estágio não informado");
});
