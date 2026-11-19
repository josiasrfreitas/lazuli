import { confirmationLabels } from "./confirmation";
import type { OrganizationBoard, Placement } from "./model";
import { dateOnly } from "./shared";

type ReviewStatus = {
  label: string;
  variant: "success" | "info" | "warning" | "neutral" | "destructive";
  impliedBlocker?: string;
};

const destinationBlocker = "Definir a turma de destino";
export function reviewBlockers(row: Pick<Placement, "blockers">): string[] {
  return [
    ...new Set(
      row.blockers.map((reason) =>
        reason === "Escolha a nova turma para continuar." ||
        reason === "Escolha uma turma planejada"
          ? destinationBlocker
          : reason,
      ),
    ),
  ];
}

export function reviewEffectiveDate(
  row: Pick<Placement, "effectiveDate">,
  board: { semester: Pick<OrganizationBoard["semester"], "startDate"> },
): string {
  return dateOnly(row.effectiveDate ?? board.semester.startDate);
}

export function reviewStatus(row: Placement, ended: boolean): ReviewStatus {
  if (row.declinedAt) return { label: "Não vai continuar", variant: "neutral" };
  if (row.entryStatus === "CANCELLED") return { label: "Revisar vínculo", variant: "warning" };
  if (row.classClosurePending)
    return { label: "Turma encerrada", variant: "warning", impliedBlocker: "Turma encerrada" };
  if (row.publishedAt) return { label: confirmationLabels.CONFIRMED, variant: "success" };
  if (row.exitRiskActive || row.continuity === "LEAVING")
    return { label: "Risco de saída", variant: "warning", impliedBlocker: "Risco de saída" };
  if (ended) return { label: "Sem alocação", variant: "neutral" };
  if (row.continuity === "CHANGE")
    return { label: "Aguarda outra turma", variant: "warning", impliedBlocker: destinationBlocker };
  if (!row.planId)
    return {
      label: "Precisa escolher turma",
      variant: "warning",
      impliedBlocker: destinationBlocker,
    };
  if (row.confirmation === "PRECONFIRMED")
    return { label: confirmationLabels.PRECONFIRMED, variant: "info" };
  if (row.blockers.length)
    return {
      label:
        row.confirmation === "BLOCKED" ? confirmationLabels.BLOCKED : "Vínculo com impedimento",
      variant: "destructive",
    };
  return {
    label: row.mode === "ENTRY" ? "Entrada a confirmar" : "Transferência a confirmar",
    variant: "neutral",
  };
}
