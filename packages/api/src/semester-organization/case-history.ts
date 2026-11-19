import type { Prisma } from "@lazuli/db";
import { z } from "@lazuli/validators";
import type { OrganizationContext } from "./data.js";

const snapshot = z.object({
  continuity: z.string().optional(),
  continuityReason: z.string().nullish(),
  attentionNote: z.string().nullish(),
  exitRiskActive: z.boolean().optional(),
  classClosurePending: z.boolean().optional(),
  planId: z.string().nullish(),
});

type HistoryEvent = Omit<
  Prisma.SemesterPlacementEventGetPayload<object>,
  "recordedById" | "placementId"
> & { recordedBy: { name: string } | null };
type SignalState = z.infer<typeof snapshot>;
type SignalTransition = { previous: SignalState; current: SignalState };
function blockChanges(previous: SignalState, current: SignalState): [string, string][] {
  const changes: [string, string][] = [];
  if (current.attentionNote && current.attentionNote !== previous.attentionNote)
    changes.push(["BLOCK", current.attentionNote]);
  if (!current.attentionNote && previous.attentionNote)
    changes.push(["UNBLOCK", "Sinalização retirada pela equipe."]);
  return changes;
}

function continuityChanges({ previous, current }: SignalTransition): [string, string][] {
  const changes: [string, string][] = [];
  const changed =
    previous.continuity !== current.continuity ||
    current.continuityReason !== previous.continuityReason;
  if (current.continuity === "LEAVING" && changed)
    changes.push(["RISK", current.continuityReason || "Sinalização registrada na proposta."]);
  if (current.continuity === "CHANGE" && current.continuityReason && changed)
    changes.push(["CHANGE_REQUEST", current.continuityReason]);
  changes.push(...blockChanges(previous, current));
  if (withdrawnRisk(previous, current))
    changes.push(["NOTE", "A equipe retirou a sinalização anterior de possível saída."]);
  return changes;
}

function withdrawnRisk(previous: SignalState, current: SignalState): boolean {
  return (
    previous.continuity === "LEAVING" && current.continuity !== "LEAVING" && !current.exitRiskActive
  );
}

function legacyEventDescriptions(
  item: { action: string; reason: string | null },
  transition: SignalTransition,
): [string, string][] {
  const { previous, current } = transition;
  if (["PUBLISHED", "CONFIRMED_CONTINUITY"].includes(item.action))
    return [["PUBLISHED", "Vínculo publicado na Formação."]];
  if (
    item.action === "REVISED" &&
    previous.classClosurePending &&
    current.classClosurePending === false &&
    current.planId
  )
    return [["CLASS_REASSIGNED", "A equipe definiu uma nova turma para o vínculo."]];
  if (item.action === "CLASS_DISSOLVED")
    return [["CLASS_DISSOLVED", item.reason ?? "A turma foi encerrada."]];
  if (item.action === "CONTINUITY") return continuityChanges(transition);
  return [];
}

export async function caseHistory(
  context: OrganizationContext,
  id: string,
): Promise<HistoryEvent[]> {
  const row = await context.database.semesterPlacement.findFirstOrThrow({
    where: { id, deletedAt: null },
    select: {
      caseEvents: {
        include: { recordedBy: { select: { name: true } } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      },
      revisions: {
        where: { deletedAt: null },
        select: {
          id: true,
          action: true,
          reason: true,
          createdAt: true,
          snapshot: true,
          recordedBy: { select: { name: true } },
        },
        orderBy: { version: "asc" },
      },
    },
  });
  const legacy: HistoryEvent[] = [];
  let previous: z.infer<typeof snapshot> = {};
  for (const item of row.revisions) {
    const current = snapshot.safeParse(item.snapshot).data ?? {};
    for (const [kind, narrative] of legacyEventDescriptions(item, { previous, current }))
      legacy.push({
        id: item.id + kind,
        createdAt: item.createdAt,
        recordedBy: item.recordedBy,
        kind,
        narrative,
        healthScore: null,
        riskReason: null,
        verbalReport: null,
        outcome: null,
        nextOwner: null,
        reassessment: null,
        renegotiationId: null,
        renewalId: null,
      });
    previous = current;
  }
  return [...row.caseEvents, ...legacy.toReversed()].toSorted(
    (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
  );
}
