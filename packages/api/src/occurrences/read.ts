import { searchIds } from "../search.js";
import type { Prisma } from "@lazuli/db";
import type { PedagogicalList } from "@lazuli/validators";
import {
  occurrenceInclude,
  interventionInclude,
  occurrenceScope,
  interventionScope,
  followUpInclude,
  loadOccurrence,
  loadIntervention,
  type FollowUpContext,
  type OccurrenceRow,
  type InterventionRow,
  type FollowUpRow,
} from "./data.js";
const PAGE_SIZE = 25;
type FollowUpPage<Row> = { rows: Row[]; total: number; pageSize: number };
export async function listOccurrences(
  context: FollowUpContext,
  input: PedagogicalList,
): Promise<FollowUpPage<OccurrenceRow>> {
  const where: Prisma.PedagogicalOccurrenceWhereInput = {
    AND: [
      occurrenceScope(context),
      {
        ...(input.studentId ? { studentId: input.studentId } : {}),
        ...(input.search
          ? {
              OR: [
                {
                  id:
                    (await searchIds(context.database, {
                      table: "PedagogicalOccurrence",
                      query: input.search,
                    })) ?? {},
                },
                {
                  student: {
                    id:
                      (await searchIds(context.database, {
                        table: "Student",
                        query: input.search,
                      })) ?? {},
                  },
                },
              ],
            }
          : {}),
      },
    ],
  };
  const [rows, total] = await Promise.all([
    context.database.pedagogicalOccurrence.findMany({
      where,
      include: occurrenceInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: PAGE_SIZE,
      skip: (input.page - 1) * PAGE_SIZE,
    }),
    context.database.pedagogicalOccurrence.count({ where }),
  ]);
  return { rows, total, pageSize: PAGE_SIZE };
}
async function interventionFilter(
  context: FollowUpContext,
  input: PedagogicalList,
): Promise<Prisma.PedagogicalInterventionWhereInput> {
  return {
    AND: [
      interventionScope(context),
      {
        ...(input.studentId ? { studentId: input.studentId } : {}),
        ...(input.search
          ? {
              OR: [
                {
                  id:
                    (await searchIds(context.database, {
                      table: "PedagogicalIntervention",
                      query: input.search,
                    })) ?? {},
                },
                {
                  student: {
                    id:
                      (await searchIds(context.database, {
                        table: "Student",
                        query: input.search,
                      })) ?? {},
                  },
                },
                {
                  responsible: {
                    id:
                      (await searchIds(context.database, { table: "User", query: input.search })) ??
                      {},
                  },
                },
              ],
            }
          : {}),
      },
    ],
  };
}
export async function listInterventions(
  context: FollowUpContext,
  input: PedagogicalList,
): Promise<FollowUpPage<InterventionRow>> {
  const where = await interventionFilter(context, input);
  const [rows, total] = await Promise.all([
    context.database.pedagogicalIntervention.findMany({
      where,
      include: interventionInclude,
      orderBy: [{ performedOn: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      take: PAGE_SIZE,
      skip: (input.page - 1) * PAGE_SIZE,
    }),
    context.database.pedagogicalIntervention.count({ where }),
  ]);
  return { rows, total, pageSize: PAGE_SIZE };
}
export async function occurrenceDetail(
  context: FollowUpContext,
  id: string,
): Promise<
  OccurrenceRow & {
    related: OccurrenceRow[];
    interventions: InterventionRow[];
    statusChanges: Array<{
      id: string;
      createdAt: Date;
      fromStatus: OccurrenceRow["status"];
      toStatus: OccurrenceRow["status"];
      conclusion: string | null;
      author: { id: string; name: string };
    }>;
    canEdit: boolean;
    canOrganize: boolean;
  }
> {
  const row = await loadOccurrence(context, id);
  const [statusChanges, relations, interventions] = await Promise.all([
    context.database.occurrenceStatusChange.findMany({
      where: { occurrenceId: id },
      include: { author: { select: { id: true, name: true } } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    }),
    occurrenceRelations(context, id),
    context.database.pedagogicalIntervention.findMany({
      where: {
        ...interventionScope(context),
        occurrences: { some: { occurrenceId: id, deletedAt: null } },
      },
      include: interventionInclude,
    }),
  ]);
  return {
    ...row,
    statusChanges,
    related: relations.map((link) => (link.fromId === id ? link.to : link.from)),
    interventions,
    canEdit: context.staffUser.role !== "TEACHER" || row.recordedById === context.staffUser.id,
    canOrganize: context.staffUser.role !== "TEACHER",
  };
}

function occurrenceRelations(
  context: FollowUpContext,
  id: string,
): Promise<
  Prisma.OccurrenceRelationGetPayload<{
    include: {
      from: { include: typeof occurrenceInclude };
      to: { include: typeof occurrenceInclude };
    };
  }>[]
> {
  return context.database.occurrenceRelation.findMany({
    where: {
      deletedAt: null,
      OR: [
        { fromId: id, to: occurrenceScope(context) },
        { toId: id, from: occurrenceScope(context) },
      ],
    },
    include: { from: { include: occurrenceInclude }, to: { include: occurrenceInclude } },
    orderBy: { createdAt: "asc" },
  });
}
export async function interventionDetail(
  context: FollowUpContext,
  id: string,
): Promise<
  InterventionRow & { occurrences: OccurrenceRow[]; followUps: FollowUpRow[]; canOrganize: boolean }
> {
  const row = await loadIntervention(context, id);
  const [occurrences, followUps] = await Promise.all([
    context.database.pedagogicalOccurrence.findMany({
      where: { deletedAt: null, interventions: { some: { interventionId: id, deletedAt: null } } },
      include: occurrenceInclude,
      orderBy: [{ classSession: { date: "asc" } }, { createdAt: "asc" }],
    }),
    context.database.pedagogicalFollowUp.findMany({
      where: { interventionId: id, deletedAt: null },
      include: followUpInclude,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    }),
  ]);
  return {
    ...row,
    occurrences,
    followUps,
    canOrganize: context.staffUser.role !== "TEACHER",
  };
}
export async function studentOccurrences(
  context: FollowUpContext,
  studentId: string,
): Promise<OccurrenceRow[]> {
  return context.database.pedagogicalOccurrence.findMany({
    where: { studentId, ...occurrenceScope(context) },
    include: occurrenceInclude,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
}
