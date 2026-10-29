import type { Prisma } from "@lazuli/db";
import { saoPauloDateOnly, studentPendingActions } from "@lazuli/domain";
import { notFound } from "../trpc/errors.js";

const pendingStudentSelect = {
  id: true,
  fullName: true,
  status: true,
  enrollments: {
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
} satisfies Prisma.StudentSelect;
type PendingStudent = Prisma.StudentGetPayload<{ select: typeof pendingStudentSelect }>;
type PendingLead = Pick<
  PendingStudent["admissionCandidates"][number],
  "id" | "stageId" | "englishExperience" | "format" | "scheduleType"
>;
type PendingResult = {
  items: ReturnType<typeof studentPendingActions>;
  enrollment: PendingStudent["enrollments"][number] | null;
  contract: PendingStudent["contracts"][number] | null;
  lead: PendingLead | null;
};

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
): Promise<PendingResult> {
  const { id, now } = options;

  const student = await loadPendingStudent(database, { id, now });
  const lead = student.admissionCandidates[0] ?? null;
  const items = studentPendingActions({
    id: student.id,
    name: student.fullName,
    active: student.status === "ACTIVE",
    hasEnrollment: student.enrollments.length > 0,
    hasContract: student.contracts.length > 0,
    placement: pendingPlacement(lead),
  });
  const placementItem = items.find((item) => item.type === "PLACEMENT");
  if (placementItem) {
    const assessment = lead?.visits[0]?.assessment;
    const correctionPending = Boolean(assessment && !assessment.stageId);
    placementItem.title = correctionPending ? "Nivelamento a corrigir" : "Nivelamento pendente";
    placementItem.description = correctionPending
      ? "Corrija a prova e defina o estágio de entrada. Depois, você poderá escolher uma turma para este aluno."
      : "Conclua o nivelamento para definir o estágio de entrada. Depois, você poderá escolher uma turma para este aluno.";
    placementItem.action.label = correctionPending ? "Corrigir nivelamento" : "Abrir nivelamento";
  }
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

function pendingPlacement(
  lead: PendingStudent["admissionCandidates"][number] | null,
): { leadId: string; completed: boolean } | null {
  if (lead?.englishExperience !== "SOME") return null;
  const latest = lead.visits[0];
  return {
    leadId: lead.id,
    completed: Boolean(
      latest?.status === "ATTENDED" &&
      latest.assessment?.stageId &&
      latest.assessment.stageId === lead.stageId,
    ),
  };
}

async function loadPendingStudent(
  database: Prisma.TransactionClient,
  { id, now }: { id: string; now: Date },
): Promise<PendingStudent> {
  const student = await database.student.findFirst({
    where: { id, deletedAt: null },
    select: {
      ...pendingStudentSelect,
      enrollments: { ...pendingStudentSelect.enrollments, where: intakeEnrollmentWhere(now) },
    },
  });
  if (!student) throw notFound("Aluno não encontrado.");
  return student;
}

/** Reuse the intake rule so an unresolved placement never becomes a class-choice task. */
export async function studentsAwaitingPlacement(
  database: Prisma.TransactionClient,
): Promise<string[]> {
  const students = await database.student.findMany({
    where: {
      deletedAt: null,
      status: "ACTIVE",
      enrollments: { none: { deletedAt: null } },
      admissionCandidates: {
        some: { deletedAt: null, status: { not: "ARCHIVED" }, englishExperience: "SOME" },
      },
    },
    select: { id: true, admissionCandidates: pendingStudentSelect.admissionCandidates },
  });
  return students
    .filter((student) => {
      const placement = pendingPlacement(student.admissionCandidates[0] ?? null);
      return placement && !placement.completed;
    })
    .map((student) => student.id);
}
