import assert from "node:assert/strict";
import { it } from "node:test";
import {
  materialPriceQuote,
  materialScholarshipQuote,
  materialInstallmentPlan,
} from "../src/material-pricing.js";

void it("derives the school cash price from agreed card totals and the global fee", () => {
  assert.deepEqual(
    materialPriceQuote({ installments: 6, installmentCents: 12300, cardFeePct: 10 }),
    {
      installments: 6,
      installmentCents: 12300,
      totalCents: 73800,
      cashCents: 66420,
    },
  );
  assert.deepEqual(
    materialPriceQuote({ installments: 6, installmentCents: 13600, cardFeePct: 10 }),
    {
      installments: 6,
      installmentCents: 13600,
      totalCents: 81600,
      cashCents: 73440,
    },
  );
});

void it("rounds net once to cents and supports zero or full fee", () => {
  assert.equal(
    materialPriceQuote({ installments: 3, installmentCents: 1001, cardFeePct: 10 }).cashCents,
    2703,
  );
  assert.equal(
    materialPriceQuote({ installments: 1, installmentCents: 5, cardFeePct: 10 }).cashCents,
    5,
  );
  assert.equal(
    materialPriceQuote({ installments: 6, installmentCents: 12300, cardFeePct: 0 }).cashCents,
    73800,
  );
  assert.equal(
    materialPriceQuote({ installments: 6, installmentCents: 12300, cardFeePct: 100 }).cashCents,
    0,
  );
  assert.equal(
    materialPriceQuote({ installments: 6, installmentCents: 0, cardFeePct: 10 }).cashCents,
    0,
  );
});

void it("rejects invalid quantities, amounts and fee precision", () => {
  for (const [count, cents, discount] of [
    [0, 100, 10],
    [1.5, 100, 10],
    [6, -1, 10],
    [6, 1.5, 10],
    [2, 2147483647, 10],
    [6, 100, 101],
    [6, 100, 0.12345],
  ] as const) {
    assert.throws(
      () =>
        materialPriceQuote({ installments: count, installmentCents: cents, cardFeePct: discount }),
      /Invalid material pricing terms/u,
    );
  }
});

void it("divides two books over the agreed six installments without changing the acquisition total", () => {
  const quote = materialPriceQuote({ installments: 12, installmentCents: 13600, cardFeePct: 10 });
  const sale = materialScholarshipQuote({
    quote,
    payment: "INSTALLMENTS",
    scholarshipPct: 0,
    cardFeePct: 10,
  });
  assert.equal(sale.chargedCents, 163200);
  assert.equal(sale.receivableCents, 146880);
  assert.deepEqual(materialInstallmentPlan(sale.chargedCents, 6), {
    installmentCount: 6,
    installmentCents: 27200,
    lastInstallmentCents: 27200,
  });
  assert.deepEqual(materialInstallmentPlan(sale.chargedCents, 12), {
    installmentCount: 12,
    installmentCents: 13600,
    lastInstallmentCents: 13600,
  });
});

void it("applies scholarship and fees to the negotiated total and keeps the cent remainder in the last installment", () => {
  const quote = materialPriceQuote({ installments: 12, installmentCents: 13600, cardFeePct: 10 });
  const sale = materialScholarshipQuote({
    quote,
    payment: "INSTALLMENTS",
    priceOverrideCents: 150001,
    scholarshipPct: 0,
    cardFeePct: 10,
  });
  assert.equal(sale.chargedCents, 150001);
  assert.equal(sale.receivableCents, 135001);
  assert.deepEqual(materialInstallmentPlan(sale.chargedCents, 6), {
    installmentCount: 6,
    installmentCents: 25000,
    lastInstallmentCents: 25001,
  });
  const scholarship = materialScholarshipQuote({
    quote,
    payment: "INSTALLMENTS",
    priceOverrideCents: 150000,
    scholarshipPct: 20,
    cardFeePct: 10,
  });
  assert.equal(scholarship.chargedCents, 120000);
  assert.equal(scholarship.receivableCents, 108000);
  assert.equal(
    materialScholarshipQuote({
      quote,
      payment: "CASH",
      priceOverrideCents: 150000,
      scholarshipPct: 0,
      cardFeePct: 10,
    }).receivableCents,
    150000,
  );
  assert.equal(quote.totalCents, 163200);
});

void it("rejects installments smaller than one cent and invalid negotiated prices", () => {
  for (const count of [0, 1.5, 101])
    assert.throws(() => materialInstallmentPlan(100, count), /quantidade de parcelas/);
  const quote = materialPriceQuote({ installments: 6, installmentCents: 13600, cardFeePct: 10 });
  for (const priceOverrideCents of [0, -1, 1.5, Number.NaN])
    assert.throws(
      () =>
        materialScholarshipQuote({
          quote,
          payment: "CASH",
          priceOverrideCents,
          scholarshipPct: 0,
          cardFeePct: 10,
        }),
      /valor de material/,
    );
});
