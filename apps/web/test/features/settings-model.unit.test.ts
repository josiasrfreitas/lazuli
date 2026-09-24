import assert from "node:assert/strict";
import { it } from "node:test";

import {
  floorLabel,
  displaySetting,
  loadedFields,
  validateSettings,
  type SettingsFields,
} from "../../src/features/settings/settings-model.js";

const fields: SettingsFields = {
  tuitionCeilingCents: "250,00",
  maximumDiscountPct: "20",
  interestRatePctDaily: "0,1",
  interestRatePctMonthly: "2",
  cancellationFeePct: "10",
  materialPriceCents: "120,50",
};

void it("converts decimal entries to cents and percentage points without losing the daily fraction", () => {
  assert.deepEqual(validateSettings(fields), {
    success: true,
    values: {
      tuitionCeilingCents: 25_000,
      maximumDiscountPct: 20,
      interestRatePctDaily: 0.1,
      interestRatePctMonthly: 2,
      cancellationFeePct: 10,
      materialPriceCents: 12_050,
    },
  });
  assert.equal(floorLabel(fields), "R$200");
});

void it("shows units with current values and omits unnecessary decimal places", () => {
  assert.equal(displaySetting("tuitionCeilingCents", "250,00"), "R$250");
  assert.equal(displaySetting("materialPriceCents", "120,50"), "R$120,50");
  assert.equal(displaySetting("maximumDiscountPct", "20"), "20%");
  assert.equal(displaySetting("interestRatePctDaily", "0,1"), "0,1%");
  assert.equal(displaySetting("interestRatePctMonthly", "0"), "0%");
  assert.equal(displaySetting("materialPriceCents", ""), "—");
});

void it("accepts four decimal places for daily interest and validates its percentage bounds", () => {
  assert.equal(validateSettings({ ...fields, interestRatePctDaily: "0,1234" }).success, true);
  assert.deepEqual(validateSettings({ ...fields, interestRatePctMonthly: "101" }), {
    success: false,
    errors: { interestRatePctMonthly: "Use um percentual entre 0 e 100." },
  });
});

void it("keeps missing settings blank instead of inventing zero rates", () => {
  assert.deepEqual(loadedFields(null), {
    tuitionCeilingCents: "",
    maximumDiscountPct: "",
    interestRatePctDaily: "",
    interestRatePctMonthly: "",
    cancellationFeePct: "",
    materialPriceCents: "",
  });
  assert.deepEqual(validateSettings({ ...fields, interestRatePctDaily: " " }), {
    success: false,
    errors: { interestRatePctDaily: "Informe um valor." },
  });
});

void it("allows explicit zero rates and material price while rejecting a zero tuition", () => {
  const zero = {
    ...fields,
    maximumDiscountPct: "0",
    interestRatePctDaily: "0",
    interestRatePctMonthly: "0",
    cancellationFeePct: "0",
    materialPriceCents: "0",
  };
  assert.deepEqual(validateSettings(zero), {
    success: true,
    values: {
      tuitionCeilingCents: 25_000,
      maximumDiscountPct: 0,
      interestRatePctDaily: 0,
      interestRatePctMonthly: 0,
      cancellationFeePct: 0,
      materialPriceCents: 0,
    },
  });
  assert.deepEqual(validateSettings({ ...zero, tuitionCeilingCents: "0" }), {
    success: false,
    errors: { tuitionCeilingCents: "A mensalidade deve ser maior que zero." },
  });
});

void it("identifies the field to correct and hides the floor for malformed or excessive discounts", () => {
  assert.deepEqual(
    validateSettings({ ...fields, maximumDiscountPct: "101", materialPriceCents: "10,001" }),
    {
      success: false,
      errors: {
        maximumDiscountPct: "Use um percentual entre 0 e 100.",
        materialPriceCents: "Use no máximo duas casas decimais.",
      },
    },
  );
  for (const value of ["", "abc", "101", "-1", "Infinity"]) {
    assert.equal(floorLabel({ ...fields, maximumDiscountPct: value }), "—", value);
  }
});
