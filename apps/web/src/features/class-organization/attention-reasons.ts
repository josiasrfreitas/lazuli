import { formationBlocker } from "@lazuli/domain";
import { formatDateOnlyBR } from "~/lib/format";
import type { Placement } from "./model";
import { reviewBlockers } from "./review-model";

const riskLabels = {
  classClosed: formationBlocker.classClosed,
  lowGrade: "Notas insuficientes",
  incomplete: "Notas incompletas",
  lowAttendance: "Frequência baixa",
  missingAttendance: "Presença sem registros",
  lowHealth: "Health Score baixo",
  missingContract: "Sem contrato vigente",
  earlyContractEnd: "Contrato termina na primeira metade do período",
  change: "Mudança de turma",
  unassigned: "Sem turma seguinte",
  leaving: "Risco de saída",
  staff: formationBlocker.staff,
  material: formationBlocker.material,
  other: "Observação da equipe",
} as const;

export type Risk = keyof typeof riskLabels;
export type AttentionReason = {
  kind: string;
  label: string;
  risk?: Risk | `blocker:${string}`;
  blocker?: string;
};

function reason(kind: string, risk: Risk): AttentionReason {
  return { kind, risk, label: riskLabels[risk] };
}

function contractReasons(attention: Placement["attention"]): AttentionReason[] {
  if (attention.contractStatus === "MISSING") return [reason("contract", "missingContract")];
  if (attention.contractStatus !== "EARLY_END") return [];
  const earlyEnd = reason("contract", "earlyContractEnd");
  if (attention.coverageThrough)
    earlyEnd.label = `Contrato até ${formatDateOnlyBR(attention.coverageThrough)}`;
  return [earlyEnd];
}

function academicReasons(row: Placement): AttentionReason[] {
  if (!row.sourceProgressId) return [];
  const { attention } = row;
  const reasons: AttentionReason[] = [];
  if (attention.grades === "NEEDS_SUPPORT") reasons.push(reason("grades", "lowGrade"));
  if (attention.gradesIncomplete || attention.grades === "INCOMPLETE")
    reasons.push(reason("grades", "incomplete"));
  if (attention.attendance === null) reasons.push(reason("attendance", "missingAttendance"));
  else if (attention.attendanceFlagged) reasons.push(reason("attendance", "lowAttendance"));
  return reasons;
}

function hasTeamObservation(row: Placement): boolean {
  return Boolean(
    row.notes?.trim() ||
    ((row.continuity === "UNDECIDED" || row.continuity === "STAY") && row.continuityReason?.trim()),
  );
}

function engagementReasons(row: Placement): AttentionReason[] {
  const reasons: AttentionReason[] = [];
  if (row.exitRiskActive || row.continuity === "LEAVING")
    reasons.push(reason("engagement", "leaving"));
  if (row.attention.lowHealth)
    reasons.push({
      kind: "engagement",
      risk: "lowHealth",
      label: `Health Score ${row.attention.healthScore}`,
    });
  if (row.attentionNote?.trim()) reasons.push(reason("engagement", "staff"));
  if (hasTeamObservation(row)) reasons.push(reason("engagement", "other"));
  return reasons;
}

export function attentionReasons(row: Placement): AttentionReason[] {
  const reasons: AttentionReason[] = [];
  if (row.classClosurePending) reasons.push(reason("placement", "classClosed"));
  if (!row.planId) reasons.push(reason("unassigned", "unassigned"));
  if (row.continuity === "CHANGE") reasons.push(reason("unassigned", "change"));
  reasons.push(
    ...contractReasons(row.attention),
    ...academicReasons(row),
    ...engagementReasons(row),
  );
  if (row.attention.materialMissing) reasons.push(reason("material", "material"));
  return reasons;
}

// Several publication blockers describe a risk the board also supplies as a structured signal.
const coveredBy = new Map<string, Risk[]>([
  ["Definir a turma de destino", ["unassigned", "change"]],
  ...(
    [
      "classClosed",
      "missingContract",
      "earlyContractEnd",
      "material",
      "lowGrade",
      "lowAttendance",
      "staff",
      "leaving",
    ] as const
  ).map((key): [string, Risk[]] => [formationBlocker[key], [key]]),
]);

export function blockerRisk(blocker: string): Risk | undefined {
  return coveredBy.get(blocker)?.[0];
}

export function rosterAttentionReasons(row: Placement): AttentionReason[] {
  const reasons = attentionReasons(row);
  for (const blocker of reviewBlockers(row)) {
    const keys = coveredBy.get(blocker);
    const matching = reasons.filter((reason) => keys?.some((risk) => risk === reason.risk));
    if (matching.length > 0) {
      for (const reason of matching) reason.blocker = blocker;
    } else {
      reasons.push({ kind: "placement", risk: `blocker:${blocker}`, label: blocker, blocker });
    }
  }
  return reasons;
}

export function rosterRiskOptions(
  entries: readonly { reasons: AttentionReason[] }[],
): { value: string; label: string }[] {
  const choices = Object.entries(riskLabels)
    .filter(([value]) => value !== "other")
    .map(([value, label]) => ({ value, label }));
  const blockers = new Map<string, string>();
  let hasNote = false;
  for (const { reasons } of entries) {
    for (const reason of reasons) {
      if (reason.risk === "other") hasNote = true;
      if (reason.risk?.startsWith("blocker:")) blockers.set(reason.risk, reason.label);
    }
  }
  return [
    { value: "all", label: "Todos os motivos" },
    ...choices,
    ...Array.from(blockers, ([value, label]) => ({ value, label })).toSorted((left, right) =>
      left.label.localeCompare(right.label, "pt-BR"),
    ),
    ...(hasNote ? [{ value: "other", label: riskLabels.other }] : []),
  ];
}

export function matchesFilter(row: Placement, filter: string): boolean {
  if (filter === "all") return true;
  const reasons = attentionReasons(row);
  if (filter === "pending")
    return (
      reasons.some((reason) => reason.kind !== "material") ||
      (!row.publishedAt && row.blockers.length > 0)
    );
  return reasons.some((reason) => reason.kind === filter);
}

const legacyAttentionGroups: Record<string, string[]> = {
  contract: ["missingContract", "earlyContractEnd"],
  grades: ["lowGrade", "incomplete"],
  attendance: ["lowAttendance", "missingAttendance"],
  engagement: ["leaving", "lowHealth", "other"],
};

export function selectedReviewReasons(value: string | null): string[] {
  return value && value !== "all"
    ? value.split("|").flatMap((key) => legacyAttentionGroups[key] ?? [key])
    : [];
}
