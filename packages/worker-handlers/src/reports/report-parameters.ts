/**
 * Maps a `GeneratedArtifact` row plus the injected `now` to fully-resolved,
 * typed parameters per report kind. The artifact row has no selection columns
 * yet (month / semesterId / sessionId), so period parameters default
 * deterministically from `now` in America/Sao_Paulo. Follow-up: persist the
 * tRPC selection inputs on the artifact row and thread them through here.
 */

import { saoPauloDateOnly } from "@lazuli/domain";

import { ReportGenerationError } from "./report-error.js";

const YEAR_END_INDEX = 4;
const MONTH_START_INDEX = 5;
const MONTH_END_INDEX = 7;

export type ReportArtifactRow = {
  id: string;
  kind: string;
  studentId: string | null;
  classId: string | null;
  orderId: string | null;
};

export type ReportParameters =
  | { kind: "STUDENT_STATEMENT_PDF"; studentId: string }
  | { kind: "ATTENDANCE_SUMMARY_PDF"; studentId: string }
  | { kind: "CLASS_ROSTER_PDF"; classId: string }
  | { kind: "OVERDUE_RECEIVABLES_CSV" }
  | { kind: "MONTHLY_ACCOUNTANT_CSV"; year: number; month: number };

export function resolveReportParameters(input: {
  artifact: ReportArtifactRow;
  now: Date;
}): ReportParameters {
  const { artifact, now } = input;

  switch (artifact.kind) {
    case "STUDENT_STATEMENT_PDF": {
      return { kind: artifact.kind, studentId: requireStudentId(artifact) };
    }
    case "ATTENDANCE_SUMMARY_PDF": {
      return { kind: artifact.kind, studentId: requireStudentId(artifact) };
    }
    case "CLASS_ROSTER_PDF": {
      return { kind: artifact.kind, classId: requireClassId(artifact) };
    }
    case "OVERDUE_RECEIVABLES_CSV": {
      return { kind: artifact.kind };
    }
    case "MONTHLY_ACCOUNTANT_CSV": {
      return { kind: artifact.kind, ...currentSaoPauloYearMonth(now) };
    }
    default: {
      throw new ReportGenerationError({
        code: "SETUP_ERROR_UNSUPPORTED_KIND",
        message: `Tipo de artefato sem geração automática: ${artifact.kind} (artefato ${artifact.id}).`,
      });
    }
  }
}

/** Current America/Sao_Paulo calendar month derived from the injected `now`. */
export function currentSaoPauloYearMonth(now: Date): { year: number; month: number } {
  const dateOnly = saoPauloDateOnly(now);

  return {
    year: Number(dateOnly.slice(0, YEAR_END_INDEX)),
    month: Number(dateOnly.slice(MONTH_START_INDEX, MONTH_END_INDEX)),
  };
}

function requireStudentId(artifact: ReportArtifactRow): string {
  if (artifact.studentId === null) {
    throw new ReportGenerationError({
      code: "SETUP_ERROR_MISSING_STUDENT_ID",
      message: `Artefato ${artifact.id} não tem aluno associado.`,
    });
  }

  return artifact.studentId;
}

function requireClassId(artifact: ReportArtifactRow): string {
  if (artifact.classId === null) {
    throw new ReportGenerationError({
      code: "SETUP_ERROR_MISSING_CLASS_ID",
      message: `Artefato ${artifact.id} não tem turma associada.`,
    });
  }

  return artifact.classId;
}
