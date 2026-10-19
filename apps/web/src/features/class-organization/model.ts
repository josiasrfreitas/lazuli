import { formatDateOnlyBR } from "~/lib/format";
import { availabilityCovers } from "@lazuli/domain";
import {
  type ClassPlan,
  type Placement,
  type SemesterBoard,
} from "~/features/semester-organization/shared";
export type { ClassPlan, Placement, SemesterBoard };
export type OrganizationAction =
  | { kind: "plan"; plan?: ClassPlan }
  | { kind: "placement"; studentId: string; row?: Placement; planId?: string }
  | { kind: "availability"; studentId: string }
  | { kind: "move" | "decline"; rows: Placement[] }
  | { kind: "history" | "withdraw"; row: Placement }
  | { kind: "renew"; contractId: string }
  | { kind: "closure"; date?: string }
  | { kind: "holidays" | "period" | "newSemester" | "student" | "findStudent" };
export const rowsFor = (board: SemesterBoard, planId: string): Placement[] =>
  board.placements.filter((row) => row.planId === planId && !row.declinedAt);
export function compatible(row: Placement, plan: ClassPlan): boolean {
  return (
    plan.active &&
    (plan.scheduleType === "PERSONALIZED" || plan.sharedStageId === row.stageId) &&
    Boolean(
      row.availability?.confirmed &&
      row.availability.formats.includes(plan.format) &&
      availabilityCovers(row.availability.slots, plan.slots),
    )
  );
}
export function suggestedPlans(row: Placement, board: SemesterBoard): ClassPlan[] {
  return board.plans
    .filter((plan) => compatible(row, plan))
    .sort(
      (left, right) =>
        Number(right.sourceClassId === row.sourceClassId) -
        Number(left.sourceClassId === row.sourceClassId),
    );
}
export function changeLabel(row: Placement, board: SemesterBoard): string {
  if (row.declinedAt) return "Não continuará";
  if (!row.planId) return "Sem turma";
  if (!row.sourceClassId) return "Nova entrada";
  const plan = board.plans.find((item) => item.id === row.planId);
  if (plan?.sourceClassId === row.sourceClassId || plan?.classId === row.sourceClassId)
    return "Continuidade";
  return "Transferência";
}
export function contractLabel(row: Placement): { label: string; warning: boolean } {
  if (!row.contract && row.upcomingContract?.startsOn)
    return {
      label: `Contrato começa em ${formatDateOnlyBR(row.upcomingContract.startsOn.toISOString().slice(0, 10))}`,
      warning: true,
    };
  if (!row.contract)
    return { label: row.lastContract ? "Renovar contrato" : "Sem contrato", warning: true };
  const days = row.contract.endsOn
    ? Math.ceil((new Date(row.contract.endsOn).getTime() - Date.now()) / 86_400_000)
    : null;
  return days !== null && days <= 45
    ? { label: `Vence em ${Math.max(0, days)} dias`, warning: true }
    : { label: "Contrato vigente", warning: false };
}
