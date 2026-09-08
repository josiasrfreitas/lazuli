import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { computeAttendancePercent } from "../src/attendance-percent.js";

const SEVENTY_PERCENT = 0.7;
const SEVENTY_FIVE_PERCENT = 0.75;

void describe("computeAttendancePercent", () => {
  void it("renders 'sem dados' (null percent, not flagged) with no held sessions", () => {
    const result = computeAttendancePercent({ heldSessions: 0, presentCount: 0 });

    assert.equal(result.percent, null);
    assert.equal(result.flagged, false);
  });

  void it("flags an enrollment below the 75% minimum", () => {
    const result = computeAttendancePercent({ heldSessions: 10, presentCount: 7 });

    assert.equal(result.percent, SEVENTY_PERCENT);
    assert.equal(result.flagged, true);
  });

  void it("does not flag an enrollment at or above 75%", () => {
    const result = computeAttendancePercent({ heldSessions: 4, presentCount: 3 });

    assert.equal(result.percent, SEVENTY_FIVE_PERCENT);
    assert.equal(result.flagged, false);
  });

  void it("flags a held-but-never-present enrollment", () => {
    const result = computeAttendancePercent({ heldSessions: 3, presentCount: 0 });

    assert.equal(result.percent, 0);
    assert.equal(result.flagged, true);
  });

  void it("honours a custom minimum threshold", () => {
    const result = computeAttendancePercent({ heldSessions: 10, presentCount: 6, minPct: 0.5 });

    assert.equal(result.flagged, false);
  });
});
