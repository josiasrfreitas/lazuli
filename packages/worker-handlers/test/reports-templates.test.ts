import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildAttendanceSummaryDocDefinition } from "../src/reports/templates/attendance-summary.template.js";
import { buildClassRosterDocDefinition } from "../src/reports/templates/class-roster.template.js";
import type { StudentStatementTemplateData } from "../src/reports/templates/student-statement.template.js";
import { buildStudentStatementDocDefinition } from "../src/reports/templates/student-statement.template.js";

const GENERATED_AT = "09/07/2026 10:00";
const CLASS_CODE = "ADU-A1-SEG";
const SEMESTER_NAME = "2026/1";
const PAYER_NAME = "Carlos Lima";
const STUDENT_NAME = "Ana Souza";
const START_DATE = "01/02/2026";
const HELD_SESSIONS = 16;
const PRESENT_COUNT = 11;
const ABSENT_COUNT = 5;

function collectTexts(node: unknown, sink: string[]): string[] {
  if (typeof node === "string") {
    sink.push(node);
  } else if (Array.isArray(node)) {
    for (const item of node) {
      collectTexts(item, sink);
    }
  } else if (typeof node === "object" && node !== null) {
    for (const value of Object.values(node)) {
      collectTexts(value, sink);
    }
  }

  return sink;
}

function textsOf(docDefinition: { content: unknown }): string {
  return collectTexts(docDefinition.content, []).join("\n");
}

void describe("class roster template", () => {
  void it("renders class metadata and the active student table", () => {
    const doc = buildClassRosterDocDefinition({
      generatedAt: GENERATED_AT,
      classCode: CLASS_CODE,
      teacherName: "Prof. Marina",
      semesterName: SEMESTER_NAME,
      scheduleLines: ["Segunda-feira 18:00–19:30"],
      students: [{ fullName: STUDENT_NAME, entryDate: START_DATE }],
    });
    const texts = textsOf(doc);

    assert.match(texts, /Lista de turma — ADU-A1-SEG/);
    assert.match(texts, /Prof\. Marina/);
    assert.match(texts, /2026\/1/);
    assert.match(texts, /Segunda-feira 18:00–19:30/);
    assert.match(texts, /Alunos ativos \(1\)/);
    assert.match(texts, /Ana Souza/);
    assert.match(texts, /Gerado em 09\/07\/2026 10:00/);
    assert.match(texts, /reposição não fazem parte/i);
  });

  void it("renders an empty-state line without a table", () => {
    const doc = buildClassRosterDocDefinition({
      generatedAt: GENERATED_AT,
      classCode: CLASS_CODE,
      teacherName: "Prof. Marina",
      semesterName: SEMESTER_NAME,
      scheduleLines: [],
      students: [],
    });

    assert.match(textsOf(doc), /Nenhum aluno ativo/);
  });
});

void describe("attendance summary template", () => {
  void it("renders per-enrollment counts, percent, flag, and makeup stat", () => {
    const doc = buildAttendanceSummaryDocDefinition({
      generatedAt: GENERATED_AT,
      studentName: "Bruno Souza",
      semesterName: SEMESTER_NAME,
      enrollments: [
        {
          classCode: CLASS_CODE,
          heldSessions: HELD_SESSIONS,
          presentCount: PRESENT_COUNT,
          absentCount: ABSENT_COUNT,
          percentLabel: "68,8%",
          flagged: true,
          makeupsAttended: 1,
          makeupsTotal: 2,
        },
      ],
    });
    const texts = textsOf(doc);

    assert.match(texts, /Resumo de frequência — Bruno Souza/);
    assert.match(texts, /68,8%/);
    assert.match(texts, /Em risco \(< 75%\)/);
    assert.match(texts, /1 de 2/);
    assert.match(texts, /não alteram a frequência/);
  });
});

function statementData(): StudentStatementTemplateData {
  return {
    generatedAt: GENERATED_AT,
    studentName: STUDENT_NAME,
    orders: [
      {
        orderId: "pedido-1",
        kindLabel: "Mensalidade",
        statusLabel: "Ativo",
        payerName: PAYER_NAME,
        principal: "R$ 4.500,00",
        startDate: START_DATE,
        cancelledNote: null,
        installments: [
          {
            dueDate: "15/06/2026",
            originalAmount: "R$ 450,00",
            currentExpected: "R$ 460,00",
            paid: "R$ 100,00",
            openBalance: "R$ 360,00",
            statusLabel: "Vencida",
          },
        ],
      },
    ],
    payments: [
      {
        date: "05/07/2026",
        payerName: PAYER_NAME,
        methodLabel: "Pix",
        amount: "R$ 450,00",
        allocated: "R$ 450,00",
        note: "",
      },
    ],
  };
}

void describe("student statement template", () => {
  void it("renders orders, installment statuses, and payments", () => {
    const texts = textsOf(buildStudentStatementDocDefinition(statementData()));

    assert.match(texts, /Extrato financeiro — Ana Souza/);
    assert.match(texts, /Pedido pedido-1 — Mensalidade \(Ativo\)/);
    assert.match(texts, /Vencida/);
    assert.match(texts, /Pagamentos e alocações/);
    assert.match(texts, /Pix/);
  });

  void it("marks cancelled orders as historical", () => {
    const doc = buildStudentStatementDocDefinition({
      generatedAt: GENERATED_AT,
      studentName: STUDENT_NAME,
      orders: [
        {
          orderId: "pedido-2",
          kindLabel: "Material",
          statusLabel: "Cancelado",
          payerName: PAYER_NAME,
          principal: "R$ 300,00",
          startDate: START_DATE,
          cancelledNote: "Pedido cancelado em 01/03/2026 10:00 — histórico não cobrável.",
          installments: [],
        },
      ],
      payments: [],
    });

    assert.match(textsOf(doc), /histórico não cobrável/);
  });
});
