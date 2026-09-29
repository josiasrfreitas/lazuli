import assert from "node:assert/strict";
import { completionErrorMessage } from "../../src/features/students/new-student/completion-errors.js";
import { it } from "node:test";
import { emptyContractFields } from "../../src/features/contracts/contract-form-model.js";
import {
  contractFieldsWithStudent,
  studentContractInput,
  studentContractPreview,
} from "../../src/features/students/new-student/finance-model.js";
import { initialNewStudentState } from "../../src/features/students/new-student/reducer.js";

const COMMAND = "00000000-0000-4000-8000-000000000011";
const student = {
  ...initialNewStudentState.fields,
  fullName: " Ana Souza ",
  birthDate: "15/03/2010",
  documentType: "RG",
  documentNumber: "12.345.678-X",
  phone: "(11) 91234-5678",
  email: "ana@example.com",
  guardianName: "Maria Souza",
  guardianPhone: "(11) 99999-8888",
  guardianEmail: "maria@example.com",
};
const fields = {
  ...emptyContractFields,
  payerMode: "create",
  payerName: "Maria Souza",
  agreedOn: "15/03/2026",
  firstDueDate: "31/03/2026",
  endsOn: "31/03/2027",
  monthlyAmount: "250,00",
};
const offer = { tuitionCeilingCents: 25_000, maximumDiscountPct: 20, punctualityDiscountPct: 0 };

void it("submits the full student draft without requiring a persisted beneficiary", () => {
  const result = studentContractInput({ fields, student, commandId: COMMAND });
  assert.equal(result.success, true);
  assert.equal(result.data?.studentId, undefined);
  assert.equal(result.data?.commandId, COMMAND);
  assert.deepEqual(result.data?.newStudent, {
    fullName: "Ana Souza",
    birthDate: new Date("2010-03-15T00:00:00.000Z"),
    documentType: "RG",
    documentNumber: "12.345.678-X",
    phone: "(11) 91234-5678",
    email: "ana@example.com",
    guardian: {
      mode: "create",
      input: { fullName: "Maria Souza", phone: "(11) 99999-8888", email: "maria@example.com" },
    },
  });
});

void it("adapts the student and guardian draft to the existing payer controls without changing payer data", () => {
  const adapted = contractFieldsWithStudent(fields, student);
  assert.equal(adapted.studentMode, "create");
  assert.equal(adapted.studentId, "");
  assert.equal(adapted.studentDraftName, " Ana Souza ");
  assert.equal(adapted.studentDocumentType, "RG");
  assert.equal(adapted.studentDocumentNumber, "12.345.678-X");
  assert.equal(adapted.studentPhone, "(11) 91234-5678");
  assert.equal(adapted.studentEmail, "ana@example.com");
  assert.equal(adapted.studentGuardianMode, "create");
  assert.equal(adapted.studentGuardianName, "Maria Souza");
  assert.equal(adapted.studentGuardianPhone, "(11) 99999-8888");
  assert.equal(adapted.studentGuardianEmail, "maria@example.com");
  assert.equal(adapted.payerName, fields.payerName);
  const noGuardian = contractFieldsWithStudent(fields, { ...student, guardianName: " " });
  assert.equal(noGuardian.studentGuardianMode, "");
});

void it("preserves principal and remainder in the read-only special-plan preview", () => {
  const special = {
    ...fields,
    endsOn: "31/07/2026",
    paymentPlan: "special",
    installmentCount: "3",
  };
  const preview = studentContractPreview({ fields: special, student, offer });
  assert.equal(preview?.principalAmountCents, 100_000);
  assert.equal(preview?.endsOn, "2026-07-31");
  assert.deepEqual(
    preview?.installments.map((row) => row.amountCents),
    [33333, 33333, 33334],
  );
  assert.equal(
    studentContractPreview({ fields: { ...special, installmentCount: "5" }, student, offer }),
    null,
  );
  assert.equal(studentContractPreview({ fields: special, student, offer: null }), null);
  assert.equal(special.installmentCount, "3");
});

void it("reuses a selected payer and excludes the inactive new-payer draft", () => {
  const result = studentContractInput({
    fields: { ...fields, payerMode: "existing", payerId: COMMAND, payerName: "" },
    student,
    commandId: COMMAND,
  });
  assert.equal(result.success, true);
  assert.equal(result.data?.payerId, COMMAND);
  assert.equal(result.data?.newPayer, undefined);
});

void it("keeps unexpected completion failures actionable without showing server internals", () => {
  const internal = completionErrorMessage({
    message: "Invalid prisma.student.update() invocation",
    data: { code: "INTERNAL_SERVER_ERROR" },
  });
  const network = completionErrorMessage({ message: "Failed to fetch", data: undefined });
  assert.equal(
    internal,
    "Não foi possível concluir o cadastro. Seus dados foram mantidos; tente novamente.",
  );
  assert.equal(network, internal);
});

void it("preserves the server's actionable financial rejection", () => {
  assert.equal(
    completionErrorMessage({
      message: "Confira a mensalidade e a quantidade de parcelas autorizadas.",
      data: { code: "BAD_REQUEST" },
    }),
    "Confira a mensalidade e a quantidade de parcelas autorizadas.",
  );
});
