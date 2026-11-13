import assert from "node:assert/strict";
import { it } from "node:test";
import { scheduleProgram } from "../src/program-schedule.js";
const activities = [1, 2, 3, 4].map((id) => ({ id: String(id), durationMinutes: 60 }));
void it("packs the canonical sequence into class minutes without stretching the semester", () => {
  const result = scheduleProgram(activities, [
    { date: "2026-08-01", minutes: 120 },
    { date: "2026-08-08", minutes: 120 },
  ]);
  assert.equal(result.missingMinutes, 0);
  assert.deepEqual(
    result.scheduled.map((row) => [row.activity.id, row.date]),
    [
      ["1", "2026-08-01"],
      ["2", "2026-08-01"],
      ["3", "2026-08-08"],
      ["4", "2026-08-08"],
    ],
  );
});
void it("carries a teaching hour across shorter meetings and reports insufficient capacity", () => {
  const result = scheduleProgram(activities, [
    { date: "2026-08-01", minutes: 90 },
    { date: "2026-08-08", minutes: 90 },
  ]);
  assert.deepEqual(
    result.scheduled.map((row) => row.date),
    ["2026-08-01", "2026-08-08", "2026-08-08"],
  );
  assert.equal(result.missingMinutes, 60);
  assert.equal(scheduleProgram(activities, []).missingMinutes, 240);
});
