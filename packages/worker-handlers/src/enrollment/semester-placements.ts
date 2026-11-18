import { readFormationAcademics, type TransactionClient } from "@lazuli/db";
import {
  contractCoverageEnd,
  formationContractStatus,
  meetsFormationAverages,
  LOW_HEALTH_SCORE,
  MISSING_ENTRY_CONTRACT,
  semesterPlacementBlockers,
} from "@lazuli/domain";
import { z } from "@lazuli/validators";
import { include, dateOnly, type Placement } from "./semester-placement-data.js";
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
    const blockers = await placementBlockers(database, { row, now });
    if (blockers.length > 0)
      await returnToReview(database, { row, reason: blockers.join("; "), now });
  }
}

async function placementBlockers(
  database: TransactionClient,
  { row, now }: { row: Placement; now: Date },
): Promise<string[]> {
  const input = eligibility(row);
  const rollover = Boolean(input.source && input.source.semesterId !== row.semesterId);
  const healthy = await hasFormationAverages(database, {
    progressId: rollover ? row.sourceProgressId : null,
    now,
  });
  input.cohortAdvance =
    !!row.plan?.sourceClassId &&
    row.plan.sourceClassId === row.sourceEnrollment?.classId &&
    healthy;
  return [
    ...semesterPlacementBlockers(input),
    ...coverageBlockers(row, { entryOn: input.entryOn, rollover, healthy }),
    ...changeBlockers(row, input.entryOn),
  ];
}

async function hasFormationAverages(
  database: TransactionClient,
  { progressId, now }: { progressId: string | null; now: Date },
): Promise<boolean> {
  if (!progressId) return meetsFormationAverages(null);
  const metrics = await readFormationAcademics(database, { progressIds: [progressId], now });
  return meetsFormationAverages(metrics.get(progressId));
}

function coverageBlockers(
  row: Placement,
  { entryOn, rollover, healthy }: { entryOn: string; rollover: boolean; healthy: boolean },
): string[] {
  const contractEnd = contractCoverageEnd(
    row.student.contracts.map(({ startsOn, endsOn }) => ({
      startsOn: startsOn && dateOnly(startsOn),
      endsOn: endsOn && dateOnly(endsOn),
    })),
    entryOn,
  );
  const blockers = contractEnd ? [] : [MISSING_ENTRY_CONTRACT];
  if (!rollover) return blockers;
  const evidence = z
    .object({
      manualContinuity: z.boolean().optional(),
      acceptedEarlyEnd: z.string().nullable().optional(),
    })
    .safeParse(row.publishedEvidence).data;
  if (requiresEarlyEndConfirmation(row, { contractEnd, accepted: evidence?.acceptedEarlyEnd }))
    blockers.push("Confirme o vencimento antecipado do contrato.");
  if (!evidence?.manualContinuity && !eligibleForAutomaticRollover(row, healthy))
    blockers.push("Revise a continuidade com a coordenação.");
  return blockers;
}

function requiresEarlyEndConfirmation(
  row: Placement,
  { contractEnd, accepted }: { contractEnd: string | null; accepted: string | null | undefined },
): boolean {
  return Boolean(
    contractEnd &&
    formationContractStatus(contractEnd, {
      from: dateOnly(row.semester.startDate),
      through: dateOnly(row.semester.endDate),
    }) === "EARLY_END" &&
    (!accepted || accepted > contractEnd),
  );
}

function eligibleForAutomaticRollover(row: Placement, healthy: boolean): boolean {
  return (
    healthy &&
    !row.attentionNote &&
    (row.student.healthPending?.score ?? LOW_HEALTH_SCORE) >= LOW_HEALTH_SCORE
  );
}

function changeBlockers(row: Placement, entryOn: string): string[] {
  const blockers: string[] = [];
  if (entryOrClassChanged(row, entryOn)) blockers.push("A data ou a turma de entrada mudou.");
  if (row.continuity === "LEAVING" || row.continuity === "CHANGE")
    blockers.push("A intenção de continuidade mudou.");
  if (row.sourceEnrollmentId && row.sourceExitAction?.status !== "SCHEDULED")
    blockers.push("A saída de origem foi alterada");
  if (continuationEvidenceChanged(row))
    blockers.push("O plano ou a avaliação PPT mudou após a publicação");
  return blockers;
}

function entryOrClassChanged(row: Placement, entryOn: string): boolean {
  return Boolean(
    row.semester.deletedAt ||
    row.plan?.closedAt ||
    entryOn < dateOnly(row.semester.startDate) ||
    entryOn > dateOnly(row.semester.endDate) ||
    (row.plan?.startsOn && entryOn < dateOnly(row.plan.startsOn)),
  );
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
