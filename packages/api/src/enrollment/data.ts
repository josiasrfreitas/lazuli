import type { Prisma } from "@lazuli/db";
import type { enrollmentCreateInputSchema, z } from "@lazuli/validators";

import { loadActiveStage } from "../classes/guards.js";
import { todayDateOnlyInSaoPaulo } from "../students/date-rules.js";
import {
  CAPACITY_OVERRIDE_REQUIRED_MESSAGE,
  CLASS_ARCHIVED_MESSAGE,
  CLASS_NOT_FOUND_MESSAGE,
  DUPLICATE_ACTIVE_ENROLLMENT_MESSAGE,
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

type EnrollableClass = {
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

async function loadEnrollableClass(input: {
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

async function assertNoDuplicateActiveEnrollment(input: {
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

async function assertCapacity(input: {
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
  const entryDate = input.values.entryDate ?? new Date(todayDateOnlyInSaoPaulo());

  const enrollment = await input.database.enrollment.create({
    data: buildEnrollmentCreateData({ values: input.values, entryDate }),
    select: enrollmentSummarySelect,
  });
  const progress = await input.database.pedagogicalProgress.create({
    data: { enrollmentId: enrollment.id, stageId: input.stageId, startDate: entryDate },
    select: progressSummarySelect,
  });

  return { enrollment, progress, orderPromptRequired: true };
}

function buildEnrollmentCreateData(input: {
  values: EnrollmentCreateInput;
  entryDate: Date;
}): Prisma.EnrollmentUncheckedCreateInput {
  return {
    studentId: input.values.studentId,
    classId: input.values.classId,
    entryDate: input.entryDate,
    ...(input.values.capacityOverrideReason === undefined
      ? {}
      : { capacityOverrideReason: input.values.capacityOverrideReason }),
  };
}
