const PERCENT_PRECISION = 10_000;
const ROUNDING_DIVISOR = 2n;

/** Rescission uses unpaid principal, never already received amounts or punctuality discounts. */
export function terminationFeeCents(openPrincipalCents: number, percentage: number): number {
  const rate = BigInt(Math.round(percentage * PERCENT_PRECISION));
  const divisor = 1_000_000n;
  return Number((BigInt(openPrincipalCents) * rate + divisor / ROUNDING_DIVISOR) / divisor);
}
