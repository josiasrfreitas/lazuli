/**
 * Student attendance summary PDF template (§7.2): per (enrollment, semester)
 * held/present/absent/percent/flag, with makeups as a separate operational
 * stat — they never enter the attendance numerator/denominator (§4.6).
 */

import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";

import { buildDataTable, buildReportDocument, metaLine } from "./layout.js";

export type AttendanceSummaryTemplateData = {
  generatedAt: string;
  studentName: string;
  semesterName: string;
  enrollments: readonly {
    classCode: string;
    heldSessions: number;
    presentCount: number;
    absentCount: number;
    percentLabel: string;
    flagged: boolean;
    makeupsAttended: number;
    makeupsTotal: number;
  }[];
};

const TABLE_HEADERS = [
  "Turma",
  "Aulas realizadas",
  "Presenças",
  "Faltas",
  "Frequência",
  "Situação",
  "Reposições",
] as const;

export function buildAttendanceSummaryDocDefinition(
  data: AttendanceSummaryTemplateData,
): TDocumentDefinitions {
  return buildReportDocument({
    title: `Resumo de frequência — ${data.studentName}`,
    generatedAtLabel: data.generatedAt,
    content: [
      metaLine("Semestre", data.semesterName),
      { text: "Frequência por turma", style: "sectionHeader" },
      enrollmentsSection(data.enrollments),
      {
        text: "Reposições são uma estatística operacional separada e não alteram a frequência.",
        style: "note",
      },
    ],
  });
}

function enrollmentsSection(enrollments: AttendanceSummaryTemplateData["enrollments"]): Content {
  if (enrollments.length === 0) {
    return { text: "Nenhuma matrícula no semestre selecionado.", style: "metaLine" };
  }

  return buildDataTable({
    headers: [...TABLE_HEADERS],
    rows: enrollments.map((enrollment) => [
      enrollment.classCode,
      String(enrollment.heldSessions),
      String(enrollment.presentCount),
      String(enrollment.absentCount),
      enrollment.percentLabel,
      enrollment.flagged ? "Em risco (< 75%)" : "Regular",
      `${enrollment.makeupsAttended} de ${enrollment.makeupsTotal}`,
    ]),
  });
}
