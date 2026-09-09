import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  enrollmentAdvanceStageInputSchema,
  enrollmentCloseInputSchema,
  enrollmentCreateInputSchema,
  enrollmentTransferInputSchema,
} from "../src/enrollment.js";

const STUDENT_ID = "11111111-1111-4111-8111-111111111111";
const CLASS_ID = "22222222-2222-4222-8222-222222222222";
const ENROLLMENT_ID = "33333333-3333-4333-8333-333333333333";

void describe("enrollmentCreateInputSchema", () => {
  void it("accepts a minimal student+class enrollment", () => {
    const parsed = enrollmentCreateInputSchema.parse({
      studentId: STUDENT_ID,
      classId: CLASS_ID,
    });

    assert.equal(parsed.studentId, STUDENT_ID);
    assert.equal(parsed.classId, CLASS_ID);
    assert.equal(parsed.entryDate, undefined);
    assert.equal(parsed.stageId, undefined);
    assert.equal(parsed.capacityOverrideReason, undefined);
  });

  void it("rejects non-UUID identifiers", () => {
    assert.equal(
      enrollmentCreateInputSchema.safeParse({ studentId: "not-a-uuid", classId: CLASS_ID }).success,
      false,
    );
    assert.equal(
      enrollmentCreateInputSchema.safeParse({ studentId: STUDENT_ID, classId: "nope" }).success,
      false,
    );
  });

  void it("rejects a whitespace-only capacity override reason", () => {
    const result = enrollmentCreateInputSchema.safeParse({
      studentId: STUDENT_ID,
      classId: CLASS_ID,
      capacityOverrideReason: "   ",
    });

    assert.equal(result.success, false);
  });

  void it("coerces an ISO entry date into a Date", () => {
    const parsed = enrollmentCreateInputSchema.parse({
      studentId: STUDENT_ID,
      classId: CLASS_ID,
      entryDate: "2026-03-01",
    });

    assert.equal(parsed.entryDate instanceof Date, true);
    assert.equal(parsed.entryDate?.toISOString(), "2026-03-01T00:00:00.000Z");
  });
});

void describe("enrollmentAdvanceStageInputSchema", () => {
  void it("accepts a valid enrollment id", () => {
    const parsed = enrollmentAdvanceStageInputSchema.parse({ enrollmentId: ENROLLMENT_ID });

    assert.equal(parsed.enrollmentId, ENROLLMENT_ID);
  });

  void it("rejects a non-UUID enrollment id", () => {
    assert.equal(
      enrollmentAdvanceStageInputSchema.safeParse({ enrollmentId: "not-a-uuid" }).success,
      false,
    );
  });

  void it("rejects unknown keys", () => {
    assert.equal(
      enrollmentAdvanceStageInputSchema.safeParse({
        enrollmentId: ENROLLMENT_ID,
        stageId: CLASS_ID,
      }).success,
      false,
    );
  });
});

void describe("enrollmentTransferInputSchema", () => {
  void it("accepts a minimal transfer", () => {
    const parsed = enrollmentTransferInputSchema.parse({
      enrollmentId: ENROLLMENT_ID,
      targetClassId: CLASS_ID,
    });

    assert.equal(parsed.enrollmentId, ENROLLMENT_ID);
    assert.equal(parsed.targetClassId, CLASS_ID);
    assert.equal(parsed.entryDate, undefined);
    assert.equal(parsed.capacityOverrideReason, undefined);
  });

  void it("rejects a non-UUID target class id", () => {
    assert.equal(
      enrollmentTransferInputSchema.safeParse({
        enrollmentId: ENROLLMENT_ID,
        targetClassId: "nope",
      }).success,
      false,
    );
  });

  void it("rejects unknown keys", () => {
    assert.equal(
      enrollmentTransferInputSchema.safeParse({
        enrollmentId: ENROLLMENT_ID,
        targetClassId: CLASS_ID,
        stageId: CLASS_ID,
      }).success,
      false,
    );
  });
});

void describe("enrollmentCloseInputSchema", () => {
  void it("accepts DROPPED and SUSPENDED reasons", () => {
    const dropped = enrollmentCloseInputSchema.parse({
      enrollmentId: ENROLLMENT_ID,
      reason: "DROPPED",
    });
    const suspended = enrollmentCloseInputSchema.parse({
      enrollmentId: ENROLLMENT_ID,
      reason: "SUSPENDED",
    });

    assert.equal(dropped.reason, "DROPPED");
    assert.equal(suspended.reason, "SUSPENDED");
  });

  void it("rejects an unsupported reason", () => {
    assert.equal(
      enrollmentCloseInputSchema.safeParse({
        enrollmentId: ENROLLMENT_ID,
        reason: "TRANSFERRED",
      }).success,
      false,
    );
  });

  void it("rejects a missing reason", () => {
    assert.equal(
      enrollmentCloseInputSchema.safeParse({ enrollmentId: ENROLLMENT_ID }).success,
      false,
    );
  });
});
