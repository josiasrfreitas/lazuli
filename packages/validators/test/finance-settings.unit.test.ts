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

void describe("global finance settings", () => {
  void it("rounds the derived tuition floor upward to a cent", () => {
    assert.equal(tuitionFloorCents(CEILING, DISCOUNT), FLOOR);
    assert.equal(tuitionFloorCents(FRACTIONAL_CEILING, DISCOUNT), ROUNDED_FLOOR);
  });

  void it("requires each of the six settings", () => {
    for (const key of Object.keys(valid) as (keyof typeof valid)[]) {
      const candidate = { ...valid };
      delete (candidate as Partial<typeof valid>)[key];
      assert.equal(financeSettingsInputSchema.safeParse(candidate).success, false, key);
    }
    assert.deepEqual(financeSettingsInputSchema.parse(valid), valid);
  });
});
