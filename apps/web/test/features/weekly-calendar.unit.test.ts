import assert from "node:assert/strict";
import { test } from "node:test";
import {
  agendaDate,
  calendarDateKey,
  schoolCalendarNow,
  weeklyCalendarEvents,
} from "../../src/features/class-records/weekly-calendar-model.js";
import type { CalendarLesson } from "../../src/features/class-records/calendar-model.js";

function lesson(id: string, date = "2026-12-28"): CalendarLesson {
  return {
    id,
    classId: id,
    className: `Turma ${id}`,
    date,
    startTime: "08:15",
    endTime: "09:45",
    teacherId: "teacher",
    teacher: "Camila",
    scheduleType: "REGULAR",
    stageName: "Stage 2",
    state: "UPCOMING",
    attendanceOnly: false,
    guestCount: 0,
  };
}

void test("weekly adapter retains concurrent lessons, Sunday and exact school wall times across the year boundary", () => {
  const events = weeklyCalendarEvents(
    [
      lesson("before", "2026-12-27"),
      lesson("first"),
      lesson("second"),
      lesson("sunday", "2027-01-03"),
      lesson("after", "2027-01-04"),
    ],
    "2027-01-01",
  );
  assert.deepEqual(
    events.map((event) => [
      event.id,
      calendarDateKey(event.start),
      event.start.getHours(),
      event.start.getMinutes(),
      event.end.getHours(),
      event.end.getMinutes(),
    ]),
    [
      ["first", "2026-12-28", 8, 15, 9, 45],
      ["second", "2026-12-28", 8, 15, 9, 45],
      ["sunday", "2027-01-03", 8, 15, 9, 45],
    ],
  );
  assert.equal(events[0]!.title, "Camila · Turma first · 08:15–09:45");
  assert.equal(events[1]!.lesson.classId, "second");
});

void test("school today marker uses São Paulo even when the instant is already tomorrow in UTC", () => {
  const now = schoolCalendarNow(new Date("2026-10-17T01:30:00Z"));
  assert.equal(calendarDateKey(now), "2026-10-16");
  assert.equal(now.getHours(), 22);
  assert.equal(now.getMinutes(), 30);
});

void test("agenda links select their explicit day or week and reject impossible dates", () => {
  assert.equal(agendaDate("2026-10-16", { day: "2026-10-20", week: "2026-10-12" }), "2026-10-20");
  assert.equal(agendaDate("2026-10-16", { day: null, week: "2026-10-19" }), "2026-10-19");
  assert.equal(agendaDate("2026-10-16", { day: null, week: "2026-10-12" }), "2026-10-16");
  assert.equal(agendaDate("2026-10-16", { day: "2026-02-30", week: "invalid" }), "2026-10-16");
});

void test("unassigned teachers and empty weeks remain explicit", () => {
  const events = weeklyCalendarEvents(
    [{ ...lesson("unassigned"), teacherId: null, teacher: null }],
    "2026-12-28",
  );
  assert.equal(events[0]!.title, "Professor a definir · Turma unassigned · 08:15–09:45");
  assert.deepEqual(weeklyCalendarEvents([lesson("outside")], "2026-10-12"), []);
});
