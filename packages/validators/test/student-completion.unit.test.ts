import assert from "node:assert/strict";
import { it } from "node:test";
import { studentCompletionInputSchema } from "../src/student-completion.js";

const commandId = "00000000-0000-4000-8000-000000000011";
const student = {
  fullName: "Ana Souza",
  documentType: "RG",
  documentNumber: "1234567",
  birthDate: new Date("1990-05-01T00:00:00.000Z"),
  phone: "82999990000",
};
const contract = {
  commandId,
  newStudent: student,
  newPayer: {
    name: "Maria Souza",
    documentType: "RG",
    documentNumber: "7654321",
    phone: "82999991111",
  },
  material: {
    stageIds: ["00000000-0000-4000-8000-000000000012"],
    category: "ADULT",
    payment: "CASH",
    installmentCount: 1,
    quoteVersion: "a".repeat(64),
    expectedTotalCents: 10_000,
  },
  agreedOn: "2026-03-15",
  startsOn: "2026-03-31",
  durationMonths: 12,
  firstDueDate: "2026-03-31",
  monthlyAmountCents: 25_000,
};

void it("accepts student-only and financial completion while requiring the draft beneficiary", () => {
  const skip = studentCompletionInputSchema.safeParse({
    commandId,
    student: { ...student, fullName: " Ana Souza " },
  });
  assert.equal(skip.success, true);
  assert.deepEqual(skip.data, { commandId, student });
  const complete = studentCompletionInputSchema.safeParse({ contract });
  assert.equal(complete.success, true);
  assert.deepEqual(complete.data, { contract });
  const { newStudent: _student, ...terms } = contract;
  const existing = studentCompletionInputSchema.safeParse({
    contract: { ...terms, studentId: commandId },
  });
  assert.equal(existing.success, false);
  assert.match(existing.error?.message ?? "", /rascunho do novo aluno/u);
});

void it("rejects a payload that combines both completion branches", () => {
  const result = studentCompletionInputSchema.safeParse({
    commandId,
    student,
    contract,
  });
  assert.equal(result.success, false);
  assert.match(result.error?.message ?? "", /unrecognized_keys/u);
});
