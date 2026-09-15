import type { ReactElement } from "react";
import type { FinanceInstallmentRow } from "@lazuli/validators";
import { formatBRLFromCents } from "~/lib/format";

export function OverdueInstallmentAmount({ row }: { row: FinanceInstallmentRow }): ReactElement {
  const delta = row.collectibleBalanceCents - row.originalAmountCents;
  return (
    <span
      className="font-numeric inline-flex items-baseline gap-2 whitespace-nowrap tabular-nums"
      title={`Original: ${formatBRLFromCents(row.originalAmountCents)}`}
    >
      <strong className="font-semibold">{formatBRLFromCents(row.collectibleBalanceCents)}</strong>
      {delta === 0 ? null : (
        <span className="text-xs text-muted-foreground">
          <span aria-hidden="true">{delta < 0 ? "↓" : "↑"} </span>
          <span className="sr-only">
            {delta < 0 ? "Redução líquida de " : "Acréscimo líquido de "}
          </span>
          {formatBRLFromCents(Math.abs(delta))}
        </span>
      )}
    </span>
  );
}
