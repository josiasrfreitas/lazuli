import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  makeupCancelInputSchema,
  makeupOutcomeInputSchema,
  makeupScheduleInputSchema,
} from "../src/makeup.js";

const ENROLLMENT_ID = "11111111-1111-4111-8111-111111111111";
const SESSION_ID = "22222222-2222-4222-8222-222222222222";
const MAKEUP_ID = "33333333-3333-4333-8333-333333333333";

void describe("makeup schedule input", () => {
  void it("accepts scheduling with no reason or a trimmed override reason", () => {
    const withoutReason = makeupScheduleInputSchema.parse({
      originEnrollmentId: ENROLLMENT_ID,
      targetClassSessionId: SESSION_ID,
    });
    const withReason = makeupScheduleInputSchema.parse({
      originEnrollmentId: ENROLLMENT_ID,
      targetClassSessionId: SESSION_ID,
      reason: " Aula extra ",
    });

    assert.equal(withoutReason.reason, undefined);
    assert.equal(withReason.reason, "Aula extra");
  });

  void it("rejects invalid scheduling identifiers and blank provided reasons", () => {
    assert.equal(
      makeupScheduleInputSchema.safeParse({
        originEnrollmentId: "not-a-uuid",
        targetClassSessionId: SESSION_ID,
      }).success,
      false,
    );
    assert.equal(
      makeupScheduleInputSchema.safeParse({
        originEnrollmentId: ENROLLMENT_ID,
        targetClassSessionId: SESSION_ID,
        reason: "   ",
      }).success,
      false,
    );
  });
});

void describe("makeup lifecycle input", () => {
  void it("requires a non-blank cancellation reason", () => {
    const parsed = makeupCancelInputSchema.parse({
      makeupId: MAKEUP_ID,
      reason: " Cancelar ",
    });

    assert.equal(parsed.reason, "Cancelar");
    assert.equal(makeupCancelInputSchema.safeParse({ makeupId: MAKEUP_ID }).success, false);
    assert.equal(
      makeupCancelInputSchema.safeParse({ makeupId: MAKEUP_ID, reason: "   " }).success,
      false,
    );
  });

  void it("accepts only boolean makeup outcomes", () => {
    const attended = makeupOutcomeInputSchema.parse({ makeupId: MAKEUP_ID, attended: true });
    const noShow = makeupOutcomeInputSchema.parse({ makeupId: MAKEUP_ID, attended: false });

    assert.equal(attended.attended, true);
    assert.equal(noShow.attended, false);
    assert.equal(
      makeupOutcomeInputSchema.safeParse({ makeupId: MAKEUP_ID, attended: "true" }).success,
      false,
    );
  });
});
