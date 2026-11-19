import type { ClassPlan, Placement, OrganizationBoard } from "./model";

export const responseLabels = {
  UNDECIDED: "Sem impedimento sinalizado",
  STAY: "Sem impedimento sinalizado",
  CHANGE: "Pediu outra turma",
  LEAVING: "Risco de saída",
} as const;

export const confirmationLabels = {
  BLOCKED: "Continuidade bloqueada",
  CONFIRMED: "Confirmado na turma",
  PRECONFIRMED: "Pré-confirmado",
  PENDING: "Em formação",
  CHANGING: "Troca de turma",
  LEAVING: "Risco de saída",
} as const;
export const confirmationVariants = {
  BLOCKED: "destructive",
  CONFIRMED: "success",
  PRECONFIRMED: "info",
  PENDING: "warning",
  CHANGING: "warning",
  LEAVING: "warning",
} as const;
export function isReadyForAllocation(row: Placement): boolean {
  return Boolean(
    row.planId &&
    !row.publishedAt &&
    !row.declinedAt &&
    row.continuity !== "CHANGE" &&
    row.continuity !== "LEAVING" &&
    row.blockers.length === 0,
  );
}
export function planMetrics(
  board: OrganizationBoard,
  plan: ClassPlan,
): {
  expected: number;
  confirmed: number;
  preconfirmed: number;
  pending: number;
  leads: number;
} {
  const confirmed = new Set(plan.enrolledStudentIds);
  const preconfirmed = new Set<string>();
  const pending = new Set<string>();
  for (const row of board.placements) {
    if (row.planId !== plan.id) continue;
    if (row.declinedAt) {
      confirmed.delete(row.studentId);
    } else if (row.confirmation === "CONFIRMED") {
      if (row.entryStatus === "SCHEDULED") confirmed.add(row.studentId);
    } else if (row.confirmation === "PRECONFIRMED") {
      preconfirmed.add(row.studentId);
    } else if (row.continuity !== "CHANGE" && row.continuity !== "LEAVING") {
      pending.add(row.studentId);
    }
  }
  for (const id of confirmed) preconfirmed.delete(id);
  return {
    expected: confirmed.size + preconfirmed.size,
    confirmed: confirmed.size,
    preconfirmed: preconfirmed.size,
    pending: pending.size,
    leads: board.waitingLeads.filter((lead) => lead.allocationPlanId === plan.id).length,
  };
}
