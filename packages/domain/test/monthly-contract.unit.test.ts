import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  addCalendarMonths,
  previewMonthlyContract,
  priceAfterDiscountCents,
} from "../src/monthly-contract.js";

void describe("monthly contract", () => {
  void it("ends a twelve-month term on the same calendar day and preserves the nominal total", () => {
    const preview = previewMonthlyContract({
      startsOn: "2026-03-15",
      durationMonths: 12,
      firstDueDate: "2026-03-31",
      monthlyAmountCents: 25_000,
      tuitionCeilingCents: 25_000,
      maximumDiscountPct: 20,
      punctualityDiscountPct: 20,
    });
    assert.equal(preview.endsOn, "2027-03-15");
    assert.equal(preview.principalAmountCents, 300_000);
    assert.equal(preview.installments.length, 12);
    assert.equal(
      preview.installments.reduce((sum, row) => sum + row.amountCents, 0),
      300_000,
    );
    assert.equal(preview.onTimeMonthlyCents, 20_000);
  });

  void it("clamps a missing day then returns to the original day", () => {
    assert.equal(addCalendarMonths("2026-01-31", 1), "2026-02-28");
    assert.equal(addCalendarMonths("2026-01-31", 2), "2026-03-31");
    assert.equal(addCalendarMonths("2028-01-31", 1), "2028-02-29");
  });

  void it("rounds an on-time price half up and rejects a price below the authorized floor", () => {
    assert.equal(priceAfterDiscountCents(101, 50), 51);
    assert.throws(
      () =>
        previewMonthlyContract({
          startsOn: "2026-03-15",
          durationMonths: 1,
          firstDueDate: "2026-03-31",
          monthlyAmountCents: 20_000,
          tuitionCeilingCents: 25_000,
          maximumDiscountPct: 20,
          punctualityDiscountPct: 8,
        }),
      /fora da faixa/,
    );
  });
});
