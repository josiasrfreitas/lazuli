import {
  emptyFormationAcademics,
  readFormationAcademics,
  type FormationAcademics,
} from "@lazuli/db";
import {
  contractCoverageEnd,
  formationContractStatus,
  LOW_HEALTH_SCORE,
  MISSING_ENTRY_CONTRACT,
  meetsFormationAverages,
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
  materials: Set<string>;
}> {
  const ids = [...new Set(rows.map((row) => row.studentId))];
  const [academic, health, purchases] = await Promise.all([
    readFormationAcademics(context.database, {
      progressIds: rows.flatMap((row) => (row.sourceProgressId ? [row.sourceProgressId] : [])),
      now: context.now,
    }),
    context.database.studentHealthPending.findMany({
      where: { studentId: { in: ids }, deletedAt: null },
      select: { studentId: true, score: true },
    }),
    context.database.orderBeneficiary.findMany({
      where: {
        studentId: { in: ids },
        deletedAt: null,
        order: { deletedAt: null, kind: "MATERIAL" },
      },
      select: {
        studentId: true,
        order: {
          select: { material: { select: { stageId: true, items: { select: { stageId: true } } } } },
        },
      },
    }),
  ]);
  const materials = new Set(
    purchases.flatMap(({ studentId, order: { material } }) =>
      material
        ? [material.stageId, ...material.items.map((item) => item.stageId)].map(
            (id) => studentId + "/" + id,
          )
        : [],
    ),
  );
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
      row.stageId && !signals.materials.has(row.studentId + "/" + row.stageId),
    ),
  };
}

export function formationReviewReasons(row: PlacementRow, attention: FormationAttention): string[] {
  const reasons: string[] = [];
  if (attention.contractStatus === "MISSING") reasons.push(MISSING_ENTRY_CONTRACT);
  if (row.continuity === "CHANGE") reasons.push("Escolha a nova turma para continuar.");
  if (row.continuity === "STAY" || !attention.rollover) return reasons;
  if (attention.contractStatus === "EARLY_END")
    reasons.push("Contrato vence nos primeiros três meses. Confirme a continuidade.");
  if (!meetsFormationAverages(attention))
    reasons.push("Revise as notas e a presença antes de confirmar a continuidade.");
  if (row.attentionNote || attention.lowHealth)
    reasons.push("Revise o acompanhamento do aluno antes de confirmar.");
  return reasons;
}
