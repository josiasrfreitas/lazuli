import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { TRPCError } from "@trpc/server";

import { createCaller } from "@lazuli/api";

import { ADMIN_FIXTURE, TEACHER_FIXTURE, contextFor } from "../support/support.js";

const FORBIDDEN = "FORBIDDEN" as const;
const UNAUTHORIZED = "UNAUTHORIZED" as const;

// Invalid input so ADMIN fails at input parsing (after the gate), never touching the db.
const invalidInput = {} as never;

type EnrollmentCaller = ReturnType<typeof createCaller>;

function isTRPCError(code: TRPCError["code"]): (error: unknown) => boolean {
  return (error) => error instanceof TRPCError && error.code === code;
}

function isNotGateError(error: unknown): boolean {
  return !(error instanceof TRPCError && (error.code === FORBIDDEN || error.code === UNAUTHORIZED));
}

/** Every enrollment write is an `adminProcedure`; this asserts the shared gate for each one. */
function describeRoleGate(
  procedureName: string,
  invoke: (caller: EnrollmentCaller) => Promise<unknown>,
): void {
  void describe(`${procedureName} role gate`, () => {
    void it("rejects TEACHER with FORBIDDEN", async () => {
      await assert.rejects(
        invoke(createCaller(contextFor(TEACHER_FIXTURE))),
        isTRPCError(FORBIDDEN),
      );
    });

    void it("rejects an anonymous caller with UNAUTHORIZED", async () => {
      await assert.rejects(invoke(createCaller(contextFor(null))), isTRPCError(UNAUTHORIZED));
    });

    void it("lets ADMIN past the gate (fails later on input, not on the gate)", async () => {
      await assert.rejects(invoke(createCaller(contextFor(ADMIN_FIXTURE))), isNotGateError);
    });
  });
}

describeRoleGate("enrollment.create", (caller) => caller.enrollment.create(invalidInput));
describeRoleGate("enrollment.advanceStage", (caller) =>
  caller.enrollment.advanceStage(invalidInput),
);
describeRoleGate("enrollment.transfer", (caller) => caller.enrollment.transfer(invalidInput));
describeRoleGate("enrollment.close", (caller) => caller.enrollment.close(invalidInput));
