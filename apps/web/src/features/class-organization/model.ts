import { formatDateOnlyBR } from "~/lib/format";
import { availabilityCovers } from "@lazuli/domain";
import {
  type ClassPlan,
  type Placement,
  type SemesterBoard,
} from "~/features/semester-organization/shared";

const ISO_DATE_LENGTH = 10;
const MILLISECONDS_PER_DAY = 86_400_000;

export type { ClassPlan, Placement, SemesterBoard };
export type OrganizationAction =
  | { kind: "plan"; plan?: ClassPlan; group?: PendingGroup }
  | { kind: "placement"; studentId: string; row?: Placement; planId?: string }
  | { kind: "availability"; studentId: string }
  | { kind: "move" | "decline"; rows: Placement[]; planId?: string }
  | { kind: "continuity"; row: Placement }
  | { kind: "planStatus"; plan: ClassPlan; open: boolean }
  | { kind: "history" | "withdraw"; row: Placement }
  | { kind: "renew"; contractId: string }
  | { kind: "closure"; date?: string }
  | { kind: "holidays" | "period" | "newSemester" | "student" | "findStudent" };
export const rowsFor = (board: SemesterBoard, planId: string): Placement[] =>
  board.placements.filter((row) => row.planId === planId && !row.declinedAt);
export type PendingGroup = {
  stageId: string;
  stageCode: string;
  rows: Placement[];
  leads: SemesterBoard["waitingLeads"];
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
export function occupancy(plan: ClassPlan) {
  const count = plan.enrolledCount ?? 0;
  return {
    count,
    tone: count < 4 ? "destructive" : count < 8 ? "warning" : "success",
    label: count < 4 ? "Poucos alunos" : count < 8 ? "Em composição" : "Boa ocupação",
  } as const;
}
export function continuityLabel(row: Placement, board: SemesterBoard) {
  if (row.continuity === "LEAVING" || row.declinedAt) return "Possível saída";
  if (row.continuity === "CHANGE") return "Troca de turma";
  if (row.continuity === "STAY") return "Continua na turma";
  if (row.nextPeriodCovered) return "Continuidade prevista · contrato";
  if (row.periodCovered && new Date(board.semester.startDate) > new Date())
    return "Continuidade prevista · contrato";
  return "A conversar";
}
export function leavingFor(board: SemesterBoard, plan: ClassPlan) {
  return board.placements.filter(
    (row) =>
      (row.continuity === "LEAVING" || row.declinedAt) &&
      (row.planId === plan.id ||
        (row.sourceClassId && row.sourceClassId === (plan.classId ?? plan.sourceClassId))),
  );
}
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
    .toSorted(
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
      label: `Contrato começa em ${formatDateOnlyBR(row.upcomingContract.startsOn.toISOString().slice(0, ISO_DATE_LENGTH))}`,
      warning: true,
    };
  if (!row.contract)
    return { label: row.lastContract ? "Renovar contrato" : "Sem contrato", warning: true };
  const days = row.contract.endsOn
    ? Math.ceil((new Date(row.contract.endsOn).getTime() - Date.now()) / MILLISECONDS_PER_DAY)
    : null;
  return days !== null && days <= 45
    ? { label: `Vence em ${Math.max(0, days)} dias`, warning: true }
    : { label: "Contrato vigente", warning: false };
}
