import assert from "node:assert/strict";
import { it } from "node:test";
import {
  contractInputFromFields,
  contractPreview,
  emptyContractFields,
} from "../../src/features/contracts/contract-form-model.js";
import { fieldErrors } from "../../src/features/contracts/new-contract-state.js";

const COMMAND = "00000000-0000-4000-8000-000000000001";
const fields = {
  ...emptyContractFields,
  studentId: "00000000-0000-4000-8000-000000000002",
  payerId: "00000000-0000-4000-8000-000000000003",
  agreedOn: "15/03/2026",
  endsOn: "31/03/2027",
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
    payerDocumentNumber: "Confira o CPF ou RG informado.",
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

void it("derives the start and monthly plan from the first payment and end dates", () => {
  const parsed = contractInputFromFields(fields, COMMAND);
  assert.equal(parsed.data?.startsOn, "2026-03-31");
  assert.equal(parsed.data?.firstDueDate, "2026-03-31");
  assert.equal(parsed.data?.durationMonths, 12);
  const shorter = contractInputFromFields({ ...fields, endsOn: "30/09/2026" }, COMMAND);
  assert.equal(shorter.data?.durationMonths, 6);
  const preview = contractPreview(
    { ...fields, endsOn: "30/09/2026" },
    { tuitionCeilingCents: 25_000, maximumDiscountPct: 20, punctualityDiscountPct: 0 },
  );
  assert.equal(preview?.endsOn, "2026-09-30");
  assert.equal(preview?.principalAmountCents, 150_000);
  assert.equal(preview?.installments.length, 6);
  assert.equal(preview?.installments[0]?.dueDate, "2026-03-31");
});

for (const [firstDueDate, endsOn] of [
  ["31/01/2026", "28/02/2026"],
  ["31/01/2028", "29/02/2028"],
  ["31/12/2026", "31/01/2027"],
] as const) {
  void it(`calculates one calendar month from ${firstDueDate} to ${endsOn}`, () => {
    const parsed = contractInputFromFields({ ...fields, firstDueDate, endsOn }, COMMAND);
    assert.equal(parsed.data?.durationMonths, 1);
  });
}

for (const endsOn of ["", "31/02/2027", "31/03/2026", "28/02/2026", "30/04/2037", "15/09/2026"]) {
  void it(`rejects an invalid or nonmonthly term ending on ${endsOn}`, () => {
    const parsed = contractInputFromFields({ ...fields, endsOn }, COMMAND);
    assert.equal(parsed.success, false);
    assert.deepEqual(fieldErrors(parsed, false), {
      endsOn: "Informe uma data final entre 1 e 120 meses completos após o início.",
    });
  });
}
