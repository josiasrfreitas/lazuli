import type { ReactElement } from "react";
import { Badge, type BadgeVariant } from "@lazuli/ui";

import type { ContractRow } from "./contract-columns";

const LABELS: Record<ContractRow["status"], string> = {
  INADIMPLENTE: "Inadimplente",
  EM_DIA: "Em dia",
  QUITADO: "Quitado",
  SEM_SALDO: "Sem saldo a cobrar",
  CANCELADO: "Cancelada",
};
const VARIANTS: Record<ContractRow["status"], BadgeVariant> = {
  INADIMPLENTE: "destructive",
  EM_DIA: "success",
  QUITADO: "neutral",
  SEM_SALDO: "neutral",
  CANCELADO: "neutral",
};

export function ContractFinancialStatus({ row }: { row: ContractRow }): ReactElement {
  return <Badge variant={VARIANTS[row.status]}>{LABELS[row.status]}</Badge>;
}
