import { z } from "zod";

import { calendarYearSchema } from "./calendar.js";

const INVALID_ARTIFACT_ID_MESSAGE = "Identificador de artefato invalido.";
const INVALID_CLASS_ID_MESSAGE = "Identificador de turma invalido.";
const INVALID_STUDENT_ID_MESSAGE = "Identificador de aluno invalido.";
const INVALID_MONTH_MESSAGE = "Mes invalido.";

const MIN_MONTH = 1;
const MAX_MONTH = 12;

export const artifactKindSchema = z.enum([
  "STUDENT_STATEMENT_PDF",
  "CLASS_ROSTER_PDF",
  "ATTENDANCE_SUMMARY_PDF",
  "OVERDUE_RECEIVABLES_CSV",
  "MONTHLY_ACCOUNTANT_CSV",
  "SIGNED_ORDER_PDF",
]);

export const artifactStatusSchema = z.enum(["queued", "running", "ready", "failed"]);

export const reportMonthSchema = z
  .number({ invalid_type_error: INVALID_MONTH_MESSAGE })
  .int(INVALID_MONTH_MESSAGE)
  .min(MIN_MONTH, INVALID_MONTH_MESSAGE)
  .max(MAX_MONTH, INVALID_MONTH_MESSAGE);

export const requestStudentStatementInputSchema = z
  .object({
    studentId: z.string().uuid(INVALID_STUDENT_ID_MESSAGE),
  })
  .strict();

export const requestClassRosterInputSchema = z
  .object({
    classId: z.string().uuid(INVALID_CLASS_ID_MESSAGE),
    semesterId: z.string().uuid("Identificador de semestre invalido.").optional(),
  })
  .strict();

export const requestAttendanceSummaryInputSchema = z
  .object({
    studentId: z.string().uuid(INVALID_STUDENT_ID_MESSAGE),
    semesterId: z.string().uuid("Identificador de semestre invalido.").optional(),
  })
  .strict();

export const requestOverdueCsvInputSchema = z.object({}).strict();

export const requestMonthlyAccountantCsvInputSchema = z
  .object({
    year: calendarYearSchema,
    month: reportMonthSchema,
  })
  .strict();

export const getArtifactInputSchema = z
  .object({
    id: z.string().uuid(INVALID_ARTIFACT_ID_MESSAGE),
  })
  .strict();

export const reportRequestResultSchema = z
  .object({
    artifactId: z.string().uuid(),
    jobId: z.string().min(1),
  })
  .strict();

export const getArtifactOutputSchema = z
  .object({
    id: z.string().uuid(),
    kind: artifactKindSchema,
    status: artifactStatusSchema,
    requestedById: z.string().uuid().nullable(),
    studentId: z.string().uuid().nullable(),
    classId: z.string().uuid().nullable(),
    orderId: z.string().uuid().nullable(),
    storageBucket: z.string().nullable(),
    storageObject: z.string().nullable(),
    contentType: z.string().nullable(),
    fileName: z.string().nullable(),
    requestedAt: z.date(),
    startedAt: z.date().nullable(),
    completedAt: z.date().nullable(),
    failedAt: z.date().nullable(),
    errorCode: z.string().nullable(),
    errorMessage: z.string().nullable(),
    expiresAt: z.date().nullable(),
  })
  .strict();

export type ArtifactKind = z.infer<typeof artifactKindSchema>;
export type ArtifactStatus = z.infer<typeof artifactStatusSchema>;
export type GetArtifactOutput = z.infer<typeof getArtifactOutputSchema>;

export function deriveArtifactStatus(input: {
  startedAt: Date | null;
  completedAt: Date | null;
  failedAt: Date | null;
}): ArtifactStatus {
  if (input.failedAt !== null) {
    return "failed";
  }
  if (input.completedAt !== null) {
    return "ready";
  }
  if (input.startedAt !== null) {
    return "running";
  }
  return "queued";
}
