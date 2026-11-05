"use client";
import type { JSX as ReactJSX } from "react";
import { createContext, useContext } from "react";
import { DollarSign, FileText, Handshake } from "lucide-react";
import { Button, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@lazuli/ui";
import type { FinanceInstallmentRow } from "@lazuli/validators";
import { formatDateOnlyBR } from "~/lib/format";

type InstallmentActions = {
  receive: (row: FinanceInstallmentRow) => void;
  negotiate: (row: FinanceInstallmentRow) => void;
  viewProof: (row: FinanceInstallmentRow) => void;
};
export const InstallmentActionsContext = createContext<InstallmentActions | null>(null);

export function InstallmentRowActions({
  row,
}: {
  row: FinanceInstallmentRow;
}): ReactJSX.Element | null {
  const actions = useContext(InstallmentActionsContext);
  if (!actions) return null;
  const disabled = row.collectibleBalanceCents <= 0;
  const identity = `parcela ${row.sequenceNumber} de ${row.payer.name}, vencimento ${formatDateOnlyBR(row.dueDate)}`;
  if (row.status === "PAID")
    return (
      <Button
        type="button"
        size="sm"
        variant="ghost"
        aria-label={`Ver comprovante: ${identity}`}
        onClick={() => actions.viewProof(row)}
      >
        <FileText aria-hidden="true" /> Ver comprovante
      </Button>
    );
  if (row.status === "WAIVED") return null;
  return (
    <TooltipProvider>
      <div className="flex items-center justify-end gap-1">
        {[
          { label: "Registrar pagamento", Icon: DollarSign, action: actions.receive },
          { label: "Negociar", Icon: Handshake, action: actions.negotiate },
        ].map(({ label, Icon, action }) => (
          <Tooltip key={label}>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`${label}: ${identity}`}
                  disabled={disabled}
                  onClick={() => action(row)}
                />
              }
            >
              <Icon aria-hidden="true" />
            </TooltipTrigger>
            <TooltipContent>{disabled ? "Parcela sem saldo em aberto" : label}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
