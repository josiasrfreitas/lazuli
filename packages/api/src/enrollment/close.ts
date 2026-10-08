import { saoPauloDateOnly } from "@lazuli/domain";
import { dateOnlyUtc } from "./effective-date.js";
import { closeActiveEnrollment, loadActiveEnrollment, type EnrollmentDatabase } from "./data.js";
import { ENROLLMENT_ALREADY_CLOSED_MESSAGE } from "./errors.js";
import { badRequest } from "../trpc/errors.js";

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
  effectiveDate?: Date;
  staffUserId: string;
  now: Date;
}): Promise<CloseEnrollmentResult> {
  const active = await loadActiveEnrollment({
    database: input.database,
    enrollmentId: input.enrollmentId,
    notActiveMessage: ENROLLMENT_ALREADY_CLOSED_MESSAGE,
  });

  const today = saoPauloDateOnly(input.now);
  const effectiveDate = input.effectiveDate ?? new Date(today);
  const day = dateOnlyUtc(effectiveDate);
  if (day < today || day < dateOnlyUtc(active.entryDate)) {
    throw badRequest("A data efetiva deve ser hoje ou futura, após a entrada.");
  }
  const scheduled = await input.database.enrollmentAction.count({
    where: {
      enrollmentId: input.enrollmentId,
      kind: { in: ["PAUSE", "EXIT"] },
      status: "SCHEDULED",
    },
  });
  if (scheduled > 0) throw badRequest("Já existe uma saída programada para este vínculo.");
  if (day === today) {
    await closeActiveEnrollment({
      database: input.database,
      enrollmentId: input.enrollmentId,
      effectiveDate,
      reason: input.reason,
    });
  }
  await input.database.enrollmentAction.create({
    data: {
      enrollmentId: input.enrollmentId,
      kind: input.reason === "SUSPENDED" ? "PAUSE" : "EXIT",
      status: day === today ? "APPLIED" : "SCHEDULED",
      effectiveDate,
      recordedById: input.staffUserId,
    },
  });

  return { enrollmentId: input.enrollmentId, exitDate: effectiveDate, exitReason: input.reason };
}
