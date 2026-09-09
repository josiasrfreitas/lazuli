import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  attendanceConfirmSessionInputSchema,
  attendanceEditSessionInputSchema,
  attendanceEnrollmentSemesterPercentInputSchema,
  attendanceSessionRosterInputSchema,
  attendanceStatusSchema,
} from "../src/attendance.js";

const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const ENROLLMENT_ID = "22222222-2222-4222-8222-222222222222";
const SEMESTER_ID = "33333333-3333-4333-8333-333333333333";

void describe("attendance lookup input", () => {
  void it("accepts roster and percent lookup identifiers only as UUIDs", () => {
    const roster = attendanceSessionRosterInputSchema.parse({ sessionId: SESSION_ID });
    const percent = attendanceEnrollmentSemesterPercentInputSchema.parse({
      enrollmentId: ENROLLMENT_ID,
      semesterId: SEMESTER_ID,
    });

    assert.equal(roster.sessionId, SESSION_ID);
    assert.equal(percent.semesterId, SEMESTER_ID);
    assert.equal(
      attendanceSessionRosterInputSchema.safeParse({ sessionId: "not-a-uuid" }).success,
      false,
    );
    assert.equal(
      attendanceEnrollmentSemesterPercentInputSchema.safeParse({
        enrollmentId: ENROLLMENT_ID,
        semesterId: "not-a-uuid",
      }).success,
      false,
    );
  });

  void it("keeps the MVP attendance status set to PRESENT and ABSENT", () => {
    assert.equal(attendanceStatusSchema.safeParse("PRESENT").success, true);
    assert.equal(attendanceStatusSchema.safeParse("ABSENT").success, true);
    assert.equal(attendanceStatusSchema.safeParse("LATE").success, false);
  });
});

void describe("attendance session input", () => {
  void it("allows first confirm with an empty rows list", () => {
    const parsed = attendanceConfirmSessionInputSchema.parse({
      sessionId: SESSION_ID,
      rows: [],
    });

    assert.equal(parsed.rows.length, 0);
  });

  void it("accepts explicit confirm rows with enrollment ids and statuses", () => {
    const parsed = attendanceConfirmSessionInputSchema.parse({
      sessionId: SESSION_ID,
      rows: [{ enrollmentId: ENROLLMENT_ID, status: "ABSENT" }],
    });

    assert.equal(parsed.rows[0]?.enrollmentId, ENROLLMENT_ID);
    assert.equal(parsed.rows[0]?.status, "ABSENT");
  });

  void it("rejects unknown fields inside attendance rows", () => {
    const result = attendanceConfirmSessionInputSchema.safeParse({
      sessionId: SESSION_ID,
      rows: [{ enrollmentId: ENROLLMENT_ID, status: "PRESENT", note: "extra" }],
    });

    assert.equal(result.success, false);
  });

  void it("requires at least one explicit row when editing a session", () => {
    const result = attendanceEditSessionInputSchema.safeParse({
      sessionId: SESSION_ID,
      rows: [],
    });

    assert.equal(result.error?.issues[0]?.message, "Informe ao menos uma alteracao.");
    assert.deepEqual(result.error?.issues[0]?.path, ["rows"]);
  });
});
