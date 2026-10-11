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
export type Progress = Prisma.PedagogicalProgressGetPayload<{ include: typeof progressInclude }>;

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
  assertProgressAccess(context, progress);
  return progress;
}
export function assertProgressAccess(context: AssessmentContext, progress: Progress): void {
  const today = saoPauloDateOnly(context.now);
  if (
    context.staffUser.role === "TEACHER" &&
    (dateOnly(progress.enrollment.entryDate) > today ||
      (progress.enrollment.exitDate && dateOnly(progress.enrollment.exitDate) <= today))
  )
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Este aluno já não possui vínculo vigente nesta turma.",
    });
  assertTeacherAccess(context.staffUser, progress.enrollment.class, new Date(today));
}
export function assertTeacherAccess(
  staff: StaffUser,
  classRow: Parameters<typeof usualTeacherOn>[0],
  date: Date,
): void {
  if (staff.role === "TEACHER" && usualTeacherOn(classRow, date)?.id !== staff.id)
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Somente o professor responsável por este percurso pode acessar as avaliações.",
    });
}
