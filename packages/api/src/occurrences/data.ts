import type { Prisma } from "@lazuli/db";
import type { StaffUser } from "../trpc/context.js";
import { TRPCError } from "@trpc/server";
import { saoPauloDateOnly } from "@lazuli/domain";
export type FollowUpContext = {
  database: Prisma.TransactionClient;
  staffUser: StaffUser;
  now: Date;
};
export const personSelect = { id: true, name: true } as const;
export const occurrenceInclude = {
  student: { select: { id: true, fullName: true } },
  recordedBy: { select: personSelect },
  classSession: {
    select: { id: true, date: true, class: { select: { id: true, portalClassName: true } } },
  },
} satisfies Prisma.PedagogicalOccurrenceInclude;
export const interventionInclude = {
  student: { select: { id: true, fullName: true } },
  responsible: { select: personSelect },
  recordedBy: { select: personSelect },
  _count: { select: { occurrences: true } },
} satisfies Prisma.PedagogicalInterventionInclude;
export const followUpInclude = { recordedBy: { select: personSelect } } as const;
export function occurrenceScope(context: FollowUpContext): Prisma.PedagogicalOccurrenceWhereInput {
  return {
    deletedAt: null,
    ...(context.staffUser.role === "TEACHER"
      ? {
          OR: [
            { recordedById: context.staffUser.id },
            {
              interventions: {
                some: {
                  deletedAt: null,
                  intervention: { deletedAt: null, responsibleId: context.staffUser.id },
                },
              },
            },
          ],
        }
      : {}),
  };
}
export function interventionScope(
  context: FollowUpContext,
): Prisma.PedagogicalInterventionWhereInput {
  return {
    deletedAt: null,
    ...(context.staffUser.role === "TEACHER" ? { responsibleId: context.staffUser.id } : {}),
  };
}
export async function loadOccurrence(context: FollowUpContext, id: string) {
  const row = await context.database.pedagogicalOccurrence.findFirst({
    where: { id, ...occurrenceScope(context) },
    include: occurrenceInclude,
  });
  if (!row)
    throw new TRPCError({ code: "NOT_FOUND", message: "Ocorrência não encontrada ou sem acesso." });
  return row;
}
export async function loadIntervention(context: FollowUpContext, id: string) {
  const row = await context.database.pedagogicalIntervention.findFirst({
    where: { id, ...interventionScope(context) },
    include: interventionInclude,
  });
  if (!row)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Intervenção não encontrada ou sem acesso.",
    });
  return row;
}
export function eligibleInterventionStaff(context: FollowUpContext): Prisma.UserWhereInput {
  return {
    deletedAt: null,
    isEnabled: true,
    OR: [
      { role: { not: "TEACHER" } },
      {
        role: "TEACHER",
        teacherProfile: {
          deletedAt: null,
          OR: [
            { departureDate: null },
            { departureDate: { gt: new Date(saoPauloDateOnly(context.now)) } },
          ],
        },
      },
    ],
  };
}
export async function assertEligibleResponsible(
  context: FollowUpContext,
  id: string,
): Promise<void> {
  const row = await context.database.user.findFirst({
    where: { id, ...eligibleInterventionStaff(context) },
    select: { id: true },
  });
  if (!row) invalid("Escolha um membro ativo da equipe.");
}
export function invalid(message: string): never {
  throw new TRPCError({ code: "BAD_REQUEST", message });
}
export async function claimVersion(
  context: FollowUpContext,
  id: string,
  version: number,
): Promise<void> {
  const changed = await context.database.pedagogicalIntervention.updateMany({
    where: { id, version, ...interventionScope(context) },
    data: { version: { increment: 1 } },
  });
  if (!changed.count)
    throw new TRPCError({
      code: "CONFLICT",
      message: "O acompanhamento mudou. Atualize a página antes de salvar.",
    });
}
