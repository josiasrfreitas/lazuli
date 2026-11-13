import assert from "node:assert/strict";
import { it } from "node:test";
import { absenceSummary, inWindow, mean, studentMean } from "../../src/teachers/metric-rules.js";

void it("weights students equally rather than grades or class sizes", () => {
  assert.equal(
    studentMean([
      { studentId: "one", score: 100 },
      { studentId: "one", score: 80 },
      { studentId: "two", score: 50 },
    ]),
    70,
  );
  assert.equal(mean([100, 100, ...Array<number>(18).fill(60)]), 64);
});
void it("keeps missing evidence distinct from a real zero", () => {
  assert.equal(mean([null, null]), null);
  assert.equal(mean([0, null, 100]), 50);
  assert.equal(studentMean([]), null);
  assert.equal(absenceSummary([]).percent, null);
});
void it("weights absences by duration and caps recovered minutes", () => {
  const result = absenceSummary([
    {
      heldMinutes: 60,
      absentMinutes: 60,
      compensatedMinutes: 90,
      missingRows: 0,
      due: 1,
      confirmed: 1,
    },
    {
      heldMinutes: 180,
      absentMinutes: 0,
      compensatedMinutes: 0,
      missingRows: 0,
      due: 3,
      confirmed: 3,
    },
  ]);
  assert.equal(result.percent, 25);
  assert.equal(result.compensatedMinutes, 60);
  assert.equal(result.remainingPercent, 0);
  assert.equal(result.confirmed, 4);
});
void it("uses inclusive responsibility start and exclusive transfer or departure", () => {
  const window = { start: new Date("2026-08-01"), end: new Date("2026-09-01") };
  assert.equal(inWindow(new Date("2026-07-31"), window), false);
  assert.equal(inWindow(new Date("2026-08-01"), window), true);
  assert.equal(inWindow(new Date("2026-09-01"), window), false);
});
