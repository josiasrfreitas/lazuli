import type { ClassPlan, Placement, OrganizationBoard } from "./model";

export const confirmationExplanation =
  "Confirmação não é renovação de contrato. Estamos apenas confirmando a intenção de continuar para fins de planejamento da turma.";
export const confirmationLabels = {
  CONFIRMED: "Confirmado",
  PRECONFIRMED: "Pré-confirmado · contrato",
  PENDING: "A confirmar",
  CHANGING: "Troca de turma",
  LEAVING: "Possível saída",
} as const;
export const confirmationVariants = {
  CONFIRMED: "success",
  PRECONFIRMED: "info",
  PENDING: "warning",
  CHANGING: "warning",
  LEAVING: "warning",
} as const;
export function isConfirmed(row: Placement): boolean {
  return row.confirmation === "CONFIRMED" || row.confirmation === "PRECONFIRMED";
}
export function planMetrics(
  board: OrganizationBoard,
  plan: ClassPlan,
): {
  confirmed: number;
  pending: number;
  leads: number;
} {
  const rows = board.placements
    .filter((row) => row.planId === plan.id && !row.declinedAt)
    .filter((row) => row.confirmation !== "LEAVING" && row.confirmation !== "CHANGING");
  return {
    confirmed: rows.filter(isConfirmed).length,
    pending: rows.filter((row) => !isConfirmed(row)).length,
    leads: board.waitingLeads.filter((lead) => lead.allocationPlanId === plan.id).length,
  };
}
