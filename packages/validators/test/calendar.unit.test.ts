import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  addClosedDayInputSchema,
  calendarDateSchema,
  calendarYearSchema,
  closedDayReasonSchema,
  createSemesterInputSchema,
  importBrazilFederalHolidaysInputSchema,
  removeClosedDayInputSchema,
} from "../src/calendar.js";

const SEMESTER_START = "2026-08-01";
const MIN_VALID_YEAR = 2000;
const MAX_VALID_YEAR = 2100;
const YEAR_BEFORE_RANGE = 1999;
const YEAR_AFTER_RANGE = 2101;
const FRACTIONAL_YEAR = 2026.5;
const CLOSED_DAY_REASON_TOO_LONG_LENGTH = 161;
const HOLIDAY_IMPORT_YEAR = 2027;
const TIRADENTES_DATE = "2027-04-21";
const LONG_REASON = "x".repeat(CLOSED_DAY_REASON_TOO_LONG_LENGTH);

void describe("calendar shared inputs", () => {
  void it("accepts only integer years from 2000 through 2100", () => {
    assert.equal(calendarYearSchema.safeParse(MIN_VALID_YEAR).success, true);
    assert.equal(calendarYearSchema.safeParse(MAX_VALID_YEAR).success, true);
    assert.equal(calendarYearSchema.safeParse(YEAR_BEFORE_RANGE).success, false);
    assert.equal(calendarYearSchema.safeParse(YEAR_AFTER_RANGE).success, false);
    assert.equal(calendarYearSchema.safeParse(FRACTIONAL_YEAR).success, false);
  });

  void it("accepts only real yyyy-mm-dd calendar dates", () => {
    assert.equal(calendarDateSchema.safeParse("2026-02-28").success, true);
    assert.equal(calendarDateSchema.safeParse("00002026-02-28").success, false);
    assert.equal(calendarDateSchema.safeParse("2026-02-28-01").success, false);
    assert.equal(calendarDateSchema.safeParse("2026-02-30").success, false);
    assert.equal(calendarDateSchema.safeParse("0000-02-28").success, false);
    assert.equal(calendarDateSchema.safeParse("2026-00-10").success, false);
  });

  void it("trims closed-day reasons and enforces the note length limit", () => {
    const parsed = closedDayReasonSchema.parse(" Feriado municipal ");

    assert.equal(parsed, "Feriado municipal");
    assert.equal(closedDayReasonSchema.safeParse("   ").success, false);
    assert.equal(closedDayReasonSchema.safeParse(LONG_REASON).success, false);
  });

  void it("validates import, add, and remove inputs with the shared calendar fields", () => {
    const imported = importBrazilFederalHolidaysInputSchema.parse({ year: HOLIDAY_IMPORT_YEAR });
    const added = addClosedDayInputSchema.parse({
      date: TIRADENTES_DATE,
      reason: " Tiradentes ",
    });
    const removed = removeClosedDayInputSchema.parse({ date: TIRADENTES_DATE });

    assert.equal(imported.year, HOLIDAY_IMPORT_YEAR);
    assert.equal(added.reason, "Tiradentes");
    assert.equal(removed.date, TIRADENTES_DATE);
    assert.equal(addClosedDayInputSchema.safeParse({ date: TIRADENTES_DATE }).success, false);
    assert.equal(removeClosedDayInputSchema.safeParse({ date: "2027-02-30" }).success, false);
  });
});

void describe("semester input", () => {
  void it("rejects an end date before the start date", () => {
    const result = createSemesterInputSchema.safeParse({
      name: "2026.2",
      startDate: SEMESTER_START,
      endDate: "2026-07-31",
    });

    assert.deepEqual(result.error?.issues, [
      {
        code: "custom",
        message: "Data inicial deve ser anterior ou igual a data final.",
        path: ["endDate"],
      },
    ]);
  });

  void it("accepts a semester that starts and ends on the same date", () => {
    const result = createSemesterInputSchema.safeParse({
      name: "Intensivo",
      startDate: SEMESTER_START,
      endDate: SEMESTER_START,
    });

    assert.equal(result.success, true);
  });

  void it("trims the semester name before checking it is filled", () => {
    const result = createSemesterInputSchema.parse({
      name: " Intensivo ",
      startDate: SEMESTER_START,
      endDate: SEMESTER_START,
    });

    assert.equal(result.name, "Intensivo");
  });
});
