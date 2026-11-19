import { readFormationAcademics, type TransactionClient } from "@lazuli/db";
import { readAcquiredStages } from "@lazuli/db/material-purchases";
import {
  followsOwnClass,
  formationPlacementBlockers,
  contractCoverageEnd,
  formationContractStatus,
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
  const input = await eligibility(database, row);
  const continuing = continuesOwnClass(row);
  input.cohortAdvance = continuing;
  const formation = await scheduledFormationBlockers(database, {
    row,
    now,
    continuing,
    entryOn: input.entryOn,
  });
  return [...semesterPlacementBlockers(input), ...formation, ...changeBlockers(row, input.entryOn)];
}

function continuesOwnClass(row: Placement): boolean {
  const target = row.enrollment?.class;
  return (
    row.mode !== "ENTRY" &&
    followsOwnClass(
      row.sourceEnrollment?.classId ?? null,
      target && row.plan
        ? {
            classId: target.id,
            previousClassId: target.previousClassId,
            sourceClassId: row.plan.sourceClassId,
          }
        : null,
    )
  );
}

function placementContractStatus(
  row: Placement,
  entryOn: string,
): ReturnType<typeof formationContractStatus> {
  const contractEnd = contractCoverageEnd(
    row.student.contracts.map(({ startsOn, endsOn }) => ({
      startsOn: startsOn && dateOnly(startsOn),
      endsOn: endsOn && dateOnly(endsOn),
    })),
    entryOn,
  );
  return formationContractStatus(contractEnd, {
    from: dateOnly(row.semester.startDate),
    through: dateOnly(row.semester.endDate),
  });
}

async function scheduledFormationBlockers(
  database: TransactionClient,
  {
    row,
    now,
    continuing,
    entryOn,
  }: { row: Placement; now: Date; continuing: boolean; entryOn: string },
): Promise<string[]> {
  const [academic, materials] = continuing
    ? await Promise.all([
        readFormationAcademics(database, {
          progressIds: row.sourceProgressId ? [row.sourceProgressId] : [],
          now,
        }),
        readAcquiredStages(database, [row.studentId]),
      ])
    : [];
  const metrics = academic?.get(row.sourceProgressId ?? "");
  return formationPlacementBlockers({
    continuing,
    continuity: row.continuity,
    contractStatus: placementContractStatus(row, entryOn),
    materialMissing: missingMaterial(row, materials),
    grades: metrics?.grades,
    attendanceFlagged: metrics?.attendanceFlagged ?? false,
    classClosurePending: row.classClosurePending,
    exitRiskActive: row.exitRiskActive,
    staffImpediment: Boolean(row.attentionNote?.trim()),
  });
}

function missingMaterial(
  row: Placement,
  materials: Awaited<ReturnType<typeof readAcquiredStages>> | undefined,
): boolean {
  return Boolean(row.stageId && !materials?.get(row.studentId)?.has(row.stageId));
}

function changeBlockers(row: Placement, entryOn: string): string[] {
  const blockers: string[] = [];
  if (entryOrClassChanged(row, entryOn)) blockers.push("A data ou a turma de entrada mudou.");
  if (row.declinedAt) blockers.push("O aluno não continuará neste semestre.");
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
