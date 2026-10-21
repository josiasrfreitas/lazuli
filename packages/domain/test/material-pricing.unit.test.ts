import assert from "node:assert/strict";
import { it } from "node:test";
import { materialPriceQuote } from "../src/material-pricing.js";

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
