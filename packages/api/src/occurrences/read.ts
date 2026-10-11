import type { Prisma } from "@lazuli/db";
import type { PedagogicalList } from "@lazuli/validators";
import { saoPauloDateOnly } from "@lazuli/domain";
import {
  occurrenceInclude,
  interventionInclude,
  occurrenceScope,
  interventionScope,
  followUpInclude,
  loadOccurrence,
  loadIntervention,
  type FollowUpContext,
} from "./data.js";
const PAGE_SIZE = 20;
export async function listOccurrences(context: FollowUpContext, input: PedagogicalList) {
  const where: Prisma.PedagogicalOccurrenceWhereInput = {
    AND: [
      occurrenceScope(context),
      {
        ...(input.studentId ? { studentId: input.studentId } : {}),
        ...(input.search
          ? {
              OR: [
                { title: { contains: input.search, mode: "insensitive" } },
                { student: { fullName: { contains: input.search, mode: "insensitive" } } },
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
function interventionFilter(
  context: FollowUpContext,
  input: PedagogicalList,
): Prisma.PedagogicalInterventionWhereInput {
  return {
    AND: [
      interventionScope(context),
      {
        ...(input.studentId ? { studentId: input.studentId } : {}),
        ...(input.status === "OVERDUE"
          ? { status: { not: "CONCLUDED" }, dueOn: { lt: new Date(saoPauloDateOnly(context.now)) } }
          : input.status === "ALL"
            ? {}
            : { status: input.status }),
        ...(input.search
          ? {
              OR: [
                { title: { contains: input.search, mode: "insensitive" } },
                { student: { fullName: { contains: input.search, mode: "insensitive" } } },
                { teacher: { name: { contains: input.search, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
    ],
  };
}
export async function listInterventions(context: FollowUpContext, input: PedagogicalList) {
  const where = interventionFilter(context, input);
  const [rows, total] = await Promise.all([
    context.database.pedagogicalIntervention.findMany({
      where,
      include: interventionInclude,
      orderBy: [
        { status: "asc" },
        { dueOn: { sort: "asc", nulls: "last" } },
        { createdAt: "desc" },
        { id: "desc" },
      ],
      take: PAGE_SIZE,
      skip: (input.page - 1) * PAGE_SIZE,
    }),
    context.database.pedagogicalIntervention.count({ where }),
  ]);
  return { rows, total, pageSize: PAGE_SIZE };
}
export async function occurrenceDetail(context: FollowUpContext, id: string) {
  const row = await loadOccurrence(context, id);
  const [relations, interventions, followUps] = await Promise.all([
    context.database.occurrenceRelation.findMany({
      where: {
        deletedAt: null,
        OR: [
          { fromId: id, to: occurrenceScope(context) },
          { toId: id, from: occurrenceScope(context) },
        ],
      },
      include: { from: { include: occurrenceInclude }, to: { include: occurrenceInclude } },
      orderBy: { createdAt: "asc" },
    }),
    context.database.pedagogicalIntervention.findMany({
      where: {
        ...interventionScope(context),
        occurrences: { some: { occurrenceId: id, deletedAt: null } },
      },
      include: interventionInclude,
    }),
    context.database.pedagogicalFollowUp.findMany({
      where: { occurrenceId: id, deletedAt: null },
      include: followUpInclude,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    }),
  ]);
  return {
    ...row,
    related: relations.map((link) => (link.fromId === id ? link.to : link.from)),
    interventions,
    followUps,
    canOrganize: context.staffUser.role !== "TEACHER",
  };
}
export async function interventionDetail(context: FollowUpContext, id: string) {
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
    today: saoPauloDateOnly(context.now),
  };
}
export async function studentOccurrences(context: FollowUpContext, studentId: string) {
  return context.database.pedagogicalOccurrence.findMany({
    where: { studentId, ...occurrenceScope(context) },
    include: occurrenceInclude,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
}
