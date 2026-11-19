import type { ClassPlan, OrganizationBoard, Placement } from "./model";
import { reviewEffectiveDate } from "./review-model";

export const reviewOrders = ["nome", "destino", "vigencia"] as const;
export type ReviewOrder = (typeof reviewOrders)[number];
export const collator = new Intl.Collator("pt-BR", { numeric: true, sensitivity: "base" });
type Leads = OrganizationBoard["waitingLeads"];

export type ReviewOrigin = {
  classId: string | null;
  name: string;
  schedule: Placement["sourceSchedule"];
  scheduleType: Placement["sourceScheduleType"];
  teacherName: string | null;
};

export type ReviewGroup = {
  id: string;
  rows: Placement[];
  leads: Leads;
} & (
  | { kind: "plan"; plan: ClassPlan; origin?: never }
  | { kind: "origin"; origin: ReviewOrigin; plan?: never }
  | { kind: "unassigned" | "leads"; plan?: never; origin?: never }
);

export function reviewPlanName(plan: { name: string; className?: string | null }): string {
  return plan.className ?? plan.name;
}

export function isReviewDeparture(row: Placement): boolean {
  return Boolean(row.declinedAt || row.exitRiskActive || row.continuity === "LEAVING");
}

export function reviewOriginName(row: Placement): string {
  if (!row.sourceClassId) return "Sem turma de origem";
  return row.sourceClassName ?? "Turma de origem";
}

export function reviewGroupName(group: ReviewGroup): string {
  if (group.kind === "plan") return reviewPlanName(group.plan);
  if (group.kind === "origin") return group.origin.name;
  return group.kind === "unassigned" ? "Sem turma de destino" : "Leads aguardando entrada";
}

export function reviewOriginPlans(plans: ClassPlan[]): ReadonlyMap<string, ClassPlan | null> {
  const byClass = new Map<string, ClassPlan | null>();
  for (const plan of plans) {
    if (plan.classId) byClass.set(plan.classId, byClass.has(plan.classId) ? null : plan);
  }
  return byClass;
}

export function reviewDestinationId(row: Placement): string | null {
  if (row.declinedAt) return null;
  if (!row.publishedAt && (row.continuity === "CHANGE" || isReviewDeparture(row))) return null;
  return row.planId;
}

export function reviewGroupPlanId(
  row: Placement,
  origins: ReturnType<typeof reviewOriginPlans>,
): string | null {
  if (!isReviewDeparture(row)) return reviewDestinationId(row);
  return origins.get(row.sourceClassId ?? "")?.id ?? null;
}

export function needsReviewDestination(row: Placement): boolean {
  if (row.declinedAt) return false;
  if (row.classClosurePending && !row.planId) return true;
  if (row.continuity !== "CHANGE" && isReviewDeparture(row)) return false;
  return row.continuity === "CHANGE" || (!row.publishedAt && !row.planId);
}

function compareValues(left: string, right: string): number {
  return Number(!left) - Number(!right) || collator.compare(left, right);
}

export function reviewRowComparator(board: OrganizationBoard, order: ReviewOrder) {
  const destinations = new Map(board.plans.map((plan) => [plan.id, reviewPlanName(plan)]));
  const origins = reviewOriginPlans(board.plans);
  const key = (row: Placement): string => {
    if (order === "destino") {
      const groupName = destinations.get(reviewGroupPlanId(row, origins) ?? "");
      return (
        groupName ?? (isReviewDeparture(row) && row.sourceClassId ? reviewOriginName(row) : "")
      );
    }
    if (order === "vigencia" && !row.declinedAt) return reviewEffectiveDate(row, board);
    return "";
  };
  return (left: Placement, right: Placement): number =>
    compareValues(key(left), key(right)) ||
    collator.compare(left.studentName, right.studentName) ||
    left.id.localeCompare(right.id);
}

function specialGroup(kind: "unassigned" | "leads"): ReviewGroup {
  return { id: kind, kind, rows: [], leads: [] };
}

function groupForOrigin(row: Placement, groups: Map<string, ReviewGroup>): ReviewGroup {
  const classId = row.sourceClassId;
  const id = `origin:${classId ?? "none"}`;
  const existing = groups.get(id);
  if (existing) return existing;
  const origin: ReviewOrigin = {
    classId,
    name: reviewOriginName(row),
    schedule: classId ? row.sourceSchedule : [],
    scheduleType: classId ? row.sourceScheduleType : null,
    teacherName: classId ? row.sourceTeacher : null,
  };
  const group: ReviewGroup = { id, kind: "origin", origin, rows: [], leads: [] };
  groups.set(id, group);
  return group;
}

function groupComparator(board: OrganizationBoard, order: ReviewOrder) {
  const groupName = (group: ReviewGroup): string =>
    group.plan || group.origin?.classId ? reviewGroupName(group) : "";
  const key = (group: ReviewGroup): string => {
    const first = group.rows[0];
    if (order === "vigencia")
      return first && !first.declinedAt ? reviewEffectiveDate(first, board) : "";
    if (order === "destino") return groupName(group);
    const student = first?.studentName ?? "";
    const lead = group.leads[0]?.fullName ?? "";
    return compareValues(student, lead) <= 0 ? student : lead;
  };
  const rank = { plan: 0, unassigned: 1, origin: 2, leads: 3 };
  return (left: ReviewGroup, right: ReviewGroup): number =>
    compareValues(key(left), key(right)) ||
    compareValues(groupName(left), groupName(right)) ||
    rank[left.kind] - rank[right.kind] ||
    left.id.localeCompare(right.id);
}

export function groupReviewRows(
  board: OrganizationBoard,
  rows: Placement[],
  leads: Leads,
  order: ReviewOrder,
): ReviewGroup[] {
  const groupsById = new Map<string, ReviewGroup>(
    board.plans.map((plan) => [plan.id, { id: plan.id, kind: "plan", plan, rows: [], leads: [] }]),
  );
  const unassigned = specialGroup("unassigned");
  const unassignedLeads = specialGroup("leads");
  const origins = reviewOriginPlans(board.plans);
  for (const row of rows) {
    const planGroup = groupsById.get(reviewGroupPlanId(row, origins) ?? "");
    const group =
      planGroup ?? (isReviewDeparture(row) ? groupForOrigin(row, groupsById) : unassigned);
    group.rows.push(row);
  }
  for (const lead of leads) {
    const group = groupsById.get(lead.allocationPlanId ?? "") ?? unassignedLeads;
    group.leads.push(lead);
  }
  const groups = [...groupsById.values(), unassigned, unassignedLeads].filter(
    (group) => group.rows.length + group.leads.length > 0,
  );
  const compareRows = reviewRowComparator(board, order);
  for (const group of groups) {
    group.rows.sort(compareRows);
    group.leads.sort(
      (left, right) =>
        collator.compare(left.fullName, right.fullName) || left.id.localeCompare(right.id),
    );
  }
  return groups.sort(groupComparator(board, order));
}
