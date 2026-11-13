import assert from "node:assert/strict";
import { it } from "node:test";
import {
  calendarEntries,
  entriesInRange,
  isoDay,
  shiftDay,
} from "../../src/features/academic-calendar/date-model.js";
import { calendarDay, type AcademicYear } from "../../src/features/academic-calendar/model.js";

const timestamp = new Date("2026-01-01T00:00:00Z");
const empty: AcademicYear = {
  periods: [],
  interruptions: [],
  events: [],
  closedDays: [],
  requests: [],
  planWarnings: [],
};

void it("keeps midnight endings exclusive in São Paulo, including a year boundary", () => {
  const entries = calendarEntries({
    ...empty,
    events: [
      {
        id: "overnight",
        title: "Virada cultural",
        description: null,
        updatedAt: timestamp,
        startsAt: new Date("2027-01-01T01:00:00Z"),
        endsAt: new Date("2027-01-01T03:00:00Z"),
      },
    ],
  });
  assert.deepEqual(
    entries.map(({ from, through, detail }) => ({ from, through, detail })),
    [{ from: "2026-12-31", through: "2026-12-31", detail: "22:00–00:00 · não suspende aulas" }],
  );
  assert.equal(entriesInRange(entries, "2027-01-01", "2027-01-31").length, 0);
  assert.equal(entriesInRange(entries, "2026-12-01", "2026-12-31").length, 1);
});

void it("shows one interruption across months without duplicating its daily closure records", () => {
  const data: AcademicYear = {
    ...empty,
    interruptions: [
      {
        id: "recess",
        title: "Recesso",
        kind: "RECESS",
        description: "Pausa nas atividades",
        fromDate: new Date("2026-06-29Z"),
        throughDate: new Date("2026-07-02Z"),
        sourceKey: null,
        createdById: null,
        createdAt: timestamp,
        updatedAt: timestamp,
        deletedAt: null,
      },
    ],
    closedDays: [
      { id: "closed-june", date: new Date("2026-06-30Z"), reason: "Recesso" },
      { id: "closed-july", date: new Date("2026-07-01Z"), reason: "Recesso" },
      { id: "legacy", date: new Date("2026-07-08Z"), reason: "Feriado local" },
    ],
  };
  const entries = calendarEntries(data);
  assert.deepEqual(
    entries.map(({ id }) => id),
    ["recess", "legacy"],
  );
  assert.deepEqual(
    entriesInRange(entries, "2026-07-01", "2026-07-02").map(({ id }) => id),
    ["recess"],
  );
});

void it("distinguishes unknown coverage, vacations between known periods, and boundary closures", () => {
  const data: AcademicYear = {
    ...empty,
    periods: [
      {
        id: "first",
        name: "Primeiro semestre",
        startDate: new Date("2026-02-02Z"),
        endDate: new Date("2026-06-30Z"),
        updatedAt: timestamp,
      },
      {
        id: "second",
        name: "Segundo semestre",
        startDate: new Date("2026-08-03Z"),
        endDate: new Date("2026-12-18Z"),
        updatedAt: timestamp,
      },
    ],
    closedDays: [{ id: "closure", date: new Date("2026-06-30Z"), reason: "Manutenção" }],
  };
  assert.equal(calendarDay("2026-01-10", data).kind, "unknown");
  assert.equal(calendarDay("2026-07-15", data).kind, "vacation");
  assert.equal(calendarDay("2026-12-20", data).kind, "unknown");
  assert.deepEqual(calendarDay("2026-06-30", data).markers, ["holiday", "boundary"]);
});

void it("navigates leap dates and month or year edges as civil dates", () => {
  assert.equal(shiftDay("2028-02-28", 1), "2028-02-29");
  assert.equal(shiftDay("2028-02-29", 1), "2028-03-01");
  assert.equal(isoDay(2026, 12, 1), "2027-01-01");
  assert.equal(isoDay(2026, -1, 1), "2025-12-01");
});
