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
void it("starts with two slots but submits one, two or three chosen books", () => {
  assert.equal(emptyContractFields.materialStageIds.split(",").length, 2);
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
