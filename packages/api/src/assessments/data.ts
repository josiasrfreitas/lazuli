import type { Prisma } from "@lazuli/db";
import type { StaffUser } from "../trpc/context.js";
import { TRPCError } from "@trpc/server";
import { saoPauloDateOnly } from "@lazuli/domain";
import { responsibilitySelect, usualTeacherOn } from "../teachers/responsibility.js";
import { notFound } from "../trpc/errors.js";
import { lockStudentEnrollment } from "../enrollment/data.js";
const DATE_LENGTH = 10;
export const dateOnly = (date: Date): string => date.toISOString().slice(0, DATE_LENGTH);
export type AssessmentContext = {
  database: Prisma.TransactionClient;
  staffUser: StaffUser;
  now: Date;
};
export const progressInclude = {
  stage: { select: { id: true, name: true, track: { select: { id: true, name: true } } } },
  enrollment: {
    include: {
      student: { select: { id: true, fullName: true } },
      class: { select: { id: true, portalClassName: true, ...responsibilitySelect } },
    },
  },
  assessment: {
    include: {
      confirmedBy: { select: { name: true } },
      grades: { where: { deletedAt: null }, include: { recordedBy: { select: { name: true } } } },
    },
  },
} satisfies Prisma.PedagogicalProgressInclude;
export type Progress = Prisma.PedagogicalProgressGetPayload<{
  include: typeof progressInclude;
}>;
export async function loadProgress(
  database: Prisma.TransactionClient,
  id: string,
): Promise<Progress> {
  const progress = await database.pedagogicalProgress.findFirst({
    where: {
      id,
      deletedAt: null,
      enrollment: { deletedAt: null, student: { deletedAt: null }, class: { deletedAt: null } },
    },
    include: progressInclude,
  });
  if (!progress) throw notFound("Percurso acadêmico não encontrado.");
  return progress;
}
export async function lockProgress(context: AssessmentContext, id: string): Promise<Progress> {
  const initial = await loadProgress(context.database, id);
  await lockStudentEnrollment(context.database, initial.enrollment.studentId);
  const progress = await loadProgress(context.database, id);
  await assertProgressAccess(context, progress);
  return progress;
}
export async function assertProgressAccess(
  context: AssessmentContext,
  progress: Progress,
): Promise<void> {
  if (context.staffUser.role !== "TEACHER") return;
  const today = saoPauloDateOnly(context.now);
  const assignedAssessment = await context.database.pedagogicalAppointment.findFirst({
    where: {
      teacherId: context.staffUser.id,
      studentId: progress.enrollment.studentId,
      purpose: "ASSESSMENT",
      deletedAt: null,
      status: { not: "CANCELLED" },
      enrollmentId: progress.enrollmentId,
      date: { gte: progress.startDate, ...(progress.endDate ? { lte: progress.endDate } : {}) },
    },
    select: { id: true },
  });
  if (assignedAssessment) return;
  if (
    dateOnly(progress.enrollment.entryDate) > today ||
    (progress.enrollment.exitDate && dateOnly(progress.enrollment.exitDate) <= today)
  )
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Este aluno já não possui vínculo vigente nesta turma.",
    });
  if (usualTeacherOn(progress.enrollment.class, new Date(today))?.id === context.staffUser.id)
    return;
  const substitute = await context.database.classSubstitution.findFirst({
    where: {
      classId: progress.enrollment.classId,
      teacherId: context.staffUser.id,
      deletedAt: null,
      revokedAt: null,
      date: new Date(today),
    },
    select: { id: true },
  });
  if (!substitute)
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Esta avaliação não pertence às suas atribuições atuais.",
    });
}
export function assertTeacherAccess(
  staff: StaffUser,
  {
    classRow,
    date,
  }: {
    classRow: Parameters<typeof usualTeacherOn>[0];
    date: Date;
  },
): void {
  if (staff.role === "TEACHER" && usualTeacherOn(classRow, date)?.id !== staff.id)
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Somente o professor responsável por este percurso pode acessar as avaliações.",
    });
}
export async function assertAssessmentDateAccess(
  context: AssessmentContext,
  {
    progress,
    date,
  }: {
    progress: Progress;
    date: Date;
  },
): Promise<void> {
  if (
    context.staffUser.role !== "TEACHER" ||
    usualTeacherOn(progress.enrollment.class, date)?.id === context.staffUser.id
  )
    return;
  const [substitution, appointment] = await Promise.all([
    context.database.classSubstitution.findFirst({
      where: {
        classId: progress.enrollment.classId,
        teacherId: context.staffUser.id,
        date,
        revokedAt: null,
        deletedAt: null,
      },
      select: { id: true },
    }),
    context.database.pedagogicalAppointment.findFirst({
      where: {
        studentId: progress.enrollment.studentId,
        enrollmentId: progress.enrollmentId,
        teacherId: context.staffUser.id,
        purpose: "ASSESSMENT",
        status: { not: "CANCELLED" },
        deletedAt: null,
        date,
      },
      select: { id: true },
    }),
  ]);
  if (!substitution && !appointment)
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Você não era responsável por esta avaliação na data informada.",
    });
}
