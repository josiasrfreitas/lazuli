import { confirmationLabels } from "./confirmation";
import { formatDateOnlyBR } from "~/lib/format";
import {
  type ClassPlan,
  type Placement,
  type OrganizationBoard,
} from "~/features/class-organization/shared";

const ISO_DATE_LENGTH = 10;
const MILLISECONDS_PER_DAY = 86_400_000;
const OCCUPANCY_LEVELS = { underfilled: 4, good: 8 } as const;
const RENEWAL_WARNING_DAYS = 45;

export type { ClassPlan, Placement, OrganizationBoard } from "~/features/class-organization/shared";
export type OrganizationAction =
  | { kind: "plan"; plan?: ClassPlan; group?: PendingGroup }
  | { kind: "placement"; studentId: string; row?: Placement; planId?: string }
  | { kind: "move" | "decline"; rows: Placement[]; planId?: string }
  | { kind: "continuity"; row: Placement }
  | { kind: "planStatus"; plan: ClassPlan; open: boolean }
  | { kind: "history" | "withdraw"; row: Placement }
  | { kind: "closure"; date?: string }
  | { kind: "holidays" | "period" | "newSemester" | "findStudent" };
export const rowsFor = (board: OrganizationBoard, planId: string): Placement[] =>
  board.placements.filter((row) => row.planId === planId && !row.declinedAt);
export type PendingGroup = {
  stageId: string;
  stageCode: string;
  rows: Placement[];
  leads: OrganizationBoard["waitingLeads"];
};
export const isPending = (row: Placement): boolean =>
  !row.declinedAt &&
  row.continuity !== "LEAVING" &&
  (!row.publishedAt || row.continuity === "CHANGE");
export const isQueueItem = (row: Placement): boolean =>
  isPending(row) || row.continuity === "LEAVING" || Boolean(row.declinedAt);
export const stageLabel = (code: string | null | undefined): string =>
  code ? `Estágio ${code}` : "Estágio a definir";
/** Proposals and leads are not enrolled students and must not inflate occupancy. */
export function occupancy(plan: ClassPlan): {
  readonly count: number;
  readonly tone: "warning" | "success" | "destructive";
  readonly label: "Poucos alunos" | "Em composição" | "Boa ocupação";
} {
  const count = plan.enrolledCount ?? 0;
  return { count, ...occupancyState(count) } as const;
}
function occupancyState(count: number): Omit<ReturnType<typeof occupancy>, "count"> {
  if (count < OCCUPANCY_LEVELS.underfilled) return { tone: "destructive", label: "Poucos alunos" };
  if (count < OCCUPANCY_LEVELS.good) return { tone: "warning", label: "Em composição" };
  return { tone: "success", label: "Boa ocupação" };
}

export function continuityLabel(row: Placement, _board: OrganizationBoard): string {
  return confirmationLabels[row.confirmation];
}

export function leavingFor(board: OrganizationBoard, plan: ClassPlan): Placement[] {
  return board.placements.filter(
    (row) =>
      (row.continuity === "LEAVING" || row.declinedAt) &&
      (row.planId === plan.id ||
        (row.sourceClassId && row.sourceClassId === (plan.classId ?? plan.sourceClassId))),
  );
}
export function compatible(row: Placement, plan: ClassPlan): boolean {
  return (
    plan.active && (plan.scheduleType === "PERSONALIZED" || plan.sharedStageId === row.stageId)
  );
}
export function suggestedPlans(row: Placement, board: OrganizationBoard): ClassPlan[] {
  return board.plans
    .filter((plan) => compatible(row, plan))
    .toSorted(
      (left, right) =>
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
