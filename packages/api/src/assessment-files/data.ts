import { TRPCError } from "@trpc/server";
import { MAX_UPLOAD_FILE_BYTES, z } from "@lazuli/validators";
import { badRequest, notFound } from "../trpc/errors.js";
import {
  assertProgressAccess,
  loadProgress,
  lockProgress,
  type AssessmentContext,
} from "../assessments/data.js";
import { ensureAssessment } from "../assessments/write.js";
import { loadAppointment } from "../appointments/data.js";

export const MAX_ASSESSMENT_BYTES = MAX_UPLOAD_FILE_BYTES;
export const fileInputSchema = z
  .object({
    id: z.string().uuid(),
    progressId: z.string().uuid(),
    phase: z.enum(["BLOCK_ONE", "BLOCK_TWO", "RECOVERY"]),
    competence: z.enum(["WRITTEN", "LISTENING"]).optional(),
    appointmentId: z.string().uuid().optional(),
    fileName: z.string().trim().min(1).max(180),
    contentType: z.enum(["application/pdf", "image/jpeg", "image/png"]),
    byteLength: z.number().int().positive().max(MAX_ASSESSMENT_BYTES),
  })
  .strict();
export const fileView = {
  id: true,
  assessmentId: true,
  phase: true,
  competence: true,
  appointmentId: true,
  fileName: true,
  contentType: true,
  byteLength: true,
  status: true,
  failureCode: true,
  receivedAt: true,
  processedAt: true,
  createdAt: true,
  uploadedById: true,
} as const;

export async function prepareFile(
  context: AssessmentContext,
  input: z.infer<typeof fileInputSchema>,
) {
  const progress = await lockProgress(context, input.progressId);
  if (input.appointmentId) {
    const appointment = await loadAppointment(context, input.appointmentId);
    if (
      appointment.studentId !== progress.enrollment.studentId ||
      appointment.enrollmentId !== progress.enrollmentId ||
      appointment.date < progress.startDate ||
      (progress.endDate && appointment.date > progress.endDate) ||
      appointment.purpose !== "ASSESSMENT" ||
      appointment.status === "CANCELLED"
    )
      throw badRequest("Associe um atendimento de avaliação deste aluno.");
  }
  const existing = await context.database.assessmentFile.findUnique({ where: { id: input.id } });
  if (existing) {
    if (
      existing.uploadedById !== context.staffUser.id ||
      existing.assessmentId !== progress.assessmentId ||
      existing.fileName !== input.fileName ||
      existing.phase !== input.phase ||
      existing.competence !== (input.competence ?? null) ||
      existing.byteLength !== input.byteLength ||
      existing.contentType !== input.contentType ||
      existing.appointmentId !== (input.appointmentId ?? null)
    )
      throw badRequest(
        "O identificador deste envio já foi utilizado. Selecione o arquivo novamente.",
      );
    if (["RECEIVED", "PROCESSING", "READY"].includes(existing.status))
      return { row: existing, received: true };
    if (existing.status === "REMOVED" || existing.status === "REJECTED")
      throw badRequest("Selecione um novo arquivo para substituir este envio.");
    if (
      existing.status === "UPLOADING" &&
      context.now.getTime() - existing.updatedAt.getTime() < 120_000
    )
      throw badRequest(
        "Este arquivo ainda está sendo recebido. Aguarde alguns instantes antes de tentar novamente.",
      );
    const row = await context.database.assessmentFile.update({
      where: { id: input.id },
      data: { status: "UPLOADING", failureCode: null, updatedAt: context.now },
    });
    return { row, received: false };
  }
  const assessmentId = await ensureAssessment(context, progress);
  const count = await context.database.assessmentFile.count({
    where: { assessmentId, phase: input.phase, removedAt: null, status: { not: "REJECTED" } },
  });
  if (count >= 20)
    throw badRequest(
      "Esta unidade já possui 20 anexos. Remova um envio incorreto antes de acrescentar outro.",
    );
  const row = await context.database.assessmentFile.create({
    data: {
      id: input.id,
      assessmentId,
      phase: input.phase,
      competence: input.competence ?? null,
      appointmentId: input.appointmentId ?? null,
      fileName: input.fileName,
      contentType: input.contentType,
      byteLength: input.byteLength,
      uploadedById: context.staffUser.id,
      updatedAt: context.now,
    },
  });
  return { row, received: false };
}

export async function authorizedFile(context: AssessmentContext, id: string) {
  const row = await context.database.assessmentFile.findUnique({
    where: { id },
    include: {
      assessment: {
        select: {
          deletedAt: true,
          progressRecords: { where: { deletedAt: null }, select: { id: true } },
        },
      },
    },
  });
  if (!row || row.removedAt || row.assessment.deletedAt) throw notFound("Anexo não encontrado.");
  if (context.staffUser.role !== "TEACHER" || row.uploadedById === context.staffUser.id) return row;
  for (const reference of row.assessment.progressRecords) {
    const progress = await loadProgress(context.database, reference.id);
    try {
      await assertProgressAccess(context, progress);
      return row;
    } catch (error) {
      if (!(error instanceof TRPCError) || error.code !== "FORBIDDEN") throw error;
    }
  }
  throw new TRPCError({
    code: "FORBIDDEN",
    message: "Este anexo não pertence às suas atribuições.",
  });
}

export async function filesForProgress(context: AssessmentContext, progressId: string) {
  const progress = await loadProgress(context.database, progressId);
  await assertProgressAccess(context, progress);
  return progress.assessmentId
    ? context.database.assessmentFile.findMany({
        where: { assessmentId: progress.assessmentId, removedAt: null },
        select: fileView,
        orderBy: { createdAt: "asc" },
      })
    : [];
}
