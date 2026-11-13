import assert from "node:assert/strict";
import { it } from "node:test";
import { documentPrefill, type DocumentRow } from "../../src/features/student-documents/prefill.js";
import { initialNewStudentState } from "../../src/features/students/new-student/reducer.js";
const file: DocumentRow = {
  id: "synthetic",
  sessionId: "session",
  kind: "student",
  format: "image",
  status: "READY",
  title: null,
  subtitle: null,
  updatedAt: new Date("2026-10-26"),
  extraction: {
    fields: { name: "MARIA EXEMPLO", cpf: "529.982.247-25", rg: null, birthDate: "03/07/1988" },
  },
};
void it("prefills identity but preserves manually cleared and pre-existing fields", () => {
  const fields = { ...initialNewStudentState.fields, fullName: "Nome já confirmado" };
  assert.deepEqual(documentPrefill(file, { fields, touched: new Set(["birthDate"]) }), [
    ["documentNumber", "529.982.247-25"],
    ["documentType", "CPF"],
  ]);
  assert.deepEqual(
    documentPrefill(file, {
      fields: { ...fields, documentNumber: "RG EXISTENTE" },
      touched: new Set(["birthDate"]),
    }),
    [],
  );
});
void it("guardian identity cannot populate student fields and unfinished OCR cannot prefill", () => {
  assert.deepEqual(
    documentPrefill(
      { ...file, kind: "guardian" },
      { fields: initialNewStudentState.fields, touched: new Set() },
    ),
    [["guardianName", "MARIA EXEMPLO"]],
  );
  assert.deepEqual(
    documentPrefill(
      { ...file, status: "PROCESSING" },
      { fields: initialNewStudentState.fields, touched: new Set() },
    ),
    [],
  );
});
