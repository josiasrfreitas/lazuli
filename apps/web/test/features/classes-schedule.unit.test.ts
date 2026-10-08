import assert from "node:assert/strict";
import test from "node:test";
import {
  formatClassSchedule,
  formatClassScheduleTime,
  type ScheduleSlot,
} from "../../src/features/classes/labels.js";

function slot(weekday: string, [start, end]: [string, string]): ScheduleSlot {
  return {
    weekday,
    startTime: new Date(`1970-01-01T${start}:00Z`),
    endTime: new Date(`1970-01-01T${end}:00Z`),
  };
}

void test("groups matching weekdays and preserves exact partial-hour times", () => {
  const slots = [slot("MONDAY", ["17:00", "19:00"]), slot("THURSDAY", ["17:00", "19:00"])];
  assert.equal(formatClassSchedule(slots), "Seg/Qui • 17:00 - 19:00");
  assert.equal(formatClassScheduleTime(slots), "Seg 17:00–19:00, Qui 17:00–19:00");
  assert.equal(formatClassSchedule([slot("TUESDAY", ["19:00", "20:30"])]), "Ter • 19:00 - 20:30");
});

void test("keeps different intervals separate without imposing shift boundaries", () => {
  assert.equal(
    formatClassSchedule([
      slot("TUESDAY", ["19:00", "20:00"]),
      slot("THURSDAY", ["19:30", "20:00"]),
    ]),
    "Ter • 19:00 - 20:00, Qui • 19:30 - 20:00",
  );
  assert.equal(formatClassSchedule([slot("MONDAY", ["05:00", "07:00"])]), "Seg • 05:00 - 07:00");
  assert.equal(formatClassSchedule([]), "");
});
