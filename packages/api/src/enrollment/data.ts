import type { Prisma } from "@lazuli/db";
import type { enrollmentCreateInputSchema, z } from "@lazuli/validators";

import { loadActiveStage } from "../classes/guards.js";
import { todayDateOnlyInSaoPaulo } from "../students/date-rules.js";
import {
  CAPACITY_OVERRIDE_REQUIRED_MESSAGE,
  CLASS_ARCHIVED_MESSAGE,
  CLASS_NOT_FOUND_MESSAGE,
  DUPLICATE_ACTIVE_ENROLLMENT_MESSAGE,
  ENROLLMENT_NOT_FOUND_MESSAGE,
  PERSONALIZED_REQUIRES_STAGE_MESSAGE,
  REGULAR_CLASS_MISSING_STAGE_MESSAGE,
  REGULAR_REJECTS_STAGE_MESSAGE,
  STUDENT_NOT_ACTIVE_MESSAGE,
  STUDENT_NOT_FOUND_MESSAGE,
  badRequest,
  notFound,
} from "./errors.js";

type EnrollmentCreateInput = z.infer<typeof enrollmentCreateInputSchema>;

/** Keys touched here plus the ones `loadActiveStage` (classes/guards) structurally requires. */
export type EnrollmentDatabase = Pick<
  Prisma.TransactionClient,
  | "enrollment"
  | "pedagogicalProgress"
  | "class"
  | "student"
  | "stage"
  | "semester"
  | "track"
  | "user"
>;

export type EnrollmentSummary = {
  id: string;
  studentId: string;
  classId: string;
  entryDate: Date;
  capacityOverrideReason: string | null;
};

export type ProgressSummary = {
  id: string;
  stageId: string;
  startDate: Date;
};

export type EnrollmentCreateResult = {
  enrollment: EnrollmentSummary;
  progress: ProgressSummary;
  /** Placeholder for the S-FIN-1 order prompt; enrollment never writes billing (finance is Phase 2). */
  orderPromptRequired: true;
};

export type EnrollableClass = {
  id: string;
  status: "ACTIVE" | "ARCHIVED";
  scheduleType: "REGULAR" | "PERSONALIZED";
  sharedStageId: string | null;
  capacity: number;
};

const enrollmentSummarySelect = {
  id: true,
  studentId: true,
  classId: true,
  entryDate: true,
  capacityOverrideReason: true,
} as const;

export const progressSummarySelect = {
  id: true,
  stageId: true,
  startDate: true,
} as const;

export type EnrollmentCloseReason = "TRANSFERRED" | "DROPPED" | "SUSPENDED";

const activeEnrollmentSelect = {
  id: true,
  studentId: true,
  classId: true,
  exitDate: true,
  class: { select: { scheduleType: true } },
  progressRecords: {
    where: { endDate: null, deletedAt: null },
    select: { stageId: true },
  },
} satisfies Prisma.EnrollmentSelect;

export type ActiveEnrollment = Prisma.EnrollmentGetPayload<{
  select: typeof activeEnrollmentSelect;
}>;

/**
 * Loads an enrollment that must exist and still be active (`exitDate IS NULL`), with its active
 * progress stage and class schedule type. Shared by `transfer` and `close`; `notActiveMessage`
 * lets each caller phrase the already-closed rejection in its own terms.
 */
export async function loadActiveEnrollment(input: {
  database: EnrollmentDatabase;
  enrollmentId: string;
  notActiveMessage: string;
}): Promise<ActiveEnrollment> {
  const enrollment = await input.database.enrollment.findUnique({
    where: { id: input.enrollmentId },
    select: activeEnrollmentSelect,
  });

  if (enrollment === null) {
    throw notFound(ENROLLMENT_NOT_FOUND_MESSAGE);
  }
  if (enrollment.exitDate !== null) {
    throw badRequest(input.notActiveMessage);
  }
  return enrollment;
}

/**
 * Closes an enrollment and its active `PedagogicalProgress` with one reason and effective date.
 * Progress closes first to respect the one-active-progress partial unique index. Writes no finance
 * rows — academic close/transfer never mutates billing (spec §5.3). Shared by `transfer`/`close`.
 */
export async function closeActiveEnrollment(input: {
  database: EnrollmentDatabase;
  enrollmentId: string;
  effectiveDate: Date;
  reason: EnrollmentCloseReason;
}): Promise<void> {
  await input.database.pedagogicalProgress.updateMany({
    where: { enrollmentId: input.enrollmentId, endDate: null },
    data: { endDate: input.effectiveDate, endReason: input.reason },
  });
  await input.database.enrollment.update({
    where: { id: input.enrollmentId },
    data: { exitDate: input.effectiveDate, exitReason: input.reason },
    select: { id: true },
  });
}

export async function createEnrollment(input: {
  database: EnrollmentDatabase;
  values: EnrollmentCreateInput;
}): Promise<EnrollmentCreateResult> {
  await assertStudentIsEnrollable({
    database: input.database,
    studentId: input.values.studentId,
  });
  const classRow = await loadEnrollableClass({
    database: input.database,
    classId: input.values.classId,
  });
  const stageId = await resolveInitialStageId({
    database: input.database,
    classRow,
    stageId: input.values.stageId,
  });

  await assertNoDuplicateActiveEnrollment({
    database: input.database,
    studentId: input.values.studentId,
    classId: classRow.id,
  });
  await assertCapacity({
    database: input.database,
    classRow,
    capacityOverrideReason: input.values.capacityOverrideReason,
  });

  return insertEnrollmentWithProgress({ database: input.database, values: input.values, stageId });
}

