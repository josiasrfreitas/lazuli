/**
 * `report-generate` worker handler (§6.2): load the artifact row, stamp
 * `startedAt`, build the CSV/PDF bytes, upload to GCS, stamp completion facts
 * — or stamp `failedAt` + `errorCode`/`errorMessage` (IDs only, never student
 * PII) on any failure.
 */

import type { Prisma } from "@lazuli/db";
import type { ArtifactStorage } from "@lazuli/integrations";
import type { ReportGeneratePayload } from "@lazuli/job-contracts";
import { reportGeneratePayloadSchema } from "@lazuli/job-contracts";

import {
  buildMonthlyAccountantCsv,
  loadMonthlyAccountantData,
} from "./csv/monthly-accountant-csv.js";
import {
  buildOverdueReceivablesCsv,
  loadOverdueReceivableRows,
} from "./csv/overdue-receivables-csv.js";
import { loadAttendanceSummaryTemplateData } from "./pdf/attendance-summary.js";
import { loadClassRosterTemplateData } from "./pdf/class-roster.js";
import { renderPdf } from "./pdf/render-pdf.js";
import { loadStudentStatementTemplateData } from "./pdf/student-statement.js";
import { ReportGenerationError } from "./report-error.js";
import type { ReportParameters } from "./report-parameters.js";
import { resolveReportParameters } from "./report-parameters.js";
import { buildAttendanceSummaryDocDefinition } from "./templates/attendance-summary.template.js";
import { buildClassRosterDocDefinition } from "./templates/class-roster.template.js";
import { buildStudentStatementDocDefinition } from "./templates/student-statement.template.js";

const CSV_CONTENT_TYPE = "text/csv; charset=utf-8";
const PDF_CONTENT_TYPE = "application/pdf";
const UNKNOWN_ERROR_CODE = "UNKNOWN";
const UNKNOWN_ERROR_MESSAGE = "Falha inesperada ao gerar o relatório.";

export type ProcessReportGenerateResult = {
  artifactId: string;
};

export type ReportGenerateDatabase = Pick<
  Prisma.TransactionClient,
  | "generatedArtifact"
  | "student"
  | "class"
  | "semester"
  | "enrollment"
  | "order"
  | "installment"
  | "paymentEntry"
  | "financeSettings"
>;

export type ReportOutput = {
  body: Uint8Array;
  contentType: string;
  fileName: string;
};

export async function processReportGenerate(input: {
  payload: ReportGeneratePayload;
  database: ReportGenerateDatabase;
  storage: ArtifactStorage;
  now?: Date;
}): Promise<ProcessReportGenerateResult> {
  const payload = reportGeneratePayloadSchema.parse(input.payload);
  const now = input.now ?? new Date();
  const artifact = await loadArtifact({ database: input.database, artifactId: payload.artifactId });

  await stampStarted({ database: input.database, artifactId: artifact.id, now });

  try {
    const parameters = resolveReportParameters({ artifact, now });
    const output = await buildReportOutput({ database: input.database, parameters, now });
    const stored = await input.storage.put({
      key: `reports/${artifact.id}/${output.fileName}`,
      contentType: output.contentType,
      body: output.body,
    });

    await stampCompleted({
      database: input.database,
      artifactId: artifact.id,
      now,
      output,
      stored,
    });
  } catch (error) {
    await stampFailed({ database: input.database, artifactId: artifact.id, now, error });
    throw error;
  }

  return { artifactId: artifact.id };
}

type ArtifactRow = {
  id: string;
  kind: string;
  studentId: string | null;
  classId: string | null;
  orderId: string | null;
};

