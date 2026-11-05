export function remainingAllocationCents(row: {
  amountCents: number;
  reversals: ReadonlyArray<{ amountCents: number }>;
}): number {
  return (
    row.amountCents - row.reversals.reduce((total, reversal) => total + reversal.amountCents, 0)
  );
}
