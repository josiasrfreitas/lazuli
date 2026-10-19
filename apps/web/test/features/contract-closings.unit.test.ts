import assert from "node:assert/strict";
import { test } from "node:test";
import {
  closingGrowth,
  closingRows,
  closingSummary,
} from "../../src/features/finance-analytics/contract-closings-model.js";
import type { Analytics } from "../../src/features/finance-analytics/chart-shared.js";

function analytics(asOf = "2026-04-16", year = 2026): Analytics {
  return {
    year,
    asOf,
    months: [],
    methods: [],
    aging: [],
    receivedCents: 0,
    expectedCents: 0,
    overdueCents: 0,
    overduePayers: 0,
    maturedCents: 0,
    settledMaturedCents: 0,
    contractClosings: {
      incompleteCount: 0,
      months: [
        { month: "2026-01", projectedCents: 0, count: 0, monthlyEquivalentCents: 0 },
        { month: "2026-02", projectedCents: 100_000, count: 4, monthlyEquivalentCents: 10_000 },
        { month: "2026-03", projectedCents: 150_000, count: 2, monthlyEquivalentCents: 15_000 },
        { month: "2026-04", projectedCents: 10_000, count: 1, monthlyEquivalentCents: 1000 },
      ],
    },
  };
}

void test("annual volume includes completed months and the partial month without switching to a monthly total", () => {
  assert.deepEqual(closingSummary(analytics()), {
    period: "em 2026",
    totals: { projectedCents: 260_000, count: 7, monthlyEquivalentCents: 26_000 },
  });
  assert.deepEqual(
    closingRows(analytics("2026-03-16")).map((row) => row.month),
    ["2026-01", "2026-02", "2026-03"],
  );
});

void test("growth excludes the unfinished month and distinguishes volume growth from contract count", () => {
  const data = analytics();
  assert.deepEqual(closingGrowth(data, "projectedCents"), {
    month: "2026-03",
    previousMonth: "2026-02",
    rate: 0.5,
  });
  assert.deepEqual(closingGrowth(data, "count"), {
    month: "2026-03",
    previousMonth: "2026-02",
    rate: -0.5,
  });
});

void test("zero baseline, January and future periods do not invent a growth percentage", () => {
  assert.deepEqual(closingGrowth(analytics("2026-03-16"), "projectedCents"), {
    month: "2026-02",
    previousMonth: "2026-01",
    rate: null,
  });
  assert.equal(closingGrowth(analytics("2026-01-16"), "count"), null);
  assert.deepEqual(closingSummary(analytics("2025-12-31")), {
    period: "em 2026",
    totals: { projectedCents: 0, count: 0, monthlyEquivalentCents: 0 },
  });
  assert.equal(closingGrowth(analytics("2025-12-31"), "projectedCents"), null);
});

void test("a completed historical year includes December when comparing its last two months", () => {
  const data = analytics("2027-01-01");
  data.contractClosings.months = [
    { month: "2026-11", projectedCents: 80_000, count: 2, monthlyEquivalentCents: 8000 },
    { month: "2026-12", projectedCents: 0, count: 0, monthlyEquivalentCents: 0 },
  ];
  assert.deepEqual(closingGrowth(data, "projectedCents"), {
    month: "2026-12",
    previousMonth: "2026-11",
    rate: -1,
  });
  assert.equal(closingSummary(data).totals.projectedCents, 80_000);
});
