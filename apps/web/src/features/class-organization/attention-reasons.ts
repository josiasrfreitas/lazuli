import type { Placement } from "./model";

export type AttentionReason = { kind: string; label: string };
export function needsPlace(row: Placement): boolean {
  return !row.planId || row.continuity === "CHANGE";
}
export function attentionReasons(row: Placement): AttentionReason[] {
  const { attention } = row;
  const reasons: AttentionReason[] = [];
  if (needsPlace(row))
    reasons.push({
      kind: "unassigned",
      label: row.planId ? "Escolher outra turma" : "Sem turma de destino",
    });
  if (attention.contractStatus === "MISSING")
    reasons.push({ kind: "contract", label: "Sem contrato vigente" });
  if (attention.contractStatus === "EARLY_END")
    reasons.push({ kind: "contract", label: "Contrato vence no início do semestre" });
  if (row.sourceProgressId) reasons.push(...academicReasons(attention));
  if (row.attentionNote || row.continuity === "LEAVING")
    reasons.push({ kind: "engagement", label: "Acompanhamento manual" });
  if (attention.lowHealth)
    reasons.push({ kind: "engagement", label: `Health Score ${attention.healthScore}` });
  if (attention.materialMissing) reasons.push({ kind: "material", label: "Material a adquirir" });
  return reasons;
}
function academicReasons(attention: Placement["attention"]): AttentionReason[] {
  const reasons: AttentionReason[] = [];
  if (attention.grades !== "SUFFICIENT")
    reasons.push({
      kind: "grades",
      label: attention.grades === "INCOMPLETE" ? "Notas incompletas" : "Média insuficiente",
    });
  if (attention.attendanceFlagged || attention.attendance === null)
    reasons.push({
      kind: "attendance",
      label: attention.attendance === null ? "Presença sem registros" : "Presença abaixo da média",
    });
  return reasons;
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
