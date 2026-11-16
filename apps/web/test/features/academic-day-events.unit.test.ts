import assert from "node:assert/strict";
import { it } from "node:test";
import { academicDayEvents } from "../../src/features/academic-calendar/day-agenda.js";
import type { AcademicYear } from "../../src/features/academic-calendar/model.js";

const data: AcademicYear = {
  periods: [],
  interruptions: [],
  closedDays: [],
  requests: [],
  planWarnings: [],
  events: [
    {
      id: "overnight",
      title: "Virada",
      description: "Dois dias",
      startsAt: new Date("2026-12-31T23:00:00Z"),
      endsAt: new Date("2027-01-01T04:00:00Z"),
      updatedAt: new Date("2026-12-01Z"),
    },
  ],
};
void it("clips an overnight event to each school-local day without changing its identity", () => {
  assert.deepEqual(academicDayEvents("2026-12-31", data), [
    {
      id: "academic-overnight",
      academicId: "overnight",
      date: "2026-12-31",
      title: "Virada",
      subtitle: "Dois dias",
      startTime: "20:00",
      endTime: "24:00",
      tone: "info",
    },
  ]);
  assert.deepEqual(academicDayEvents("2027-01-01", data), [
    {
      id: "academic-overnight",
      academicId: "overnight",
      date: "2027-01-01",
      title: "Virada",
      subtitle: "Dois dias",
      startTime: "00:00",
      endTime: "01:00",
      tone: "info",
    },
  ]);
});
void it("excludes an event ending exactly at the beginning of the displayed day", () => {
  const ended = {
    ...data,
    events: data.events.map((event) => ({ ...event, endsAt: new Date("2027-01-01T03:00:00Z") })),
  };
  assert.deepEqual(academicDayEvents("2027-01-01", ended), []);
});
