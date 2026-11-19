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
function blockChanges(previous: SignalState, current: SignalState): [string, string][] {
  const changes: [string, string][] = [];
  if (current.attentionNote && current.attentionNote !== previous.attentionNote)
    changes.push(["BLOCK", current.attentionNote]);
  if (!current.attentionNote && previous.attentionNote)
    changes.push(["UNBLOCK", "Sinalização retirada pela equipe."]);
  return changes;
}

function continuityChanges({
  previous,
  current,
}: {
  previous: SignalState;
  current: SignalState;
}): [string, string][] {
  const changes: [string, string][] = [];
  if (
    current.continuity === "LEAVING" &&
    (previous.continuity !== "LEAVING" || current.continuityReason !== previous.continuityReason)
  )
    changes.push(["RISK", current.continuityReason || "Sinalização registrada na proposta."]);
  if (
    current.continuity === "CHANGE" &&
    current.continuityReason &&
    (previous.continuity !== "CHANGE" || current.continuityReason !== previous.continuityReason)
  )
    changes.push(["CHANGE_REQUEST", current.continuityReason]);
  changes.push(...blockChanges(previous, current));
  if (
    previous.continuity === "LEAVING" &&
    current.continuity !== "LEAVING" &&
    !current.exitRiskActive
  )
    changes.push(["NOTE", "A equipe retirou a sinalização anterior de possível saída."]);
  return changes;
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
    const append = (kind: string, narrative: string): number =>
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
    if (["PUBLISHED", "CONFIRMED_CONTINUITY"].includes(item.action))
      append("PUBLISHED", "Vínculo publicado na Formação.");
    if (
      item.action === "REVISED" &&
      previous.classClosurePending &&
      current.classClosurePending === false &&
      current.planId
    )
      append("CLASS_REASSIGNED", "A equipe definiu uma nova turma para o vínculo.");
    if (item.action === "CLASS_DISSOLVED")
      append("CLASS_DISSOLVED", item.reason ?? "A turma foi encerrada.");
    if (item.action === "CONTINUITY") {
      for (const [kind, message] of continuityChanges({ previous, current })) append(kind, message);
    }
    previous = current;
  }
  return [...row.caseEvents, ...legacy.toReversed()].toSorted(
    (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
  );
}
