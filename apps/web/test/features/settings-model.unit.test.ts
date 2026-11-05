import assert from "node:assert/strict";
import { it } from "node:test";

import {
  bookQuote,
  displaySetting,
  floorLabel,
  loadedFields,
  validateSettings,
  type SettingsFields,
} from "../../src/features/settings/settings-model.js";

const fields: SettingsFields = {
  tuitionCeilingCents: "250,00",
  maximumDiscountPct: "20",
  punctualityDiscountPct: "0",
  interestRatePctMonthly: "2",
  cancellationFeePct: "10",
  childMaterialCashPriceCents: "664,20",
  adultMaterialCashPriceCents: "734,40",
  materialCardFeeRates: JSON.stringify({ 1: "0", 6: "10" }),
};

void it("saves cash reference prices and a card fee for each installment count", () => {
  assert.deepEqual(validateSettings(fields), {
    success: true,
    values: {
      tuitionCeilingCents: 25_000,
      maximumDiscountPct: 20,
      punctualityDiscountPct: 0,
      interestRatePctMonthly: 2,
      cancellationFeePct: 10,
      childMaterialCashPriceCents: 66_420,
      adultMaterialCashPriceCents: 73_440,
      materialCardFeeRates: { 1: 0, 6: 10 },
    },
  });
  assert.equal(floorLabel(fields), "R$200");
  assert.deepEqual(bookQuote(fields, { category: "child", installments: 6 }), {
    cashCents: 66_420,
    totalCents: 73_800,
  });
  assert.deepEqual(bookQuote(fields, { category: "adult", installments: 6 }), {
    cashCents: 73_440,
    totalCents: 81_600,
  });
  assert.equal(bookQuote(fields, { category: "child", installments: 2 }), null);
});

void it("displays cash prices and loads defaults for new settings", () => {
  assert.equal(displaySetting("childMaterialCashPriceCents", "120,50"), "R$120,50");
  assert.equal(displaySetting("childMaterialCashPriceCents", ""), "—");
  assert.equal(displaySetting("maximumDiscountPct", "20"), "20%");
  const loaded = loadedFields(null);
  assert.equal(loaded.childMaterialCashPriceCents, "664,20");
  assert.equal(loaded.adultMaterialCashPriceCents, "734,40");
  assert.equal((JSON.parse(loaded.materialCardFeeRates) as Record<string, string>)["6"], "10");
});

void it("rejects invalid rates and cash prices", () => {
  assert.deepEqual(validateSettings({ ...fields, materialCardFeeRates: '{"6":"100"}' }), {
    success: false,
    errors: { materialCardFeeRates: "Confira as taxas por quantidade de parcelas." },
  });
  assert.deepEqual(validateSettings({ ...fields, childMaterialCashPriceCents: "10,001" }), {
    success: false,
    errors: { childMaterialCashPriceCents: "Use no máximo duas casas decimais." },
  });
  assert.deepEqual(validateSettings({ ...fields, tuitionCeilingCents: "0" }), {
    success: false,
    errors: { tuitionCeilingCents: "A mensalidade deve ser maior que zero." },
  });
});
