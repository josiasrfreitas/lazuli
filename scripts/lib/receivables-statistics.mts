import assert from "node:assert/strict";

export const round = (number: number) => Math.round(number * 100) / 100;

/** Empirical nearest-rank quantiles; these are descriptive, not population estimates. */
export function summarize(numbers: number[]) {
  assert(numbers.length > 0, "No successful samples.");
  const sorted = [...numbers].sort((a, b) => a - b);
  const percentile = (fraction: number) => sorted[Math.ceil(sorted.length * fraction) - 1]!;
  const mean = numbers.reduce((sum, number) => sum + number, 0) / numbers.length;
  const standardDeviation = Math.sqrt(
    numbers.reduce((sum, value) => sum + (value - mean) ** 2, 0) / numbers.length,
  );
  return {
    n: numbers.length,
    min: round(sorted[0]!),
    p50: round(percentile(0.5)),
    p95: round(percentile(0.95)),
    p99: round(percentile(0.99)),
    max: round(sorted.at(-1)!),
    mean: round(mean),
    standardDeviation: round(standardDeviation),
    coefficientOfVariationPercent: mean === 0 ? null : round((standardDeviation / mean) * 100),
    p99Rank: Math.ceil(numbers.length * 0.99),
    observationsAboveP99Rank: numbers.length - Math.ceil(numbers.length * 0.99),
  };
}
