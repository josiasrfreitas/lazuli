import { readAcquiredStages } from "@lazuli/db/material-purchases";
import {
  emptyFormationAcademics,
  readFormationAcademics,
  type FormationAcademics,
} from "@lazuli/db/formation";
import {
  contractCoverageEnd,
  formationContractStatus,
  LOW_HEALTH_SCORE,
  type FormationContractStatus,
} from "@lazuli/domain";
import type { Period } from "@lazuli/db";
import { dateOnly, type OrganizationContext } from "./data.js";
import type { PlacementRow } from "./queries.js";

export type FormationAttention = FormationAcademics & {
  rollover: boolean;
  lowHealth: boolean;
  healthScore: number | null;
  materialMissing: boolean;
  contractStatus: FormationContractStatus;
  coverageThrough: string | null;
};

export async function readFormationSignals(
  context: OrganizationContext,
  rows: PlacementRow[],
): Promise<{
  academic: Map<string, FormationAcademics>;
  health: Map<string, number | null>;
  materials: Map<string, Set<string>>;
}> {
  const ids = [...new Set(rows.map((row) => row.studentId))];
  const [academic, health, materials] = await Promise.all([
    readFormationAcademics(context.database, {
      progressIds: rows.flatMap((row) => (row.sourceProgressId ? [row.sourceProgressId] : [])),
      now: context.now,
    }),
    context.database.studentHealthPending.findMany({
      where: { studentId: { in: ids }, deletedAt: null },
      select: { studentId: true, score: true },
    }),
    readAcquiredStages(context.database, ids),
  ]);
  return { academic, health: new Map(health.map((row) => [row.studentId, row.score])), materials };
}

export function formationAttention(input: {
  row: PlacementRow;
  semester: Period;
  coverageDate: string;
  contracts: readonly { startsOn: Date | null; endsOn: Date | null }[];
  signals: Awaited<ReturnType<typeof readFormationSignals>>;
}): FormationAttention {
  const { row, semester, coverageDate, signals } = input;
  const coverageThrough = contractCoverageEnd(
    input.contracts.map((contract) => ({
      startsOn: contract.startsOn && dateOnly(contract.startsOn),
      endsOn: contract.endsOn && dateOnly(contract.endsOn),
    })),
    coverageDate,
  );
  const healthScore = signals.health.get(row.studentId) ?? null;
  return {
    ...(signals.academic.get(row.sourceProgressId ?? "") ?? emptyFormationAcademics),
    rollover: Boolean(row.sourceSemesterId && row.sourceSemesterId !== semester.id),
    coverageThrough,
    contractStatus: formationContractStatus(coverageThrough, {
      from: dateOnly(semester.startDate),
      through: dateOnly(semester.endDate),
    }),
    healthScore,
    lowHealth: healthScore !== null && healthScore < LOW_HEALTH_SCORE,
    materialMissing: Boolean(
      row.stageId && !signals.materials.get(row.studentId)?.has(row.stageId),
    ),
  };
}
