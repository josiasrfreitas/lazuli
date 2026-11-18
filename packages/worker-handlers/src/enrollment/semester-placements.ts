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
    const blockers = await placementBlockers(database, row, now);
    if (blockers.length > 0)
      await returnToReview(database, { row, reason: blockers.join("; "), now });
  }
}

async function placementBlockers(
  database: TransactionClient,
  row: Placement,
  now: Date,
): Promise<string[]> {
  const input = eligibility(row);
  const contractEnd = contractCoverageEnd(
    row.student.contracts.map((contract) => ({
      startsOn: contract.startsOn && dateOnly(contract.startsOn),
      endsOn: contract.endsOn && dateOnly(contract.endsOn),
    })),
    input.entryOn,
  );
  const contract = formationContractStatus(contractEnd, {
    from: dateOnly(row.semester.startDate),
    through: dateOnly(row.semester.endDate),
  });
  const rollover = input.source && input.source.semesterId !== row.semesterId;
  const evidence = z
    .object({
      manualContinuity: z.boolean().optional(),
      acceptedEarlyEnd: z.string().nullable().optional(),
    })
    .safeParse(row.publishedEvidence).data;
  const metrics =
    row.sourceProgressId && rollover
      ? (await readFormationAcademics(database, { progressIds: [row.sourceProgressId], now })).get(
          row.sourceProgressId,
        )
      : null;
  const healthy = meetsFormationAverages(metrics);
  input.cohortAdvance =
    !!row.plan?.sourceClassId &&
    row.plan.sourceClassId === row.sourceEnrollment?.classId &&
    healthy;
  const blockers = semesterPlacementBlockers(input);
  if (!contractEnd) blockers.push(MISSING_ENTRY_CONTRACT);
  if (
    rollover &&
    contract === "EARLY_END" &&
    (!evidence?.acceptedEarlyEnd || evidence.acceptedEarlyEnd > contractEnd!)
  )
    blockers.push("Confirme o vencimento antecipado do contrato.");
  if (
    rollover &&
    !evidence?.manualContinuity &&
    (!healthy ||
      row.attentionNote ||
      (row.student.healthPending?.score ?? LOW_HEALTH_SCORE) < LOW_HEALTH_SCORE)
  )
    blockers.push("Revise a continuidade com a coordenação.");
  if (
    row.semester.deletedAt ||
    row.plan?.closedAt ||
    input.entryOn < dateOnly(row.semester.startDate) ||
    input.entryOn > dateOnly(row.semester.endDate) ||
    (row.plan?.startsOn && input.entryOn < dateOnly(row.plan.startsOn))
  )
    blockers.push("A data ou a turma de entrada mudou.");
  if (row.continuity === "LEAVING" || row.continuity === "CHANGE")
    blockers.push("A intenção de continuidade mudou.");
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
