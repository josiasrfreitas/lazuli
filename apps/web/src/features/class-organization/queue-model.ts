import { isQueueItem, type PendingGroup, type SemesterBoard } from "./model";

type Placement = SemesterBoard["placements"][number];
type Lead = SemesterBoard["waitingLeads"][number];
type Intent = SemesterBoard["intents"][number];
export type QueueData = {
  pending: Placement[];
  leads: Lead[];
  intents: Intent[];
  groups: PendingGroup[];
  count: number;
};

export function queueData(board: SemesterBoard): QueueData {
  const pending = board.placements.filter((row) => isQueueItem(row));
  const leads = board.waitingLeads.filter(
    (lead) => !pending.some((row) => row.studentId === lead.studentId),
  );
  const intents = board.intents.filter(
    (intent) => !leads.some((lead) => lead.studentId === intent.studentId),
  );
  return {
    pending,
    leads,
    intents,
    groups: pendingGroups(pending, leads),
    count: pending.length + leads.length + intents.length,
  };
}

function pendingGroups(pending: Placement[], leads: Lead[]): PendingGroup[] {
  const groups = new Map<string, PendingGroup>();
  for (const item of pending) {
    const key = item.stageId ?? "";
    const group = groups.get(key) ?? {
      stageId: key,
      stageCode: item.stageCode ?? "",
      rows: [],
      leads: [],
    };
    group.rows.push(item);
    groups.set(key, group);
  }
  for (const item of leads) {
    const key = item.stageId ?? "";
    const group = groups.get(key) ?? {
      stageId: key,
      stageCode: item.stage?.internalCode ?? "",
      rows: [],
      leads: [],
    };
    group.leads.push(item);
    groups.set(key, group);
  }
  return [...groups.values()].toSorted(compareGroups);
}

function compareGroups(left: PendingGroup, right: PendingGroup): number {
  return (
    attention(right) - attention(left) ||
    right.rows.length + right.leads.length - (left.rows.length + left.leads.length) ||
    left.stageCode.localeCompare(right.stageCode)
  );
}

function attention(group: PendingGroup): number {
  return group.rows.filter((row) => row.continuity === "LEAVING" || row.declinedAt).length;
}

export function matchesSearch(name: string, search: string): boolean {
  return name.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR"));
}
