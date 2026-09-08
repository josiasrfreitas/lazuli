import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  resolveSemesterForDate,
  SemesterBucketError,
  type SemesterWindow,
} from "../src/semester.js";

const FIRST_SEMESTER: SemesterWindow = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "2026.1",
  startDate: new Date("2026-02-01"),
  endDate: new Date("2026-06-30"),
};

void describe("resolveSemesterForDate", () => {
  void it("returns the semester whose window contains the date", () => {
    const semester = resolveSemesterForDate(new Date("2026-03-15"), [FIRST_SEMESTER]);

    assert.equal(semester.name, "2026.1");
  });

  void it("surfaces a setup error when no semester contains the date", () => {
    let error!: SemesterBucketError;
    assert.throws(
      () => resolveSemesterForDate(new Date("2026-07-15T00:00:00.000Z"), []),
      (candidate: unknown) => {
        error = candidate as SemesterBucketError;
        return candidate instanceof SemesterBucketError;
      },
    );

    assert.equal(error.name, "SemesterBucketError");
    assert.equal(error.code, "NO_SEMESTER");
    assert.equal(error.message, "Date maps to no semester window(s).");
  });

  void it("treats both window endpoints as inside the semester", () => {
    const onStart = resolveSemesterForDate(FIRST_SEMESTER.startDate, [FIRST_SEMESTER]);
    const onEnd = resolveSemesterForDate(FIRST_SEMESTER.endDate, [FIRST_SEMESTER]);

    assert.equal(onStart.name, "2026.1");
    assert.equal(onEnd.name, "2026.1");
  });

  void it("excludes the day after the window end", () => {
    assert.throws(
      () => resolveSemesterForDate(new Date("2026-07-01"), [FIRST_SEMESTER]),
      SemesterBucketError,
    );
  });

  void it("surfaces a setup error when the date maps to multiple semesters", () => {
    const overlappingSemester: SemesterWindow = {
      id: "22222222-2222-2222-2222-222222222222",
      name: "2026.1-dup",
      startDate: new Date("2026-06-01"),
      endDate: new Date("2026-08-31"),
    };

    let error!: SemesterBucketError;
    assert.throws(
      () => resolveSemesterForDate(new Date("2026-06-15"), [FIRST_SEMESTER, overlappingSemester]),
      (candidate: unknown) => {
        error = candidate as SemesterBucketError;
        return candidate instanceof SemesterBucketError;
      },
    );

    assert.equal(error.name, "SemesterBucketError");
    assert.equal(error.code, "MULTIPLE_SEMESTERS");
    assert.equal(error.message, "Date maps to multiple semester window(s).");
  });
});

void describe("resolveSemesterForDate start boundary", () => {
  void it("rejects the day before the semester starts", () => {
    assert.throws(
      () => resolveSemesterForDate(new Date("2026-01-31"), [FIRST_SEMESTER]),
      (candidate: unknown) =>
        candidate instanceof SemesterBucketError && candidate.code === "NO_SEMESTER",
    );
  });
});
