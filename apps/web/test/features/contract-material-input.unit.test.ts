import assert from "node:assert/strict";
import { it } from "node:test";
import {
  contractInputFromFields,
  emptyContractFields,
} from "../../src/features/contracts/contract-form-model.js";
import {
  materialCardFeeError,
  selectedMaterialCardFee,
} from "../../src/features/contracts/material-card-fee.js";
import { fieldErrors } from "../../src/features/contracts/new-contract-state.js";
import { setupValidation } from "../../src/features/contracts/contract-setup-model.js";
import { materialFinalPriceQuote, materialFinalSaleQuote } from "@lazuli/domain";
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

void it("quotes and submits a purchase-only card rate, including zero and decimal comma", () => {
  const fields = {
    ...base,
    materialStageIds: books[0]!,
    materialTotal: "77305",
    materialCardFeeMode: "CUSTOM",
    materialCardFeePct: "5,0",
  };
  const rate = selectedMaterialCardFee(fields, { "6": 10 });
  assert.equal(rate, 5);
  const quote = materialFinalPriceQuote({ cashCents: 73440, cardFeePct: rate });
  assert.equal(quote.totalCents, 77305);
  const parsed = contractInputFromFields(fields, command);
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.material!.cardFeeOverridePct, 5);
  assert.deepEqual(
    materialFinalSaleQuote({
      quote,
      payment: "INSTALLMENTS",
      scholarshipPct: 50,
      cardFeePct: rate,
      priceOverrideCents: 70000,
    }),
    {
      chargedCents: 36842,
      receivableCents: 35000,
      feeCents: 1842,
    },
  );
  const zero = { ...fields, materialCardFeePct: "0", materialTotal: "73440" };
  assert.equal(selectedMaterialCardFee(zero, { "6": 10 }), 0);
  const zeroInput = contractInputFromFields(zero, command);
  assert.equal(zeroInput.success, true);
  assert.equal(zeroInput.data.material!.cardFeeOverridePct, 0);
});

void it("restores the installment's default rate and leaves cash and full scholarships without overrides", () => {
  const fields = {
    ...base,
    materialStageIds: books[0]!,
    materialTotal: "81600",
    materialCardFeeMode: "CUSTOM",
    materialCardFeePct: "5",
  };
  const restored = { ...fields, materialCardFeeMode: "REFERENCE", materialInstallments: "3" };
  assert.equal(selectedMaterialCardFee(restored, { "3": 4, "6": 10 }), 4);
  const restoredInput = contractInputFromFields(restored, command);
  assert.equal(restoredInput.success, true);
  assert.equal(restoredInput.data.material!.cardFeeOverridePct, undefined);
  for (const changes of [
    { materialPayment: "CASH" },
    { materialScholarshipMode: "FULL", materialScholarshipAgreement: "Bolsa integral" },
  ]) {
    const draft = { ...fields, ...changes };
    assert.equal(selectedMaterialCardFee(draft, { "6": 10 }), 0);
    const parsed = contractInputFromFields(draft, command);
    assert.equal(parsed.success, true);
    assert.equal(parsed.data.material!.cardFeeOverridePct, undefined);
  }
});

void it("reports invalid card rates on the editable rate field and accepts an override without a configured rate", () => {
  const fields = {
    ...base,
    materialStageIds: books[0]!,
    materialTotal: "81600",
    materialCardFeeMode: "CUSTOM",
    materialCardFeePct: "5",
  };
  assert.equal(materialCardFeeError(fields, {}), "");
  assert.equal(selectedMaterialCardFee(fields, {}), 5);
  assert.match(
    materialCardFeeError({ ...fields, materialCardFeeMode: "REFERENCE" }, {}),
    /Informe a taxa desta compra/u,
  );
  for (const value of ["", "abc", "-1", "100", "Infinity", "1,23456"]) {
    const draft = { ...fields, materialCardFeePct: value };
    const parsed = contractInputFromFields(draft, command);
    assert.equal(parsed.success, false, value);
    assert.deepEqual(parsed.error.issues[0]!.path, ["material", "cardFeeOverridePct"], value);
    assert.equal(typeof fieldErrors(parsed, true).materialCardFeePct, "string", value);
    const setupErrors = setupValidation({
      fields: { ...draft, materialTotal: "" },
      commandId: command,
      offer: null,
    });
    assert.equal(typeof setupErrors.materialCardFeePct, "string", value);
    assert.equal(setupErrors.materialTotal, undefined, value);
    assert.notEqual(materialCardFeeError(draft, { "6": 10 }), "", value);
  }
});
