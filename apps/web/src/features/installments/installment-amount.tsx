import type { ReactElement } from "react";
import type { FinanceInstallmentRow } from "@lazuli/validators";
import { installmentAmountVm } from "./view-model";

export function InstallmentAmount({ row }: { row: FinanceInstallmentRow }): ReactElement {
  const amount = installmentAmountVm(row);
  return (
    <div className="font-numeric whitespace-nowrap tabular-nums">
      <strong className="block font-semibold">
        {amount.label}: {amount.value}
      </strong>
      <span className="block text-xs text-muted-foreground">Nominal: {amount.nominal}</span>
      {amount.adjustment === null ? null : (
        <span className="block text-xs text-muted-foreground">
          {amount.adjustment.label}: {amount.adjustment.value}
        </span>
      )}
      {amount.received === null ? null : (
        <span className="block text-xs text-muted-foreground">Recebido: {amount.received}</span>
      )}
    </div>
  );
}
