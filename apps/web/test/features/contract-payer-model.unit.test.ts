import assert from "node:assert/strict";
import { it } from "node:test";
import {
  contractInputFromFields,
  emptyContractFields,
} from "../../src/features/contracts/contract-form-model.js";
import { fieldErrors } from "../../src/features/contracts/new-contract-state.js";

const COMMAND = "00000000-0000-4000-8000-000000000001";
const fields = {
  ...emptyContractFields,
  studentId: "00000000-0000-4000-8000-000000000002",
  payerId: "00000000-0000-4000-8000-000000000003",
  agreedOn: "15/03/2026",
  startsOn: "15/03/2026",
  firstDueDate: "31/03/2026",
  monthlyAmount: "250,00",
  payerName: " Maria ",
  payerDocumentType: "RG",
  payerDocumentNumber: "12.345.678-X",
  payerPhone: " 123 ",
  payerEmail: "maria@example.com",
};

void it("submits only the active payer source without consuming either draft", () => {
  const existing = contractInputFromFields(fields, COMMAND);
  assert.equal(existing.success, true);
  assert.equal(existing.data?.payerId, fields.payerId);
  assert.equal(existing.data?.newPayer, undefined);
  const created = contractInputFromFields({ ...fields, payerMode: "create" }, COMMAND);
  assert.deepEqual(created.data?.newPayer, {
    name: "Maria",
    documentType: "RG",
    documentNumber: "12.345.678-X",
    phone: "123",
    email: "maria@example.com",
  });
  assert.equal(created.data?.payerId, undefined);
  assert.deepEqual(contractInputFromFields(fields, COMMAND), existing);
});

void it("ignores an invalid inactive draft and directs document errors to its control", () => {
  const draft = { ...fields, payerName: "", payerDocumentType: "" };
  assert.equal(contractInputFromFields(draft, COMMAND).success, true);
  const parsed = contractInputFromFields({ ...draft, payerMode: "create" }, COMMAND);
  assert.deepEqual(fieldErrors(parsed, false), {
    payerName: "Campo obrigatorio.",
    payerDocumentType: "Informe o tipo do documento quando preencher o numero.",
  });
});

void it("sends optional blank contacts and document as absent", () => {
  const parsed = contractInputFromFields(
    {
      ...fields,
      payerMode: "create",
      payerDocumentType: "",
      payerDocumentNumber: " ",
      payerPhone: " ",
      payerEmail: " ",
    },
    COMMAND,
  );
  assert.equal(parsed.success, true);
  assert.deepEqual(parsed.data?.newPayer, {
    name: "Maria",
    documentType: undefined,
    documentNumber: undefined,
    phone: undefined,
    email: undefined,
  });
});
