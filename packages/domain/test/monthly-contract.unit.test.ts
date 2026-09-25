import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  addCalendarMonths,
  previewMonthlyContract,
  priceAfterDiscountCents,
} from "../src/monthly-contract.js";

const TERM_MONTHS = 12;
const EXPECTED_PRINCIPAL_CENTS = 300_000;
const EXPECTED_ON_TIME_CENTS = 20_000;
const JANUARY_31 = "2026-01-31";
const MARCH_31 = "2026-03-31";
const ROUNDING_AMOUNT_CENTS = 101;
const ROUNDING_DISCOUNT_PCT = 50;
const EXPECTED_ROUNDED_CENTS = 51;

void describe("monthly contract", () => {
  void it("ends a twelve-month term on the same calendar day and preserves the nominal total", () => {
    const preview = previewMonthlyContract({
      startsOn: "2026-03-15",
      durationMonths: TERM_MONTHS,
      firstDueDate: MARCH_31,
      monthlyAmountCents: 25_000,
      tuitionCeilingCents: 25_000,
      maximumDiscountPct: 20,
      punctualityDiscountPct: 20,
    });
    assert.equal(preview.endsOn, "2027-03-15");
    assert.equal(preview.principalAmountCents, EXPECTED_PRINCIPAL_CENTS);
    assert.equal(preview.installments.length, TERM_MONTHS);
    assert.equal(
      preview.installments.reduce((sum, row) => sum + row.amountCents, 0),
      EXPECTED_PRINCIPAL_CENTS,
    );
    assert.equal(preview.onTimeMonthlyCents, EXPECTED_ON_TIME_CENTS);
  });

  void it("clamps a missing day then returns to the original day", () => {
    assert.equal(addCalendarMonths(JANUARY_31, 1), "2026-02-28");
    assert.equal(addCalendarMonths(JANUARY_31, 2), MARCH_31);
    assert.equal(addCalendarMonths("2028-01-31", 1), "2028-02-29");
    assert.equal(addCalendarMonths("2026-01-05", 1), "2026-02-05");
  });

  void it("applies the negotiation floor to the agreed price, independently of punctuality", () => {
    assert.equal(
      priceAfterDiscountCents(ROUNDING_AMOUNT_CENTS, ROUNDING_DISCOUNT_PCT),
      EXPECTED_ROUNDED_CENTS,
    );
    const terms = {
      startsOn: "2026-03-15",
      durationMonths: 1,
      firstDueDate: MARCH_31,
      monthlyAmountCents: 20_000,
      tuitionCeilingCents: 25_000,
      maximumDiscountPct: 20,
      punctualityDiscountPct: 8,
    };
    const preview = previewMonthlyContract(terms);
    assert.equal(preview.floorCents, 20_000);
    assert.equal(preview.onTimeMonthlyCents, 18_400);
    assert.throws(
      () => previewMonthlyContract({ ...terms, monthlyAmountCents: 19_999 }),
      /fora da faixa/,
    );
    assert.throws(
      () => previewMonthlyContract({ ...terms, monthlyAmountCents: 25_001 }),
      /fora da faixa/,
    );
  });
});

void describe("special contract installments", () => {
  const terms = {
    startsOn: "2026-01-31",
    durationMonths: 12,
    firstDueDate: "2026-01-31",
    monthlyAmountCents: 25_000,
    tuitionCeilingCents: 25_000,
    maximumDiscountPct: 20,
    punctualityDiscountPct: 20,
  };
  void it("distributes the same agreement across fewer monthly charges", () => {
    const preview = previewMonthlyContract({ ...terms, installmentCount: 3 });
    assert.equal(preview.principalAmountCents, 300_000);
    assert.equal(preview.endsOn, "2027-01-31");
    assert.deepEqual(preview.installments, [
      { sequenceNumber: 1, amountCents: 100_000, dueDate: "2026-01-31" },
      { sequenceNumber: 2, amountCents: 100_000, dueDate: "2026-02-28" },
      { sequenceNumber: 3, amountCents: 100_000, dueDate: "2026-03-31" },
    ]);
    assert.equal(preview.onTimeMonthlyCents, 20_000);
  });
  void it("puts the entire cent remainder in the final installment", () => {
    const preview = previewMonthlyContract({ ...terms, durationMonths: 4, installmentCount: 3 });
    assert.deepEqual(
      preview.installments.map((row) => row.amountCents),
      [33333, 33333, 33334],
    );
    assert.equal(
      preview.installments.reduce((sum, row) => sum + row.amountCents, 0),
      100_000,
    );
    assert.equal(preview.endsOn, "2026-05-31");
  });
  void it("accepts one charge and the full duration without changing the principal", () => {
    assert.deepEqual(previewMonthlyContract({ ...terms, installmentCount: 1 }).installments, [
      { sequenceNumber: 1, amountCents: 300_000, dueDate: "2026-01-31" },
    ]);
    assert.deepEqual(
      previewMonthlyContract({ ...terms, installmentCount: 12 }),
      previewMonthlyContract(terms),
    );
  });
  for (const count of [0, -1, 1.5, 13, Number.NaN, Number.POSITIVE_INFINITY]) {
    void it(`rejects an invalid installment count of ${count}`, () => {
      assert.throws(
        () => previewMonthlyContract({ ...terms, installmentCount: count }),
        /quantidade inteira/,
      );
    });
  }
});
