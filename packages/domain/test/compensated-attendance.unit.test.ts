import assert from "node:assert/strict";
import { it } from "node:test";
import { computeCompensatedAttendance } from "../src/compensated-attendance.js";

void it("weights different lesson lengths and adds only completed absence compensation", () => {
  // 120 present + 45 made up, against 120 + 90 scheduled minutes: 78.57%, above 75%.
  const result = computeCompensatedAttendance([
    { minutes: 120, status: "PRESENT", compensatedMinutes: 0 },
    { minutes: 90, status: "ABSENT", compensatedMinutes: 45 },
  ]);
  assert.equal(result.percent, 165 / 210);
  assert.equal(result.flagged, false);
  assert.equal(result.missingMinutes, 45);
  assert.equal(result.compensatedMinutes, 45);
  assert.equal(result.heldMinutes, 210);
  assert.equal(result.presentCount, 1);
  assert.equal(result.heldSessions, 2);
});
void it("preserves the original absence count when a partial makeup remains below the threshold", () => {
  const result = computeCompensatedAttendance([
    { minutes: 90, status: "ABSENT", compensatedMinutes: 45 },
  ]);
  assert.equal(result.percent, 0.5);
  assert.equal(result.flagged, true);
  assert.equal(result.presentCount, 0);
  assert.equal(result.missingMinutes, 45);
});
void it("ignores old compensation when an absence is corrected to present and caps duplicated legacy minutes", () => {
  const result = computeCompensatedAttendance([
    { minutes: 90, status: "PRESENT", compensatedMinutes: 90 },
    { minutes: 60, status: "ABSENT", compensatedMinutes: 120 },
    { minutes: 60, status: null, compensatedMinutes: 60 },
  ]);
  assert.equal(result.presentMinutes, 90);
  assert.equal(result.compensatedMinutes, 60);
  assert.equal(result.percent, 150 / 210);
  assert.equal(result.missingMinutes, 60);
});
void it("keeps an empty semester distinguishable from zero attendance", () => {
  const result = computeCompensatedAttendance([]);
  assert.equal(result.percent, null);
  assert.equal(result.flagged, false);
  assert.equal(result.heldMinutes, 0);
  assert.equal(result.missingMinutes, 0);
});