async function loadArtifact(input: {
  database: ReportGenerateDatabase;
  artifactId: string;
}): Promise<ArtifactRow> {
  const artifact = await input.database.generatedArtifact.findFirst({
    where: { id: input.artifactId, deletedAt: null },
    select: { id: true, kind: true, studentId: true, classId: true, orderId: true },
  });

  if (artifact === null) {
    throw new ReportGenerationError({
      code: "SETUP_ERROR_ARTIFACT_NOT_FOUND",
      message: `Artefato ${input.artifactId} não encontrado.`,
    });
  }

  return artifact;
}

export async function buildReportOutput(input: {
  database: ReportGenerateDatabase;
  parameters: ReportParameters;
  now: Date;
}): Promise<ReportOutput> {
  const { database, parameters, now } = input;

  switch (parameters.kind) {
    case "OVERDUE_RECEIVABLES_CSV": {
      const rows = await loadOverdueReceivableRows({ database, now });
      return csvOutput({ csv: buildOverdueReceivablesCsv(rows), fileName: "inadimplencia.csv" });
    }
    case "MONTHLY_ACCOUNTANT_CSV": {
      const data = await loadMonthlyAccountantData({ database, ...parameters });
      const month = String(parameters.month).padStart(2, "0");
      return csvOutput({
        csv: buildMonthlyAccountantCsv(data),
        fileName: `contabilidade-${parameters.year}-${month}.csv`,
      });
    }
    case "STUDENT_STATEMENT_PDF": {
      const data = await loadStudentStatementTemplateData({ database, ...parameters, now });
      return pdfOutput({
        body: await renderPdf(buildStudentStatementDocDefinition(data)),
        fileName: "extrato-financeiro.pdf",
      });
    }
    case "CLASS_ROSTER_PDF": {
      const data = await loadClassRosterTemplateData({ database, ...parameters, now });
      return pdfOutput({
        body: await renderPdf(buildClassRosterDocDefinition(data)),
        fileName: "lista-de-turma.pdf",
      });
    }
    case "ATTENDANCE_SUMMARY_PDF": {
      const data = await loadAttendanceSummaryTemplateData({ database, ...parameters, now });
      return pdfOutput({
        body: await renderPdf(buildAttendanceSummaryDocDefinition(data)),
        fileName: "resumo-de-frequencia.pdf",
      });
    }
  }
}

function csvOutput(input: { csv: string; fileName: string }): ReportOutput {
  return {
    body: new TextEncoder().encode(input.csv),
    contentType: CSV_CONTENT_TYPE,
    fileName: input.fileName,
  };
}

function pdfOutput(input: { body: Uint8Array; fileName: string }): ReportOutput {
  return { body: input.body, contentType: PDF_CONTENT_TYPE, fileName: input.fileName };
}

async function stampStarted(input: {
  database: ReportGenerateDatabase;
  artifactId: string;
  now: Date;
}): Promise<void> {
  await input.database.generatedArtifact.update({
    where: { id: input.artifactId },
    data: {
      startedAt: input.now,
      completedAt: null,
      failedAt: null,
      errorCode: null,
      errorMessage: null,
    },
  });
}

async function stampCompleted(input: {
  database: ReportGenerateDatabase;
  artifactId: string;
  now: Date;
  output: ReportOutput;
  stored: { bucket: string; key: string };
}): Promise<void> {
  await input.database.generatedArtifact.update({
    where: { id: input.artifactId },
    data: {
      storageBucket: input.stored.bucket,
      storageObject: input.stored.key,
      contentType: input.output.contentType,
      fileName: input.output.fileName,
      completedAt: input.now,
    },
  });
}

async function stampFailed(input: {
  database: ReportGenerateDatabase;
  artifactId: string;
  now: Date;
  error: unknown;
}): Promise<void> {
  const known = input.error instanceof ReportGenerationError ? input.error : null;

  await input.database.generatedArtifact.update({
    where: { id: input.artifactId },
    data: {
      failedAt: input.now,
      errorCode: known === null ? UNKNOWN_ERROR_CODE : known.code,
      errorMessage: known === null ? UNKNOWN_ERROR_MESSAGE : known.message,
    },
  });
}
