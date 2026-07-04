import type { enrollmentTransferInputSchema, z } from "@lazuli/validators";

import { todayDateOnlyInSaoPaulo } from "../students/date-rules.js";
import {
  assertCapacity,
  assertNoDuplicateActiveEnrollment,
  closeActiveEnrollment,
  loadActiveEnrollment,
  loadEnrollableClass,
  openEnrollmentAtStage,
  type ActiveEnrollment,
  type EnrollableClass,
  type EnrollmentDatabase,
  type EnrollmentSummary,
  type ProgressSummary,
} from "./data.js";
import {
  ACTIVE_PROGRESS_NOT_FOUND_MESSAGE,
  ENROLLMENT_ALREADY_CLOSED_MESSAGE,
  REGULAR_CLASS_MISSING_STAGE_MESSAGE,
  TRANSFER_SAME_CLASS_MESSAGE,
  badRequest,
} from "./errors.js";

type EnrollmentTransferInput = z.infer<typeof enrollmentTransferInputSchema>;

export type TransferEnrollmentResult = {
  source: { enrollmentId: string; exitDate: Date };
  enrollment: EnrollmentSummary;
  progress: ProgressSummary;
};

/**
 * Moves a student from one class to another (S-ENR-2), preserving history. Closes the source
 * enrollment + active `PedagogicalProgress` (`TRANSFERRED`) and opens a fresh enrollment + progress
 * on the target class. Target stage: REGULAR copies the target `sharedStageId`; PERSONALIZED carries
 * the student's current stage forward. Past attendance is untouched; the student drops off the old
 * class's future rosters via the enrollment window. Writes no finance rows (spec §5.3). Runs inside
 * the caller's transaction.
 */
export async function transferEnrollment(input: {
  database: EnrollmentDatabase;
  values: EnrollmentTransferInput;
}): Promise<TransferEnrollmentResult> {
  const source = await loadActiveEnrollment({
    database: input.database,
    enrollmentId: input.values.enrollmentId,
    notActiveMessage: ENROLLMENT_ALREADY_CLOSED_MESSAGE,
  });
  const target = await loadEnrollableClass({
    database: input.database,
    classId: input.values.targetClassId,
  });
  if (target.id === source.classId) {
    throw badRequest(TRANSFER_SAME_CLASS_MESSAGE);
  }

  const stageId = resolveTargetStageId({ source, target });

  await assertNoDuplicateActiveEnrollment({
    database: input.database,
    studentId: source.studentId,
    classId: target.id,
  });
  await assertCapacity({
    database: input.database,
    classRow: target,
    capacityOverrideReason: input.values.capacityOverrideReason,
  });

  return moveEnrollment({
    database: input.database,
    source,
    target,
    stageId,
    entryDate: input.values.entryDate ?? new Date(todayDateOnlyInSaoPaulo()),
    capacityOverrideReason: input.values.capacityOverrideReason,
  });
}

function resolveTargetStageId(input: {
  source: ActiveEnrollment;
  target: EnrollableClass;
}): string {
  if (input.target.scheduleType === "REGULAR") {
    if (input.target.sharedStageId === null) {
      // Unreachable: a REGULAR class always has sharedStageId (DB CHECK). Kept for narrowing.
      throw badRequest(REGULAR_CLASS_MISSING_STAGE_MESSAGE);
    }
    return input.target.sharedStageId;
  }

  // PERSONALIZED target: carry the student's current stage forward (S-ENR-2).
  const [activeProgress] = input.source.progressRecords;
  if (activeProgress === undefined) {
    throw badRequest(ACTIVE_PROGRESS_NOT_FOUND_MESSAGE);
  }
  return activeProgress.stageId;
}

async function moveEnrollment(input: {
  database: EnrollmentDatabase;
  source: ActiveEnrollment;
  target: EnrollableClass;
  stageId: string;
  entryDate: Date;
  capacityOverrideReason: string | undefined;
}): Promise<TransferEnrollmentResult> {
  // Close the source first so a same-track move never trips the one-active-enrollment-per-track guard
  // or the (studentId, classId) active partial unique index. Old close date = new entry date.
  await closeActiveEnrollment({
    database: input.database,
    enrollmentId: input.source.id,
    effectiveDate: input.entryDate,
    reason: "TRANSFERRED",
  });
  const opened = await openEnrollmentAtStage({
    database: input.database,
    studentId: input.source.studentId,
    classId: input.target.id,
    entryDate: input.entryDate,
    stageId: input.stageId,
    capacityOverrideReason: input.capacityOverrideReason,
  });

  return {
    source: { enrollmentId: input.source.id, exitDate: input.entryDate },
    enrollment: opened.enrollment,
    progress: opened.progress,
  };
}
