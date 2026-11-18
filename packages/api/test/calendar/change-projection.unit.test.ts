import assert from "node:assert/strict";
import { it } from "node:test";
import type { AcademicInterruption, Period, SchoolClosedDay } from "@lazuli/db/prisma";
import { projectedClosedDays, calendarChangeRange } from "../../src/calendar/change-projection.js";
import { validateCalendarVersion } from "../../src/calendar/change-validation.js";

const timestamp = new Date("2026-01-01T00:00:00Z");
function interruption(id: string, range: [string, string]): AcademicInterruption {
  return {
    id,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
    fromDate: new Date(range[0]),
    throughDate: new Date(range[1]),
    kind: "RECESS",
    title: id,
    description: null,
    sourceKey: null,
    createdById: null,
  };
}
function closure(date: string, calendarManaged: boolean): SchoolClosedDay {
  return {
    id: date,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
    date: new Date(date),
    reason: date,
    calendarManaged,
    createdById: null,
  };
}
void it("removing an interruption releases its managed dates but preserves overlaps and manual closure", () => {
  const removed = interruption("removed", ["2026-04-20", "2026-04-22"]);
  const overlapping = interruption("overlap", ["2026-04-21", "2026-04-21"]);
  const result = projectedClosedDays(
    { action: "removeInterruption", id: removed.id, expectedUpdatedAt: timestamp.toISOString() },
    {
      interruptions: [removed, overlapping],
      closedDays: [
        closure("2026-04-20", false),
        closure("2026-04-21", true),
        closure("2026-04-22", true),
      ],
    },
  );
  assert.deepEqual([...result].toSorted(), ["2026-04-20", "2026-04-21"]);
  assert.equal(result.has("2026-04-22"), false);
});
void it("moving an interruption includes both its original and replacement date ranges", () => {
  const original = interruption("original", ["2026-04-20", "2026-04-22"]);
  const change = {
    action: "interruption",
    id: original.id,
    expectedUpdatedAt: timestamp.toISOString(),
    kind: "RECESS",
    title: "Moved",
    description: null,
    from: "2026-05-01",
    through: "2026-05-02",
  } as const;
  const range = calendarChangeRange(change, { period: undefined, interruption: original });
  assert.deepEqual(range.toSorted(), ["2026-04-20", "2026-04-22", "2026-05-01", "2026-05-02"]);
  assert.deepEqual(
    [...projectedClosedDays(change, { interruptions: [original], closedDays: [] })],
    ["2026-05-01", "2026-05-02"],
  );
});
void it("does not duplicate an imported holiday source or lose unrelated manual closures", () => {
  const existing = {
    ...interruption("existing", ["2026-04-21", "2026-04-21"]),
    sourceKey: "holiday-source",
  };
  const result = projectedClosedDays(
    {
      action: "holidays",
      dates: [
        { date: "2026-04-22", title: "Already imported", sourceKey: "holiday-source" },
        { date: "2026-05-01", title: "New", sourceKey: "new-source" },
      ],
    },
    { interruptions: [existing], closedDays: [closure("2026-06-01", false)] },
  );
  assert.deepEqual([...result].toSorted(), ["2026-04-21", "2026-05-01", "2026-06-01"]);
});
void it("rejects a stale period version and permits the exact observed version", () => {
  const period: Period = {
    formationRiskLimit: 4,
    id: "period",
    name: "Semester",
    startDate: new Date("2026-01-01"),
    endDate: new Date("2026-06-30"),
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  };
  const change = {
    action: "period",
    id: period.id,
    name: period.name,
    from: "2026-02-01",
    through: "2026-06-30",
    expectedUpdatedAt: "2025-01-01T00:00:00.000Z",
  } as const;
  assert.throws(
    () => validateCalendarVersion(change, { period, interruption: undefined }),
    /O calendário mudou/u,
  );
  validateCalendarVersion(
    { ...change, expectedUpdatedAt: timestamp.toISOString() },
    { period, interruption: undefined },
  );
});
