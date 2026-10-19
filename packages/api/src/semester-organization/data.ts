import type { TransactionClient } from "@lazuli/db";
import type { StaffUser } from "../trpc/context.js";
import { saoPauloDateOnly } from "@lazuli/domain";
import { classScheduleSlotInputSchema, z } from "@lazuli/validators";
import { TRPCError } from "@trpc/server";
import { badRequest, notFound } from "../trpc/errors.js";

export type OrganizationContext = { database: TransactionClient; staffUser: StaffUser; now: Date };
export const dateOnly = (value: Date | string): string =>
  typeof value === "string" ? value.slice(0, 10) : value.toISOString().slice(0, 10);
export const readSlots = (value: unknown) => z.array(classScheduleSlotInputSchema).parse(value);
export async function lockSemester(context: OrganizationContext, semesterId: string) {
  await context.database
    .$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`semester-organization:${semesterId}`}, 0))`;
  return requireFutureSemester(context, semesterId);
}
export async function requireFutureSemester(context: OrganizationContext, semesterId: string) {
  const semester = await context.database.semester.findUnique({ where: { id: semesterId } });
  if (!semester) throw notFound("Semestre não encontrado.");
  if (dateOnly(semester.endDate) < saoPauloDateOnly(context.now))
    throw badRequest("Este período já terminou. Escolha um semestre atual ou futuro.");
  return semester;
}
export function assertVersion(current: number, expected: number) {
  if (current !== expected)
    throw new TRPCError({
      code: "CONFLICT",
      message: "Esta proposta mudou. Atualize a página antes de continuar.",
    });
}
export async function recordPlacementRevision(
  context: OrganizationContext,
  id: string,
  action: string,
  reason?: string,
) {
  const row = await context.database.semesterPlacement.findUniqueOrThrow({ where: { id } });
  await context.database.semesterPlacementRevision.create({
    data: {
      placementId: id,
      version: row.version,
      action,
      reason: reason ?? null,
      recordedById: context.staffUser.id,
      createdAt: context.now,
      snapshot: {
        planId: row.planId,
        effectiveDate: row.effectiveDate ? dateOnly(row.effectiveDate) : null,
        declinedAt: row.declinedAt?.toISOString() ?? null,
        declinedReason: row.declinedReason,
        studentId: row.studentId,
        mode: row.mode,
        stageId: row.stageId,
        sourceProgressId: row.sourceProgressId,
        enrollmentId: row.enrollmentId,
        entryActionId: row.entryActionId,
        sourceExitActionId: row.sourceExitActionId,
        availabilityId: row.availabilityId,
        publishedAt: row.publishedAt?.toISOString() ?? null,
        notes: row.notes,
      },
    },
  });
}
