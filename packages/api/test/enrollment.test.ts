import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { TRPCError } from "@trpc/server";

import { enrollmentCreateInputSchema } from "@lazuli/validators";

import { createCaller } from "@lazuli/api";

import { ADMIN_FIXTURE, TEACHER_FIXTURE, contextFor } from "./support.js";

const FORBIDDEN = "FORBIDDEN" as const;
const UNAUTHORIZED = "UNAUTHORIZED" as const;

const STUDENT_ID = "11111111-1111-4111-8111-111111111111";
const CLASS_ID = "22222222-2222-4222-8222-222222222222";

function isTRPCError(code: TRPCError["code"]): (error: unknown) => boolean {
  return (error) => error instanceof TRPCError && error.code === code;
}

function isNotGateError(error: unknown): boolean {
  return !(error instanceof TRPCError && (error.code === FORBIDDEN || error.code === UNAUTHORIZED));
}

void describe("enrollment.create role gate", () => {
  // Invalid input so ADMIN fails at input parsing (after the gate), never touching the db.
  const invalidInput = {} as never;

  void it("rejects TEACHER with FORBIDDEN", async () => {
    await assert.rejects(
      createCaller(contextFor(TEACHER_FIXTURE)).enrollment.create(invalidInput),
      isTRPCError(FORBIDDEN),
    );
  });

  void it("rejects an anonymous caller with UNAUTHORIZED", async () => {
    await assert.rejects(
      createCaller(contextFor(null)).enrollment.create(invalidInput),
      isTRPCError(UNAUTHORIZED),
    );
  });

  void it("lets ADMIN past the gate (fails later on input, not on the gate)", async () => {
    await assert.rejects(
      createCaller(contextFor(ADMIN_FIXTURE)).enrollment.create(invalidInput),
      isNotGateError,
    );
  });
});

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

    assert.ok(parsed.entryDate instanceof Date);
  });
});
