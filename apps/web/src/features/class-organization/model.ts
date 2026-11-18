import { formatDateOnlyBR } from "~/lib/format";
import {
  type ClassPlan,
  type Placement,
  type OrganizationBoard,
} from "~/features/class-organization/shared";

const ISO_DATE_LENGTH = 10;
const MILLISECONDS_PER_DAY = 86_400_000;
const RENEWAL_WARNING_DAYS = 45;

export type { ClassPlan, Placement, OrganizationBoard } from "~/features/class-organization/shared";
export type OrganizationAction =
  | { kind: "riskLimit" }
  | { kind: "postpone"; plan: ClassPlan }
  | { kind: "plan"; plan?: ClassPlan; group?: PendingGroup }
  | { kind: "placement"; studentId: string; row?: Placement; planId?: string }
  | { kind: "move" | "decline"; rows: Placement[]; planId?: string }
  | { kind: "continuity"; row: Placement }
  | { kind: "planStatus"; plan: ClassPlan; open: boolean }
  | { kind: "history" | "withdraw"; row: Placement }
  | { kind: "findStudent" };
export const rowsFor = (board: OrganizationBoard, planId: string): Placement[] =>
  board.placements.filter((row) => row.planId === planId && !row.declinedAt);
export type PendingGroup = {
  stageId: string;
  stageCode: string;
  rows: Placement[];
  leads: OrganizationBoard["waitingLeads"];
};
export const stageLabel = (code: string | null | undefined): string =>
  code ? `Estágio ${code}` : "Estágio a definir";
export function compatible(row: Placement, plan: ClassPlan): boolean {
  if (
    row.continuity === "CHANGE" &&
    (row.planId === plan.id ||
      (row.sourceClassId &&
        (row.sourceClassId === plan.classId || row.sourceClassId === plan.sourceClassId)))
  )
    return false;
  return (
    plan.active && (plan.scheduleType === "PERSONALIZED" || plan.sharedStageId === row.stageId)
  );
}
export function suggestedPlans(row: Placement, board: OrganizationBoard): ClassPlan[] {
  return board.plans
    .filter((plan) => compatible(row, plan))
    .toSorted(
      (left, right) =>
        Number(right.scheduleType === "PERSONALIZED") -
          Number(left.scheduleType === "PERSONALIZED") ||
        Number(right.sourceClassId === row.sourceClassId) -
          Number(left.sourceClassId === row.sourceClassId),
    );
}
export function changeLabel(row: Placement, board: OrganizationBoard): string {
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
      label: `Contrato começa em ${formatDateOnlyBR(row.upcomingContract.startsOn.toISOString().slice(0, ISO_DATE_LENGTH))}`,
      warning: true,
    };
  if (!row.contract)
    return { label: row.lastContract ? "Renovar contrato" : "Sem contrato", warning: true };
  const days = row.contract.endsOn
    ? Math.ceil((new Date(row.contract.endsOn).getTime() - Date.now()) / MILLISECONDS_PER_DAY)
    : null;
  return days !== null && days <= RENEWAL_WARNING_DAYS
    ? { label: `Vence em ${Math.max(0, days)} dias`, warning: true }
    : { label: "Contrato vigente", warning: false };
}
