import assert from "node:assert/strict";
import { it } from "node:test";
import { compactSchedule } from "../../src/features/class-organization/shared.js";

void it("groups weekdays only when both start and end times match", () => {
  const label = compactSchedule([
    { weekday: "MONDAY", startTime: "19:00", endTime: "20:30" },
    { weekday: "TUESDAY", startTime: "19:00", endTime: "20:00" },
    { weekday: "THURSDAY", startTime: "19:00", endTime: "20:30" },
  ]);

  assert.equal(label, "Seg e qui · 19:00–20:30 / Ter · 19:00–20:00");
});

void it("preserves an undefined timetable and a single Saturday slot", () => {
  assert.equal(compactSchedule([]), "");
  assert.equal(
    compactSchedule([{ weekday: "SATURDAY", startTime: "09:00", endTime: "10:30" }]),
    "Sáb · 09:00–10:30",
  );
});
