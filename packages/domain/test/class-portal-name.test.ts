import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { generateRegularPortalClassName } from "../src/class-portal-name.js";

void describe("generateRegularPortalClassName", () => {
  void it("builds the PRD example shape from structured fields", () => {
    const name = generateRegularPortalClassName({
      stageInternalCode: "TUI",
      slots: [{ weekday: "TUESDAY", startTime: "14:00", endTime: "16:00" }],
      semesterName: "2026.1",
      year: 2026,
      sequence: 1,
    });

    assert.equal(name, "REG/TUI-TER-14:00/16:00-1S/26-1");
  });

  void it("uses the first slot when sorted by weekday then start time", () => {
    const name = generateRegularPortalClassName({
      stageInternalCode: "C4",
      slots: [
        { weekday: "WEDNESDAY", startTime: "10:00", endTime: "11:30" },
        { weekday: "MONDAY", startTime: "09:00", endTime: "10:30" },
      ],
      semesterName: "2026.2",
      year: 2026,
      sequence: 2,
    });

    assert.equal(name, "REG/C4-SEG-09:00/10:30-2S/26-2");
  });

  void it("appends the disambiguation sequence suffix", () => {
    const name = generateRegularPortalClassName({
      stageInternalCode: "TUI",
      slots: [{ weekday: "TUESDAY", startTime: "14:00", endTime: "16:00" }],
      semesterName: "2026.1",
      year: 2026,
      sequence: 3,
    });

    assert.equal(name, "REG/TUI-TER-14:00/16:00-1S/26-3");
  });
});
