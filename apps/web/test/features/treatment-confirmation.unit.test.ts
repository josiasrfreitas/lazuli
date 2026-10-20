import assert from "node:assert/strict";
import { it } from "node:test";
import type { FinancialTreatmentConfirm } from "@lazuli/validators";
import { TreatmentConfirmation } from "../../src/features/financial-treatments/treatment-confirmation.js";

const command: FinancialTreatmentConfirm = {
  commandId: "b1d74058-8fc2-480d-a2b4-81d1b578f7d2",
  version: "original-preview",
  reason: "Redução combinada com o responsável",
  rows: [
    {
      installmentId: "97aa1d65-3bb3-4da5-9451-2ec0694d186a",
      reductionCents: 1000,
      forgiveCharges: false,
    },
  ],
};

void it("keeps the exact command after a lost confirmation and ignores a replacement intent", () => {
  const confirmation = new TreatmentConfirmation();
  assert.deepEqual(confirmation.begin(command), command);
  assert.equal(confirmation.locked, true);
  assert.equal(confirmation.begin(command), undefined, "double-submit cannot send twice");
  confirmation.reject();
  assert.equal(confirmation.pending, false);
  assert.equal(confirmation.uncertain, true);
  assert.equal(confirmation.locked, true, "editing and closing remain locked");
  const replacement = {
    ...command,
    commandId: "73ca1dfd-9c08-49be-93fb-a7db1b135f4d",
    version: "refreshed-preview",
    reason: "Changed draft",
    rows: [{ ...command.rows[0]!, reductionCents: 2000 }],
  };
  assert.deepEqual(confirmation.begin(replacement), command);
  confirmation.reject("FORBIDDEN");
  assert.equal(confirmation.locked, true, "a later rejection cannot disprove the original commit");
  assert.deepEqual(confirmation.begin(replacement), command);
  confirmation.complete();
  assert.equal(confirmation.locked, false);
  assert.equal(confirmation.uncertain, false);
});

void it("unlocks a definitively rejected first attempt but preserves unknown server outcomes", () => {
  for (const code of ["BAD_REQUEST", "CONFLICT", "FORBIDDEN"]) {
    const confirmation = new TreatmentConfirmation();
    confirmation.begin(command);
    confirmation.reject(code);
    assert.equal(confirmation.locked, false, code);
    const replacement = { ...command, version: "changed" };
    assert.deepEqual(confirmation.begin(replacement), replacement, code);
  }
  const confirmation = new TreatmentConfirmation();
  confirmation.begin(command);
  confirmation.reject("INTERNAL_SERVER_ERROR");
  assert.equal(confirmation.uncertain, true);
  assert.equal(confirmation.locked, true);
});
