import { formationTeachingDay, normalizeSearch } from "@lazuli/domain";
import { planMetrics } from "./confirmation";
import type { ClassPlan, OrganizationBoard } from "./shared";

const significantLossShare = 0.25;

export const teachingWeek = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
] as const;
export type TeachingDay = (typeof teachingWeek)[number];
export type WeeklyPlace = { plan: ClassPlan; endTime: string };

/** Recurring teaching slots are independent of holidays and actual lesson dates. */
export function weeklyPlaces(plans: ClassPlan[]): Array<[string, Map<TeachingDay, WeeklyPlace[]>]> {
  const byTime = new Map<string, Map<TeachingDay, WeeklyPlace[]>>();
  for (const plan of plans.toSorted(
    (left, right) =>
      Number(right.scheduleType === "PERSONALIZED") -
        Number(left.scheduleType === "PERSONALIZED") ||
      left.name.localeCompare(right.name, "pt-BR", { numeric: true }),
  )) {
    for (const slot of plan.slots) {
      const day = formationTeachingDay(slot);
      if (!day) continue;
      const row = byTime.get(slot.startTime) ?? new Map<TeachingDay, WeeklyPlace[]>();
      const places = row.get(day) ?? [];
      places.push({ plan, endTime: slot.endTime });
      row.set(day, places);
      byTime.set(slot.startTime, row);
    }
  }
  return [...byTime.entries()].toSorted(([left], [right]) => left.localeCompare(right));
}

export function matchesPlan(plan: ClassPlan, query: string): boolean {
  return normalizeSearch(
    [
      plan.name,
      plan.teacherName,
      plan.stageCode,
      plan.stageName,
      plan.scheduleType === "PERSONALIZED" ? "PPT" : "Regular",
    ].join(" "),
  ).includes(normalizeSearch(query));
}
export function atRisk(board: OrganizationBoard, plan: ClassPlan): boolean {
  return plan.active && planMetrics(board, plan).expected < board.semester.formationRiskLimit;
}

export function significantReduction(board: OrganizationBoard, plan: ClassPlan): boolean {
  if (!plan.active) return false;
  const riskLimit = board.semester.formationRiskLimit;
  const expected = planMetrics(board, plan).expected;
  const previous = plan.previousStudentCount;
  const minimumLoss = Math.max(
    2,
    Math.ceil(previous * significantLossShare),
    Math.ceil(riskLimit / 2),
  );
  return expected >= riskLimit && previous - expected >= minimumLoss;
}
