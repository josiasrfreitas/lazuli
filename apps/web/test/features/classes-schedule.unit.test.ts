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

void test("groups matching weekdays into shift codes while preserving exact partial-hour times", () => {
  const slots = [slot("TUESDAY", ["19:00", "20:30"]), slot("THURSDAY", ["19:00", "20:30"])];
  assert.equal(formatClassSchedule(slots), "3N2-5N3");
  assert.equal(formatClassScheduleTime(slots), "Ter 19:00–20:30, Qui 19:00–20:30");
});

void test("numbers each shift independently and excludes the block beginning at the end time", () => {
  assert.equal(formatClassSchedule([slot("MONDAY", ["06:00", "07:00"])]), "2M1");
  assert.equal(formatClassSchedule([slot("TUESDAY", ["12:00", "13:00"])]), "3T1");
  assert.equal(formatClassSchedule([slot("WEDNESDAY", ["18:00", "19:00"])]), "4N1");
  assert.equal(formatClassSchedule([slot("SATURDAY", ["09:00", "12:00"])]), "7M4-7M6");
  assert.equal(formatClassSchedule([slot("MONDAY", ["15:30", "17:00"])]), "2T4-2T5");
  assert.equal(formatClassSchedule([slot("FRIDAY", ["11:30", "13:00"])]), "6M6-6T1");
});

void test("keeps different exact intervals separate and preserves schedules outside defined shifts", () => {
  assert.equal(
    formatClassSchedule([
      slot("TUESDAY", ["19:00", "20:00"]),
      slot("THURSDAY", ["19:30", "20:00"]),
    ]),
    "3N2, 5N2",
  );
  assert.equal(formatClassSchedule([slot("MONDAY", ["05:00", "07:00"])]), "2 05:00–07:00");
  assert.equal(formatClassSchedule([]), "");
});
