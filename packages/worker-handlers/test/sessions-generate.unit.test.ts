import assert from "node:assert/strict";
import { it } from "node:test";

import { SemesterBucketError } from "@lazuli/domain";

import { planClassSessionRows } from "../src/index.js";

const CLASS_ID = "00000000-0000-0000-0000-000000000065";
const SLOT_ID = "00000000-0000-0000-0000-000000000165";
const SEMESTER_ID = "00000000-0000-0000-0000-000000000265";
const DATE_ONLY_LENGTH = 10;

void it("plans full-semester rows per matching weekday and skips closed days", () => {
  const rows = planClassSessionRows({
    classes: [
      {
        id: CLASS_ID,
        semester: semesterWindow(),
        scheduleSlots: [
          {
            id: SLOT_ID,
            weekday: "TUESDAY",
            startTime: new Date("1970-01-01T14:00:00.000Z"),
            endTime: new Date("1970-01-01T16:00:00.000Z"),
          },
        ],
      },
    ],
    closedDates: new Set(["2026-03-10"]),
    semesters: [semesterWindow()],
  });

  assert.deepEqual(
    rows.map((row) => row.date.toISOString().slice(0, DATE_ONLY_LENGTH)),
    ["2026-03-03", "2026-03-17"],
  );
});

void it("raises setup errors when a generated date has no semester bucket", () => {
  assert.throws(
    () =>
      planClassSessionRows({
        classes: [classWithNoSlots()],
        closedDates: new Set(),
        semesters: [],
      }),
    SemesterBucketError,
  );
});

void it("raises setup errors when a generated date has multiple semester buckets", () => {
  assert.throws(
    () =>
      planClassSessionRows({
        classes: [classWithNoSlots()],
        closedDates: new Set(),
        semesters: [
          semesterWindow(),
          {
            id: "00000000-0000-0000-0000-000000000365",
            name: "2026 overlap",
            startDate: new Date("2026-03-01T00:00:00.000Z"),
            endDate: new Date("2026-03-31T00:00:00.000Z"),
          },
        ],
      }),
    SemesterBucketError,
  );
});

function classWithNoSlots(): {
  id: string;
  semester: ReturnType<typeof semesterWindow>;
  scheduleSlots: [];
} {
  return {
    id: CLASS_ID,
    semester: semesterWindow(),
    scheduleSlots: [],
  };
}

function semesterWindow(): {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
} {
  return {
    id: SEMESTER_ID,
    name: "2026.1",
    startDate: new Date("2026-03-01T00:00:00.000Z"),
    endDate: new Date("2026-03-17T00:00:00.000Z"),
  };
}
