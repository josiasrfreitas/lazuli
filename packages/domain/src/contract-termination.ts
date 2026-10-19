/** Rescission uses unpaid principal, never already received amounts or punctuality discounts. */
export function terminationFeeCents(openPrincipalCents: number, percentage: number): number {
  const rate = BigInt(Math.round(percentage * 10_000));
  const divisor = 1_000_000n;
  return Number((BigInt(openPrincipalCents) * rate + divisor / 2n) / divisor);
}
