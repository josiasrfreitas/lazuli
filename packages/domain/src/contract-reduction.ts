export type ContractReductionLine = {
  id: string;
  sequence: number;
  principalCents: number;
  openPrincipalCents: number;
  balanceCents: number;
};

/** Reduce selected principal balances while preserving all previously settled principal. */
export function contractReduction<T extends ContractReductionLine>(
  lines: T[],
  newAmountCents: number,
): {
  lines: (T & { reductionCents: number; resultingBalanceCents: number })[];
  reductionCents: number;
} {
  if (!Number.isSafeInteger(newAmountCents) || newAmountCents < 0 || lines.length === 0)
    throw new Error("Informe o novo valor e selecione ao menos uma parcela.");
  const result = lines.map((line) => {
    const reductionCents = line.principalCents - newAmountCents;
    if (reductionCents <= 0)
      throw new Error(`Parcela ${line.sequence}: o novo valor deve ser menor que o atual.`);
    if (reductionCents > line.openPrincipalCents)
      throw new Error(
        `Parcela ${line.sequence}: o novo valor não pode reduzir o principal já pago.`,
      );
    return { ...line, reductionCents, resultingBalanceCents: line.balanceCents - reductionCents };
  });
  return {
    lines: result,
    reductionCents: result.reduce((sum, line) => sum + line.reductionCents, 0),
  };
}
