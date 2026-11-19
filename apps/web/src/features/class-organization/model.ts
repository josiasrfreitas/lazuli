import {
  type ClassPlan,
  type Placement,
  type OrganizationBoard,
} from "~/features/class-organization/shared";

export type { ClassPlan, Placement, OrganizationBoard } from "~/features/class-organization/shared";
export type OrganizationAction =
  | { kind: "riskLimit" | "resetFormation" }
  | { kind: "postpone"; plan: ClassPlan }
  | { kind: "plan"; plan?: ClassPlan; group?: PendingGroup }
  | { kind: "placement"; studentId: string; row?: Placement; planId?: string }
  | { kind: "placementDate"; row: Placement }
  | { kind: "move" | "decline"; rows: Placement[]; planId?: string }
  | { kind: "continuity"; row: Placement }
  | { kind: "planStatus"; plan: ClassPlan; open: boolean }
  | { kind: "history" | "withdraw"; row: Placement }
  | { kind: "findStudent" };
export const rowsFor = (board: OrganizationBoard, planId: string): Placement[] =>
  board.placements.filter(
    (row) =>
      row.planId === planId && !row.declinedAt && (row.publishedAt || row.continuity !== "CHANGE"),
  );
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
