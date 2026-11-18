import type { ClassPlan, Placement, OrganizationBoard } from "./model";

export const responseLabels = {
  UNDECIDED: "Ainda sem resposta",
  STAY: "Fica na turma",
  CHANGE: "Pediu outra turma",
  LEAVING: "Pensa em sair",
} as const;

export const confirmationLabels = {
  CONFIRMED: "Confirmado",
  PRECONFIRMED: "Pré-confirmado",
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
  preconfirmed: number;
  pending: number;
  leads: number;
} {
  const rows = board.placements.filter((row) => row.planId === plan.id && !row.declinedAt);
  const confirmed = new Set(plan.enrolledStudentIds);
  let pending = 0;
  for (const row of rows) {
    if (row.confirmation === "LEAVING" || row.confirmation === "CHANGING") {
      confirmed.delete(row.studentId);
      continue;
    }
    if (isConfirmed(row)) {
      if (!row.publishedAt || row.entryStatus === "SCHEDULED") confirmed.add(row.studentId);
    } else pending++;
  }
  return {
    confirmed: confirmed.size,
    preconfirmed: new Set(
      rows
        .filter((row) => row.confirmation === "PRECONFIRMED" && confirmed.has(row.studentId))
        .map((row) => row.studentId),
    ).size,
    pending,
    leads: board.waitingLeads.filter((lead) => lead.allocationPlanId === plan.id).length,
  };
}
