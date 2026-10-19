import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { financeSettingsInputSchema, tuitionFloorCents } from "../src/finance-settings.js";

const valid = {
  tuitionCeilingCents: 25_000,
  maximumDiscountPct: 20,
  interestRatePctDaily: 0.1,
  interestRatePctMonthly: 2,
  cancellationFeePct: 10,
  materialPriceCents: 12_000,
};
const DISCOUNT = 20;
const CEILING = 25_000;
const FLOOR = 20_000;
const FRACTIONAL_CEILING = 10_001;
const ROUNDED_FLOOR = 8001;
const EXCESSIVE_PRECISION = Number("0.12345");

void describe("global finance settings", () => {
  void it("rounds the derived tuition floor upward to a cent", () => {
    assert.equal(tuitionFloorCents(CEILING, DISCOUNT), FLOOR);
    assert.equal(tuitionFloorCents(FRACTIONAL_CEILING, DISCOUNT), ROUNDED_FLOOR);
  });

  void it("requires general settings while allowing older clients to omit book terms", () => {
    for (const key of Object.keys(valid).filter(
      (key) => key !== "materialPriceCents",
    ) as (keyof typeof valid)[]) {
      const candidate = { ...valid };
      delete (candidate as Partial<typeof valid>)[key];
      assert.equal(financeSettingsInputSchema.safeParse(candidate).success, false, key);
    }
    assert.deepEqual(financeSettingsInputSchema.parse(valid), valid);
    const { materialPriceCents: _legacy, ...general } = valid;
    assert.deepEqual(financeSettingsInputSchema.parse(general), general);
  });

  void it("rejects percentages the database would round at four decimal places", () => {
    const keys = [
      "maximumDiscountPct",
      "interestRatePctDaily",
      "interestRatePctMonthly",
      "cancellationFeePct",
    ] as const;
    const accepted = keys.map(
      (key) => financeSettingsInputSchema.safeParse({ ...valid, [key]: 0.1234 }).success,
    );
    const rounded = keys.map(
      (key) =>
        financeSettingsInputSchema.safeParse({ ...valid, [key]: EXCESSIVE_PRECISION }).success,
    );
    assert.deepEqual(accepted, [true, true, true, true]);
    assert.deepEqual(rounded, [false, false, false, false]);
  });
});

void it("rejects incomplete, fractional and overflowing installment terms", () => {
  for (const terms of [
    { childMaterialInstallments: 6 },
    { adultMaterialInstallmentCents: 13600 },
    { childMaterialInstallments: 1.5, childMaterialInstallmentCents: 12300 },
    { adultMaterialInstallments: 0, adultMaterialInstallmentCents: 13600 },
    { adultMaterialInstallments: 2, adultMaterialInstallmentCents: 2147483647 },
    { materialCardFeePct: 100.0001 },
    { materialCardFeePct: 0.12345 },
  ]) {
    const result = financeSettingsInputSchema.safeParse({ ...valid, ...terms });
    assert.equal(result.success, false, JSON.stringify(terms));
  }
  const terms = {
    ...valid,
    childMaterialInstallments: 6,
    childMaterialInstallmentCents: 0,
    materialCardFeePct: 100,
  };
  assert.deepEqual(financeSettingsInputSchema.parse(terms), terms);
});
