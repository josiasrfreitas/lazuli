import { saoPauloDateOnly } from "@lazuli/domain";
import { dateOnlyUtc } from "./effective-date.js";
import type { enrollmentReturnInputSchema, z } from "@lazuli/validators";

import {
  assertNoDuplicateActiveEnrollment,
  assertStudentIsEnrollable,
  loadEnrollableClass,
  openEnrollmentAtStage,
  resolveInitialStageId,
  type EnrollmentDatabase,
  type EnrollmentSummary,
  type ProgressSummary,
} from "./data.js";
import { badRequest, notFound } from "./errors.js";

async function pausedSource(input: {
  database: EnrollmentDatabase;
  id: string;
  today: string;
}): Promise<{ id: string; studentId: string }> {
  const source = await input.database.enrollment.findUnique({
    where: { id: input.id },
    select: { id: true, studentId: true, exitDate: true, exitReason: true, deletedAt: true },
  });
  if (source === null || source.deletedAt !== null)
    throw notFound("Vínculo pausado não encontrado.");
  if (
    source.exitReason !== "SUSPENDED" ||
    source.exitDate === null ||
    dateOnlyUtc(source.exitDate) > input.today
  ) {
    throw badRequest("O retorno exige um vínculo já pausado.");
  }
  return { id: source.id, studentId: source.studentId };
}

export async function returnEnrollment(input: {
  database: EnrollmentDatabase;
  values: z.infer<typeof enrollmentReturnInputSchema>;
  staffUserId: string;
  now: Date;
}): Promise<{ enrollment: EnrollmentSummary; progress: ProgressSummary }> {
  const today = saoPauloDateOnly(input.now);
  const source = await pausedSource({
    database: input.database,
    id: input.values.sourceEnrollmentId,
    today,
  });
  const effectiveDate = input.values.effectiveDate ?? new Date(today);
  assertReturnDate(effectiveDate, today);
  await assertNoReturnFromSource(input.database, source.id);
  await assertStudentIsEnrollable({ database: input.database, studentId: source.studentId });
  const target = await loadEnrollableClass({
    database: input.database,
    classId: input.values.targetClassId,
  });
  const stageId = await resolveInitialStageId({
    database: input.database,
    classRow: target,
    stageId: input.values.stageId,
  });
  await assertNoDuplicateActiveEnrollment({
    database: input.database,
    studentId: source.studentId,
    classId: target.id,
  });
  const opened = await openEnrollmentAtStage({
    database: input.database,
    studentId: source.studentId,
    classId: target.id,
    entryDate: effectiveDate,
    stageId,
    capacityOverrideReason: undefined,
  });
  await input.database.enrollmentAction.create({
    data: {
      enrollmentId: opened.enrollment.id,
      sourceEnrollmentId: source.id,
      kind: "RETURN",
      status: dateOnlyUtc(effectiveDate) > today ? "SCHEDULED" : "APPLIED",
      effectiveDate,
      recordedById: input.staffUserId,
    },
  });
  return opened;
}

function assertReturnDate(effectiveDate: Date, today: string): void {
  if (dateOnlyUtc(effectiveDate) < today)
    throw badRequest("A data de retorno deve ser hoje ou futura.");
}

async function assertNoReturnFromSource(
  database: EnrollmentDatabase,
  sourceId: string,
): Promise<void> {
  const existingReturn = await database.enrollmentAction.count({
    where: {
      sourceEnrollmentId: sourceId,
      kind: "RETURN",
      status: { in: ["SCHEDULED", "APPLIED"] },
    },
  });
  if (existingReturn > 0) throw badRequest("Este vínculo pausado já possui um retorno.");
}
