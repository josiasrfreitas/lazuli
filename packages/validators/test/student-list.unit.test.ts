import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_STUDENT_PAGE_SIZE,
  studentListInputSchema,
  studentListOutputSchema,
  studentListRowSchema,
} from "../src/student-list.js";

const STUDENT_ID = "11111111-1111-4111-8111-111111111111";
const CLASS_ID = "22222222-2222-4222-8222-222222222222";
const ENROLLMENT_ID = "33333333-3333-4333-8333-333333333333";
const SEARCH_TOO_LONG_LENGTH = 81;
const LONG_SEARCH = "x".repeat(SEARCH_TOO_LONG_LENGTH);
const LEAP_DAY = "2024-02-29";

const ENROLLMENT = {
  enrollmentId: ENROLLMENT_ID,
  classId: CLASS_ID,
  classCode: "GRE-29",
  scheduleLabel: "Ter e Qui - 19:00",
  teacherName: "Camila",
};

const BASE_ROW = {
  id: STUDENT_ID,
  fullName: "Ana Souza",
  isMinor: false,
  status: "ACTIVE",
  phone: null,
  enrollment: ENROLLMENT,
  attendance: { percent: 0.75, flagged: false },
  finance: { kind: "none" },
};

void describe("student list input", () => {
  void it("defaults list filters and trims the search term", () => {
    const parsed = studentListInputSchema.parse({ search: " Ana " });
    const active = studentListInputSchema.parse({ status: "active" });
    const inactive = studentListInputSchema.parse({ status: "inactive" });

    assert.equal(parsed.page, 1);
    assert.equal(parsed.pageSize, DEFAULT_STUDENT_PAGE_SIZE);
    assert.equal(parsed.status, "all");
    assert.equal(parsed.search, "Ana");
    assert.equal(active.status, "active");
    assert.equal(inactive.status, "inactive");
  });

  void it("rejects unsupported paging, status, and search values", () => {
    assert.equal(studentListInputSchema.safeParse({ page: 0 }).success, false);
    assert.equal(studentListInputSchema.safeParse({ pageSize: 20 }).success, false);
    assert.equal(studentListInputSchema.safeParse({ status: "paused" }).success, false);
    assert.equal(studentListInputSchema.safeParse({ search: LONG_SEARCH }).success, false);
  });

  void it("validates situation, IDs, and registered-date bounds", () => {
    const valid = studentListInputSchema.parse({
      situations: ["active", "inactive"],
      classIds: [CLASS_ID],
      teacherIds: [STUDENT_ID],
      registeredFrom: LEAP_DAY,
      registeredTo: LEAP_DAY,
    });
    assert.deepEqual(valid.situations, ["active", "inactive"]);
    assert.equal(valid.registeredTo, LEAP_DAY);
    assert.equal(studentListInputSchema.safeParse({ situations: ["unknown"] }).success, false);
    assert.equal(studentListInputSchema.safeParse({ classIds: ["bad"] }).success, false);
    assert.equal(studentListInputSchema.safeParse({ teacherIds: ["bad"] }).success, false);
    assert.equal(
      studentListInputSchema.safeParse({ registeredFrom: "2024-03-01", registeredTo: LEAP_DAY })
        .success,
      false,
    );
    assert.equal(studentListInputSchema.safeParse({ registeredFrom: "2024-02-30" }).success, false);
  });
});

void describe("student list row output", () => {
  void it("accepts nullable enrollment and overdue finance rows", () => {
    const parsed = studentListRowSchema.parse({
      ...BASE_ROW,
      enrollment: null,
      finance: { kind: "overdue", overdueCents: 12_500 },
    });

    assert.equal(parsed.enrollment, null);
    assert.deepEqual(parsed.finance, { kind: "overdue", overdueCents: 12_500 });
  });
});

void describe("student list paginated output", () => {
  void it("accepts the full paginated output contract", () => {
    const parsed = studentListOutputSchema.parse({
      rows: [
        BASE_ROW,
        {
          ...BASE_ROW,
          id: "44444444-4444-4444-8444-444444444444",
          fullName: "Bruno Silva",
          status: "SUSPENDED",
          finance: { kind: "upToDate" },
        },
      ],
      page: 1,
      pageSize: 25,
      pageCount: 1,
      total: 2,
      counts: { all: 2, active: 1, inactive: 1 },
      totalStudents: 2,
      activeClasses: 1,
    });

    assert.equal(parsed.rows.length, 2);
    assert.equal(parsed.counts.inactive, 1);
  });

  void it("rejects invalid output rows instead of hiding malformed read models", () => {
    assert.equal(
      studentListRowSchema.safeParse({
        ...BASE_ROW,
        finance: { kind: "overdue" },
      }).success,
      false,
    );
    assert.equal(
      studentListOutputSchema.safeParse({
        rows: [BASE_ROW],
        page: 1,
        pageSize: 25,
        pageCount: 1,
        total: 1,
        counts: { all: 1, active: 0.5, inactive: 0 },
        totalStudents: 1,
        activeClasses: 1,
      }).success,
      false,
    );
  });
});
