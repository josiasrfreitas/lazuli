import type { TransactionClient } from "@lazuli/db";
import { semesterPlacementBlockers } from "@lazuli/domain";
import { z } from "@lazuli/validators";
import { include, type Placement } from "./semester-placement-data.js";
import { eligibility } from "./semester-placement-eligibility.js";
import { returnToReview } from "./semester-placement-review.js";

/** Run in the same transaction before due enrollment actions. A changed premise must not move a student. */
export async function reconcileDueSemesterPlacements(
  database: TransactionClient,
  { today, now }: { today: Date; now: Date },
): Promise<void> {
  const candidates = await database.semesterPlacement.findMany({
    where: {
      publishedAt: { not: null },
      entryAction: { status: "SCHEDULED", effectiveDate: { lte: today } },
    },
    select: { id: true, semesterId: true, studentId: true },
    orderBy: [{ semesterId: "asc" }, { studentId: "asc" }],
  });
  for (const candidate of candidates) {
    await database.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`semester-organization:${candidate.semesterId}`}, 0))`;
    await database.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`enrollment:${candidate.studentId.toLowerCase()}`}, 0))`;
    const row = await database.semesterPlacement.findUniqueOrThrow({
      where: { id: candidate.id },
      include,
    });
    if (!row.publishedAt || row.entryAction?.status !== "SCHEDULED") continue;
    const blockers = await placementBlockers(database, row);
    if (blockers.length > 0)
      await returnToReview(database, { row, reason: blockers.join("; "), now });
  }
}

async function placementBlockers(database: TransactionClient, row: Placement): Promise<string[]> {
  const blockers = semesterPlacementBlockers(eligibility(row));
  if (row.sourceEnrollmentId && row.sourceExitAction?.status !== "SCHEDULED")
    blockers.push("A saída de origem foi alterada");
  if (continuationEvidenceChanged(row))
    blockers.push("O plano ou a avaliação PPT mudou após a publicação");
  return blockers;
}

function continuationEvidenceChanged(row: Placement): boolean {
  const evidence = z
    .object({ assessmentId: z.string().nullable(), stagePlanId: z.string().nullable() })
    .safeParse(row.publishedEvidence);
  return Boolean(
    row.mode === "CONTINUE" &&
    evidence.success &&
    (evidence.data.assessmentId !== row.sourceProgress?.assessmentId ||
      evidence.data.stagePlanId !== row.sourceProgress?.stagePlanId),
  );
}
