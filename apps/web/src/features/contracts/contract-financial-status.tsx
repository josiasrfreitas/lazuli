import type { ReactElement } from "react";
import { Badge, type BadgeVariant } from "@lazuli/ui";

import { formatBRLFromCents } from "~/lib/format";
import type { ContractRow } from "./contract-columns";

const LABELS: Record<ContractRow["status"], string> = {
  INADIMPLENTE: "Inadimplente",
  EM_DIA: "Em dia",
  QUITADO: "Quitado",
  SEM_SALDO: "Sem saldo a cobrar",
  CANCELADO: "Cobrança cancelada",
};
const VARIANTS: Record<ContractRow["status"], BadgeVariant> = {
  INADIMPLENTE: "destructive",
  EM_DIA: "success",
  QUITADO: "neutral",
  SEM_SALDO: "neutral",
  CANCELADO: "neutral",
};

export function ContractFinancialStatus({ row }: { row: ContractRow }): ReactElement {
  const { overdueCents, dueTodayCents, futureCents, zeroedByAdjustment } = row.financialSummary;
  return (
    <div className="flex flex-col items-start gap-1 whitespace-normal">
      <Badge variant={VARIANTS[row.status]}>{LABELS[row.status]}</Badge>
      {overdueCents > 0 && (
        <span className="font-numeric text-destructive">
          Em atraso: {formatBRLFromCents(overdueCents)}
        </span>
      )}
      {dueTodayCents > 0 && (
        <span className="font-numeric text-micro text-muted-foreground">
          Vence hoje: {formatBRLFromCents(dueTodayCents)}
        </span>
      )}
      {futureCents > 0 && (
        <span className="font-numeric text-micro text-muted-foreground">
          A vencer: {formatBRLFromCents(futureCents)}
        </span>
      )}
      {overdueCents + dueTodayCents + futureCents > 0 && (
        <span className="text-micro text-muted-foreground">Saldos registrados · sem prévias</span>
      )}
      {row.status === "SEM_SALDO" && row.paymentProgress.waived > 0 && (
        <span className="text-micro text-muted-foreground">Inclui dispensa de parcelas</span>
      )}
      {zeroedByAdjustment > 0 && (
        <span className="text-micro text-muted-foreground">
          {zeroedByAdjustment} {zeroedByAdjustment === 1 ? "parcela zerada" : "parcelas zeradas"}{" "}
          por ajuste
        </span>
      )}
    </div>
  );
}
