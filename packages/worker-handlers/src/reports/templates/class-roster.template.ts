/**
 * Class roster PDF template (§7.2): class, teacher, schedule, and active
 * enrollments. Makeup visitors are intentionally excluded from the base
 * roster; the per-session visitor view needs a session selector that does
 * not exist yet (follow-up in `report-parameters.ts`).
 */

import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";

import { buildDataTable, buildReportDocument, metaLine } from "./layout.js";

export type ClassRosterTemplateData = {
  generatedAt: string;
  classCode: string;
  teacherName: string;
  semesterName: string;
  scheduleLines: readonly string[];
  students: readonly { fullName: string; entryDate: string }[];
};

const STUDENT_HEADERS = ["Nº", "Aluno", "Início na turma"] as const;
const STUDENT_WIDTHS = ["auto", "*", "auto"] as const;

export function buildClassRosterDocDefinition(data: ClassRosterTemplateData): TDocumentDefinitions {
  return buildReportDocument({
    title: `Lista de turma — ${data.classCode}`,
    generatedAtLabel: data.generatedAt,
    content: [
      metaLine("Professor(a)", data.teacherName),
      metaLine("Semestre", data.semesterName),
      metaLine("Horários", data.scheduleLines.join(" · ")),
      { text: `Alunos ativos (${data.students.length})`, style: "sectionHeader" },
      studentsSection(data.students),
      {
        text: "Alunos de reposição não fazem parte da lista base da turma.",
        style: "note",
      },
    ],
  });
}

function studentsSection(students: ClassRosterTemplateData["students"]): Content {
  if (students.length === 0) {
    return { text: "Nenhum aluno ativo na data selecionada.", style: "metaLine" };
  }

  return buildDataTable({
    headers: [...STUDENT_HEADERS],
    widths: [...STUDENT_WIDTHS],
    rows: students.map((student, index) => [
      String(index + 1),
      student.fullName,
      student.entryDate,
    ]),
  });
}
