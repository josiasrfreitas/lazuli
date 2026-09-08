import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { intersectEnrollmentSemesterWindows } from "../src/window-intersection.js";

const SEMESTER_START = new Date("2026-02-01T00:00:00.000Z");
const SEMESTER_END = new Date("2026-06-30T00:00:00.000Z");
const ENROLLMENT_ENTRY = new Date("2026-02-15T00:00:00.000Z");
const ENROLLMENT_EXIT = new Date("2026-04-10T00:00:00.000Z");

void describe("intersectEnrollmentSemesterWindows", () => {
  void it("starts at the later entry boundary and caps an open enrollment at semester end", () => {
    const result = intersectEnrollmentSemesterWindows({
      enrollment: { entryDate: ENROLLMENT_ENTRY, exitDate: null },
      semester: { startDate: SEMESTER_START, endDate: SEMESTER_END },
    });

    assert.deepEqual(result, { startDate: ENROLLMENT_ENTRY, endDate: SEMESTER_END });
  });

  void it("starts at semester start and ends at the earlier enrollment exit", () => {
    const result = intersectEnrollmentSemesterWindows({
      enrollment: {
        entryDate: new Date("2026-01-15T00:00:00.000Z"),
        exitDate: ENROLLMENT_EXIT,
      },
      semester: { startDate: SEMESTER_START, endDate: SEMESTER_END },
    });

    assert.deepEqual(result, { startDate: SEMESTER_START, endDate: ENROLLMENT_EXIT });
  });

  void it("keeps equal enrollment and semester endpoints inside the inclusive window", () => {
    const result = intersectEnrollmentSemesterWindows({
      enrollment: { entryDate: SEMESTER_START, exitDate: SEMESTER_START },
      semester: { startDate: SEMESTER_START, endDate: SEMESTER_END },
    });

    assert.deepEqual(result, { startDate: SEMESTER_START, endDate: SEMESTER_START });
  });

  void it("returns no window when the enrollment starts after semester end", () => {
    const result = intersectEnrollmentSemesterWindows({
      enrollment: {
        entryDate: new Date("2026-07-01T00:00:00.000Z"),
        exitDate: null,
      },
      semester: { startDate: SEMESTER_START, endDate: SEMESTER_END },
    });

    assert.equal(result, null);
  });
});