async function assertStudentIsEnrollable(input: {
  database: EnrollmentDatabase;
  studentId: string;
}): Promise<void> {
  const student = await input.database.student.findUnique({
    where: { id: input.studentId },
    select: { id: true, status: true },
  });

  if (student === null) {
    throw notFound(STUDENT_NOT_FOUND_MESSAGE);
  }
  if (student.status !== "ACTIVE") {
    throw badRequest(STUDENT_NOT_ACTIVE_MESSAGE);
  }
}

export async function loadEnrollableClass(input: {
  database: EnrollmentDatabase;
  classId: string;
}): Promise<EnrollableClass> {
  const classRow = await input.database.class.findUnique({
    where: { id: input.classId },
    select: { id: true, status: true, scheduleType: true, sharedStageId: true, capacity: true },
  });

  if (classRow === null) {
    throw notFound(CLASS_NOT_FOUND_MESSAGE);
  }
  if (classRow.status === "ARCHIVED") {
    throw badRequest(CLASS_ARCHIVED_MESSAGE);
  }
  return classRow;
}

async function resolveInitialStageId(input: {
  database: EnrollmentDatabase;
  classRow: EnrollableClass;
  stageId: string | undefined;
}): Promise<string> {
  if (input.classRow.scheduleType === "REGULAR") {
    return resolveRegularStageId({ classRow: input.classRow, stageId: input.stageId });
  }
  return resolvePersonalizedStageId({ database: input.database, stageId: input.stageId });
}

function resolveRegularStageId(input: {
  classRow: EnrollableClass;
  stageId: string | undefined;
}): string {
  if (input.stageId !== undefined) {
    throw badRequest(REGULAR_REJECTS_STAGE_MESSAGE);
  }
  if (input.classRow.sharedStageId === null) {
    // Unreachable: a REGULAR class always has sharedStageId (DB CHECK). Kept for narrowing.
    throw badRequest(REGULAR_CLASS_MISSING_STAGE_MESSAGE);
  }
  return input.classRow.sharedStageId;
}

async function resolvePersonalizedStageId(input: {
  database: EnrollmentDatabase;
  stageId: string | undefined;
}): Promise<string> {
  if (input.stageId === undefined) {
    throw badRequest(PERSONALIZED_REQUIRES_STAGE_MESSAGE);
  }
  const stage = await loadActiveStage({ database: input.database, stageId: input.stageId });
  return stage.id;
}

export async function assertNoDuplicateActiveEnrollment(input: {
  database: EnrollmentDatabase;
  studentId: string;
  classId: string;
}): Promise<void> {
  const active = await input.database.enrollment.count({
    where: { studentId: input.studentId, classId: input.classId, exitDate: null },
  });

  if (active > 0) {
    throw badRequest(DUPLICATE_ACTIVE_ENROLLMENT_MESSAGE);
  }
}

export async function assertCapacity(input: {
  database: EnrollmentDatabase;
  classRow: EnrollableClass;
  capacityOverrideReason: string | undefined;
}): Promise<void> {
  if (input.capacityOverrideReason !== undefined) {
    return;
  }

  const activeCount = await input.database.enrollment.count({
    where: { classId: input.classRow.id, exitDate: null },
  });

  if (activeCount + 1 > input.classRow.capacity) {
    throw badRequest(CAPACITY_OVERRIDE_REQUIRED_MESSAGE);
  }
}

async function insertEnrollmentWithProgress(input: {
  database: EnrollmentDatabase;
  values: EnrollmentCreateInput;
  stageId: string;
}): Promise<EnrollmentCreateResult> {
  const opened = await openEnrollmentAtStage({
    database: input.database,
    studentId: input.values.studentId,
    classId: input.values.classId,
    entryDate: input.values.entryDate ?? new Date(todayDateOnlyInSaoPaulo()),
    stageId: input.stageId,
    capacityOverrideReason: input.values.capacityOverrideReason,
  });

  return { ...opened, orderPromptRequired: true };
}

/**
 * Inserts an enrollment and its initial active `PedagogicalProgress` at `stageId`, both starting
 * on `entryDate`. Shared by `enrollment.create` (S-ENR-1) and the open half of `enrollment.transfer`
 * (S-ENR-2). The order prompt is added by the create caller only.
 */
export async function openEnrollmentAtStage(input: {
  database: EnrollmentDatabase;
  studentId: string;
  classId: string;
  entryDate: Date;
  stageId: string;
  capacityOverrideReason: string | undefined;
}): Promise<{ enrollment: EnrollmentSummary; progress: ProgressSummary }> {
  const enrollment = await input.database.enrollment.create({
    data: {
      studentId: input.studentId,
      classId: input.classId,
      entryDate: input.entryDate,
      ...(input.capacityOverrideReason === undefined
        ? {}
        : { capacityOverrideReason: input.capacityOverrideReason }),
    },
    select: enrollmentSummarySelect,
  });
  const progress = await input.database.pedagogicalProgress.create({
    data: { enrollmentId: enrollment.id, stageId: input.stageId, startDate: input.entryDate },
    select: progressSummarySelect,
  });

  return { enrollment, progress };
}
