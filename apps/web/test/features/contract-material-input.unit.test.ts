import assert from "node:assert/strict";
import { it } from "node:test";
import {
  contractInputFromFields,
  emptyContractFields,
} from "../../src/features/contracts/contract-form-model.js";
const books = [
  "00000000-0000-4000-8000-000000000004",
  "00000000-0000-4000-8000-000000000005",
  "00000000-0000-4000-8000-000000000006",
];
const base = {
  ...emptyContractFields,
  studentId: "00000000-0000-4000-8000-000000000002",
  payerId: "00000000-0000-4000-8000-000000000003",
  agreedOn: "31/01/2026",
  firstDueDate: "31/01/2026",
  endsOn: "31/01/2027",
  monthlyAmount: "250,00",
  materialPayment: "INSTALLMENTS",
  materialCategory: "ADULT",
  materialQuoteVersion: "a".repeat(64),
};
const command = "00000000-0000-4000-8000-000000000001";
void it("starts with one visible book and submits the chosen acquisition", () => {
  assert.equal(emptyContractFields.materialStageIds.split(",").length, 1);
  for (const count of [1, 2, 3]) {
    const parsed = contractInputFromFields(
      {
        ...base,
        materialStageIds: books.slice(0, count).join(","),
        materialTotal: String(81600 * count),
      },
      command,
    );
    assert.equal(parsed.success, true);
    assert.deepEqual(parsed.data.material!.stageIds, books.slice(0, count));
    assert.equal(parsed.data.material!.expectedTotalCents, 81600 * count);
    assert.equal(parsed.data.material!.installmentCount, 6);
  }
});
void it("rejects duplicate or unfinished book choices", () => {
  for (const ids of [`${books[0]},${books[0]}`, `${books[0]},`]) {
    const parsed = contractInputFromFields(
      { ...base, materialStageIds: ids, materialTotal: "163200" },
      command,
    );
    assert.equal(parsed.success, false);
    assert.equal(parsed.error.issues[0]!.path[1], "stageIds");
  }
});

void it("requires material in a new contract and permits renewal without a new acquisition", () => {
  const fields = { ...base, materialPayment: "NONE" };
  const initial = contractInputFromFields(fields, command);
  assert.equal(initial.success, false);
  assert.deepEqual(initial.error.issues[0]!.path, ["material", "stageIds"]);
  const renewal = contractInputFromFields(fields, command, books[0]);
  assert.equal(renewal.success, true);
  assert.equal(renewal.data.material, undefined);
});

void it("submits a negotiated acquisition price independently of the reference and installments", () => {
  const fields = {
    ...base,
    materialStageIds: books.slice(0, 2).join(","),
    materialTotal: "163200",
    materialPriceMode: "CUSTOM",
    materialCustomPrice: "1500,01",
    materialInstallments: "6",
  };
  const parsed = contractInputFromFields(fields, command);
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.material!.expectedTotalCents, 163200);
  assert.equal(parsed.data.material!.priceOverrideCents, 150001);
  assert.equal(parsed.data.material!.installmentCount, 6);
  const reference = contractInputFromFields({ ...fields, materialPriceMode: "REFERENCE" }, command);
  assert.equal(reference.success, true);
  assert.equal(reference.data.material!.priceOverrideCents, undefined);
  for (const invalid of ["", "0", "-10", "abc"]) {
    const result = contractInputFromFields({ ...fields, materialCustomPrice: invalid }, command);
    assert.equal(result.success, false);
    assert.deepEqual(result.error.issues[0]!.path, ["material", "priceOverrideCents"]);
  }
});
