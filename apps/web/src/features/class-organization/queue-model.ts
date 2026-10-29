import type { OrganizationBoard, PendingGroup } from "./model";
import { planMetrics } from "./confirmation";

export function queueData(board: OrganizationBoard) {
  const active = board.placements.filter((row) => !row.declinedAt);
  const urgent = active.filter(
    (row) => row.continuity === "LEAVING" || row.continuity === "CHANGE",
  );
  const unassigned = active.filter((row) => !row.planId && !urgent.includes(row));
  const confirmations = board.plans
    .filter((plan) => plan.active)
    .map((plan) => ({ plan, ...planMetrics(board, plan) }))
    .filter((item) => item.pending > 0);
  const waiting = board.waitingLeads.filter((lead) => !lead.allocationPlanId);
  const leadGroups = new Map<string, PendingGroup>();
  for (const lead of waiting) {
    const key = `${lead.stageId ?? ""}:${lead.scheduleType ?? ""}:${lead.format ?? ""}`;
    const group: PendingGroup = leadGroups.get(key) ?? {
      stageId: lead.stageId ?? "",
      stageCode: lead.stage?.internalCode ?? "",
      rows: [],
      leads: [],
    };
    group.leads.push(lead);
    leadGroups.set(key, group);
  }
  return {
    urgent,
    unassigned,
    confirmations,
    waiting,
    leadGroups: [...leadGroups.entries()],
    count:
      urgent.length +
      unassigned.length +
      confirmations.reduce((sum, item) => sum + item.pending, 0) +
      waiting.length,
  };
}

export function matchesSearch(name: string, search: string): boolean {
  return name.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR"));
}
