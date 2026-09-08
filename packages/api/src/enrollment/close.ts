import { saoPauloDateOnly } from "@lazuli/domain";
import { closeActiveEnrollment, loadActiveEnrollment, type EnrollmentDatabase } from "./data.js";
import { ENROLLMENT_ALREADY_CLOSED_MESSAGE } from "./errors.js";

export type CloseEnrollmentReason = "DROPPED" | "SUSPENDED";

export type CloseEnrollmentResult = {
  enrollmentId: string;
  exitDate: Date;
  exitReason: CloseEnrollmentReason;
};

/**
 * Drops (`DROPPED`) or pauses (`SUSPENDED`) a single enrollment (S-ENR-3): closes it and its active
 * `PedagogicalProgress` with the given reason, at today's date (`America/Sao_Paulo`). Makes no
 * billing change and does not touch `Student.status` — staff manage those via manual finance tools /
 * `students.setStatus`. Runs inside the caller's transaction so the deferred one-active-progress
 * invariant holds.
 */
export async function closeEnrollment(input: {
  database: EnrollmentDatabase;
  enrollmentId: string;
  reason: CloseEnrollmentReason;
}): Promise<CloseEnrollmentResult> {
  await loadActiveEnrollment({
    database: input.database,
    enrollmentId: input.enrollmentId,
    notActiveMessage: ENROLLMENT_ALREADY_CLOSED_MESSAGE,
  });

  const effectiveDate = new Date(saoPauloDateOnly(new Date()));
  await closeActiveEnrollment({
    database: input.database,
    enrollmentId: input.enrollmentId,
    effectiveDate,
    reason: input.reason,
  });

  return { enrollmentId: input.enrollmentId, exitDate: effectiveDate, exitReason: input.reason };
}
