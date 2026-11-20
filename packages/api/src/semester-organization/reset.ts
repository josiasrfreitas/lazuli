import { createHash } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { recordActivity } from "../activity/record.js";
import {
  lockSemester,
  placementRevisionData,
  requireFutureSemester,
  type OrganizationContext,
} from "./data.js";
import { readSemester } from "./queries.js";

type ResetPreview = { fingerprint: string; release: number; leads: number; keep: number };
type ResetScope = { ids: string[]; leadIds: string[]; preview: ResetPreview };

async function resetScope(context: OrganizationContext, semesterId: string): Promise<ResetScope> {
  const { placements, waitingLeads } = await readSemester(context, semesterId);
  const assigned = placements.filter((row) => row.planId && !row.declinedAt);
  const provisional = assigned.filter(
    (row) =>
      !row.publishedAt &&
      !row.enrollmentId &&
      !row.entryActionId &&
      (row.blockers.length > 0 || row.continuity === "CHANGE" || row.continuity === "LEAVING"),
  );
  const versions = provisional
    .map(({ id, version }) => [id, version] as const)
    .toSorted(([left], [right]) => left.localeCompare(right));
  const interests = waitingLeads
    .filter((lead) => lead.allocationPlanId !== null)
    .map((lead) => [lead.id, lead.allocationPlanId] as const)
    .toSorted(([left], [right]) => left.localeCompare(right));
  const fingerprint = createHash("sha256")
    .update(JSON.stringify([semesterId, versions, interests]))
    .digest("hex");
  return {
    leadIds: interests.map(([id]) => id),
    ids: provisional.map((row) => row.id),
    preview: {
      fingerprint,
      release: provisional.length,
      leads: interests.length,
      keep: assigned.length - provisional.length,
    },
  };
}

export async function previewFormationReset(
  context: OrganizationContext,
  semesterId: string,
): Promise<ResetPreview> {
  await requireFutureSemester(context, semesterId);
  const { preview } = await resetScope(context, semesterId);
  return preview;
}

/** Remove provisional destinations only. Published enrollments have separate reversal rules. */
export async function resetFormation(
  context: OrganizationContext,
  input: { semesterId: string; fingerprint: string },
): Promise<{ released: number; leads: number }> {
  const semester = await lockSemester(context, input.semesterId);
  const { ids, leadIds, preview } = await resetScope(context, input.semesterId);
  if (preview.fingerprint !== input.fingerprint)
    throw new TRPCError({
      code: "CONFLICT",
      message: "As propostas mudaram. Confira a prévia atualizada antes de reiniciar.",
    });
  if (ids.length === 0 && leadIds.length === 0) return { released: 0, leads: 0 };
  const released = await context.database.semesterPlacement.updateManyAndReturn({
    where: {
      semesterId: input.semesterId,
      id: { in: ids },
      publishedAt: null,
      deletedAt: null,
      declinedAt: null,
    },
    data: {
      planId: null,
      effectiveDate: null,
      version: { increment: 1 },
      recordedById: context.staffUser.id,
    },
  });
  await context.database.semesterPlacementRevision.createMany({
    data: released.map((row) =>
      placementRevisionData(context, {
        row,
        action: "FORMATION_RESET",
        reason: "Destino provisório retirado no reinício da formação.",
      }),
    ),
  });
  const leads = await context.database.admissionCandidate.updateMany({
    where: {
      id: { in: leadIds },
      allocationPlan: { semesterId: semester.id },
      status: "WAITING",
      deletedAt: null,
      allocationPendingAt: { not: null },
    },
    data: { allocationPlanId: null },
  });
  await recordActivity(context.database, {
    context,
    action: "semesterOrganization.reset",
    details: {
      subject: { type: "school", id: semester.id, name: semester.name },
      description: `${released.length} vínculo(s) de alunos e ${leads.count} lead(s) voltaram à fila para escolha de turma.`,
    },
  });
  return { released: released.length, leads: leads.count };
}
