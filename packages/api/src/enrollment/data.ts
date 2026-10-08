import type { Prisma, TransactionClient } from "@lazuli/db";
import { dateOnlyUtc } from "./effective-date.js";
import { assertTrackAvailable } from "./eligibility.js";
import type { enrollmentCreateInputSchema, z } from "@lazuli/validators";

import { loadActiveStage } from "../classes/guards.js";
import { saoPauloDateOnly } from "@lazuli/domain";
import { badRequest, notFound } from "../trpc/errors.js";
import {
  CLASS_ARCHIVED_MESSAGE,
  CLASS_NOT_FOUND_MESSAGE,
  DUPLICATE_ACTIVE_ENROLLMENT_MESSAGE,
  ENROLLMENT_NOT_FOUND_MESSAGE,
  PERSONALIZED_REQUIRES_STAGE_MESSAGE,
  REGULAR_CLASS_MISSING_STAGE_MESSAGE,
  REGULAR_REJECTS_STAGE_MESSAGE,
  STUDENT_NOT_ACTIVE_MESSAGE,
  STUDENT_NOT_FOUND_MESSAGE,
} from "./errors.js";

type EnrollmentCreateInput = z.infer<typeof enrollmentCreateInputSchema>;

/** Keys touched here plus the ones `loadActiveStage` (classes/guards) structurally requires. */
export type EnrollmentDatabase = Pick<
  TransactionClient,
  | "$kysely"
  | "$queryRaw"
  | "enrollment"
  | "pedagogicalProgress"
  | "class"
  | "student"
  | "stage"
  | "semester"
  | "track"
  | "user"
  | "enrollmentAction"
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
  entryDate: true,
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
  staffUserId: string;
  now: Date;
}): Promise<EnrollmentCreateResult> {
  const today = saoPauloDateOnly(input.now);
  const entryDate = input.values.entryDate ?? new Date(today);
  if (dateOnlyUtc(entryDate) < today) {
    throw badRequest("A data de entrada deve ser hoje ou futura.");
  }
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
  const created = await insertEnrollmentWithProgress({
    database: input.database,
    values: { ...input.values, entryDate },
    stageId,
  });
  await input.database.enrollmentAction.create({
    data: {
      enrollmentId: created.enrollment.id,
      kind: "ENTRY",
      status: dateOnlyUtc(entryDate) > today ? "SCHEDULED" : "APPLIED",
      effectiveDate: entryDate,
      recordedById: input.staffUserId,
    },
  });
  return created;
}

export async function assertStudentIsEnrollable(input: {
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

export async function resolveInitialStageId(input: {
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

async function insertEnrollmentWithProgress(input: {
  database: EnrollmentDatabase;
  values: EnrollmentCreateInput;
  stageId: string;
}): Promise<EnrollmentCreateResult> {
  const opened = await openEnrollmentAtStage({
    database: input.database,
    studentId: input.values.studentId,
    classId: input.values.classId,
    entryDate: input.values.entryDate ?? new Date(saoPauloDateOnly(new Date())),
    stageId: input.stageId,
    capacityOverrideReason: undefined,
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
  await lockStudentEnrollment(input.database, input.studentId);
  await assertTrackAvailable(input);
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

/** Serialize entries and cancellations for one student until the transaction commits. */
export async function lockStudentEnrollment(
  database: Pick<Prisma.TransactionClient, "$queryRaw">,
  studentId: string,
): Promise<void> {
  const key = `enrollment:${studentId.toLowerCase()}`;
  await database.$queryRaw`
    SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0)) IS NULL AS locked
  `;
}
