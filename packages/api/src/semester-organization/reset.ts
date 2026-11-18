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

async function resetScope(context: OrganizationContext, semesterId: string) {
  const { placements } = await readSemester(context, semesterId);
  const assigned = placements.filter((row) => row.planId && !row.declinedAt);
  const provisional = assigned.filter(
    (row) =>
      !row.publishedAt &&
      !row.enrollmentId &&
      !row.entryActionId &&
      row.confirmation !== "CONFIRMED" &&
      row.confirmation !== "PRECONFIRMED",
  );
  const versions = provisional
    .map(({ id, version }) => [id, version] as const)
    .sort(([left], [right]) => left.localeCompare(right));
  const fingerprint = createHash("sha256")
    .update(JSON.stringify([semesterId, versions]))
    .digest("hex");
  return {
    ids: provisional.map((row) => row.id),
    preview: {
      fingerprint,
      release: provisional.length,
      keep: assigned.length - provisional.length,
    },
  };
}

export async function previewFormationReset(context: OrganizationContext, semesterId: string) {
  await requireFutureSemester(context, semesterId);
  return (await resetScope(context, semesterId)).preview;
}

/** Remove provisional destinations only. Published enrollments have separate reversal rules. */
export async function resetFormation(
  context: OrganizationContext,
  input: { semesterId: string; fingerprint: string },
) {
  const semester = await lockSemester(context, input.semesterId);
  const { ids, preview } = await resetScope(context, input.semesterId);
  if (preview.fingerprint !== input.fingerprint)
    throw new TRPCError({
      code: "CONFLICT",
      message: "As propostas mudaram. Confira a prévia atualizada antes de reiniciar.",
    });
  if (!ids.length) return { released: 0 };
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
      placementRevisionData(
        context,
        row,
        "FORMATION_RESET",
        "Destino provisório retirado no reinício da formação.",
      ),
    ),
  });
  await recordActivity(context.database, {
    context,
    action: "semesterOrganization.reset",
    details: {
      subject: { type: "school", id: semester.id, name: semester.name },
      description: `${released.length} vínculo(s) voltaram à fila para escolha de turma.`,
    },
  });
  return { released: released.length };
}
