import type { Prisma } from "@lazuli/db";
import { saoPauloDateOnly, studentPendingActions } from "@lazuli/domain";
import { notFound } from "../trpc/errors.js";

export function intakeEnrollmentWhere(now: Date): Prisma.EnrollmentWhereInput {
  const today = new Date(saoPauloDateOnly(now));
  return {
    deletedAt: null,
    OR: [{ exitDate: null }, { exitDate: { gt: today } }],
    class: {
      deletedAt: null,
      status: "ACTIVE",
      semester: { deletedAt: null, endDate: { gte: today } },
    },
  };
}

export async function studentsWithPendingRegistration(
  database: Prisma.TransactionClient,
  options: {
    ids: string[];
    now: Date;
  },
): Promise<Set<string>> {
  const { ids, now } = options;

  const rows = await database.student.findMany({
    where: {
      id: { in: ids },
      deletedAt: null,
      status: "ACTIVE",
      OR: [
        { enrollments: { none: intakeEnrollmentWhere(now) } },
        { contracts: { none: { deletedAt: null } } },
      ],
    },
    select: { id: true },
  });
  return new Set(rows.map((row) => row.id));
}

export async function readStudentPendingActions(
  database: Prisma.TransactionClient,
  options: {
    id: string;
    now: Date;
  },
) {
  const { id, now } = options;

  const student = await database.student.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      fullName: true,
      status: true,
      enrollments: {
        where: intakeEnrollmentWhere(now),
        orderBy: { entryDate: "desc" },
        take: 1,
        select: {
          id: true,
          classId: true,
          class: {
            select: {
              portalClassName: true,
              format: true,
              scheduleType: true,
              sharedStage: { select: { id: true, name: true } },
            },
          },
        },
      },
      contracts: { where: { deletedAt: null }, select: { id: true }, take: 1 },
      admissionCandidates: {
        where: { deletedAt: null, status: { not: "ARCHIVED" } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          stageId: true,
          englishExperience: true,
          format: true,
          scheduleType: true,
          visits: {
            where: { kind: "PLACEMENT", deletedAt: null, status: { not: "CANCELLED" } },
            orderBy: [{ date: "desc" }, { startTime: "desc" }, { createdAt: "desc" }],
            take: 1,
            select: { status: true, assessment: { select: { stageId: true } } },
          },
        },
      },
    },
  });
  if (!student) throw notFound("Aluno não encontrado.");
  const lead = student.admissionCandidates[0] ?? null;
  const latest = lead?.visits[0];
  const items = studentPendingActions({
    id: student.id,
    name: student.fullName,
    active: student.status === "ACTIVE",
    hasEnrollment: student.enrollments.length > 0,
    hasContract: student.contracts.length > 0,
    placement:
      lead?.englishExperience === "SOME"
        ? {
            leadId: lead.id,
            completed: Boolean(
              latest?.status === "ATTENDED" &&
              latest.assessment?.stageId &&
              latest.assessment.stageId === lead.stageId,
            ),
          }
        : null,
  });
  return {
    items,
    enrollment: student.enrollments[0] ?? null,
    contract: student.contracts[0] ?? null,
    lead: lead
      ? {
          id: lead.id,
          stageId: lead.stageId,
          englishExperience: lead.englishExperience,
          format: lead.format,
          scheduleType: lead.scheduleType,
        }
      : null,
  };
}
