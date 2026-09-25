export function splitPrincipal(principalAmountCents: number, installmentCount: number): number[] {
  const baseAmount = Math.floor(principalAmountCents / installmentCount);
  const remainder = principalAmountCents - baseAmount * installmentCount;

  return Array.from({ length: installmentCount }, (_unused, index) =>
    index === installmentCount - 1 ? baseAmount + remainder : baseAmount,
  );
}
