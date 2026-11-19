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

export function attentionReasons(row: Placement): AttentionReason[] {
  const { attention } = row;
  const reasons: AttentionReason[] = [];
  function add(kind: string, risk: Risk, label: string = riskLabels[risk]): void {
    reasons.push({ kind, risk, label });
  }
  if (row.classClosurePending) add("placement", "classClosed");
  if (!row.planId) add("unassigned", "unassigned");
  if (row.continuity === "CHANGE") add("unassigned", "change");
  if (attention.contractStatus === "MISSING") add("contract", "missingContract");
  if (attention.contractStatus === "EARLY_END")
    add(
      "contract",
      "earlyContractEnd",
      attention.coverageThrough
        ? `Contrato até ${formatDateOnlyBR(attention.coverageThrough)}`
        : riskLabels.earlyContractEnd,
    );
  if (row.sourceProgressId) {
    if (attention.grades === "NEEDS_SUPPORT") add("grades", "lowGrade");
    if (attention.gradesIncomplete || attention.grades === "INCOMPLETE")
      add("grades", "incomplete");
    if (attention.attendance === null) add("attendance", "missingAttendance");
    else if (attention.attendanceFlagged) add("attendance", "lowAttendance");
  }
  if (row.exitRiskActive || row.continuity === "LEAVING") add("engagement", "leaving");
  if (attention.lowHealth) add("engagement", "lowHealth", `Health Score ${attention.healthScore}`);
  if (row.attentionNote?.trim()) add("engagement", "staff");
  if (
    row.notes?.trim() ||
    ((row.continuity === "UNDECIDED" || row.continuity === "STAY") && row.continuityReason?.trim())
  )
    add("engagement", "other");
  if (attention.materialMissing) add("material", "material");
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
    if (matching.length) {
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
    ...Array.from(blockers, ([value, label]) => ({ value, label })).sort((a, b) =>
      a.label.localeCompare(b.label, "pt-BR"),
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
