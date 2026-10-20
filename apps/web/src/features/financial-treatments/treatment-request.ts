import { saoPauloDateOnly } from "@lazuli/domain";
import {
  financialTreatmentPreviewSchema,
  type FinancialTreatmentPreview,
} from "@lazuli/validators";
import { parseDateBR } from "~/lib/masks";
import type { TreatmentRow } from "./use-treatment";

const MAX_SELECTION = 100;
const MIN_REASON_LENGTH = 3;
const MAX_REASON_LENGTH = 2000;
const CENTS_PER_REAL = 100;
const MONEY_PARTS = 2;
type Draft = {
  studentId: string | undefined;
  chosen: TreatmentRow[];
  selected: string[];
  amounts: Record<string, string>;
  suspension: boolean;
  until: string;
  reason: string;
};
export type TreatmentErrors = Record<string, string>;
export function treatmentRequest(draft: Draft): {
  request: FinancialTreatmentPreview | undefined;
  errors: TreatmentErrors;
} {
  const errors: TreatmentErrors = {};
  if (draft.chosen.length === 0) errors.selection = "Selecione ao menos uma parcela.";
  if (draft.chosen.length !== draft.selected.length)
    errors.selection = "Uma parcela não está mais disponível. Revise a seleção.";
  if (draft.chosen.length > MAX_SELECTION)
    errors.selection = "Selecione até 100 parcelas por tratativa.";
  if (draft.reason.trim().length < MIN_REASON_LENGTH)
    errors.reason = "Descreva o que foi combinado com o responsável.";
  if (draft.reason.trim().length > MAX_REASON_LENGTH) errors.reason = "Use até 2.000 caracteres.";
  const newDueDate = suspensionDate(draft, errors);
  const rows = draft.chosen.map((row) =>
    treatmentChoice(row, { value: draft.amounts[row.id], errors }),
  );
  if (!draft.suspension && rows.every((row) => row.reductionCents === 0))
    errors.action = "Reduza os encargos ou defina um novo vencimento.";
  const parsed = financialTreatmentPreviewSchema.safeParse({
    studentId: draft.studentId,
    rows,
    ...(newDueDate ? { newDueDate } : {}),
  });
  return { request: parsed.success ? parsed.data : undefined, errors };
}
function suspensionDate(draft: Draft, errors: TreatmentErrors): string | null {
  if (!draft.suspension) return null;
  const value = parseDateBR(draft.until);
  if (!value) errors.until = "Informe uma data válida.";
  else if (value <= saoPauloDateOnly(new Date()))
    errors.until = "Escolha uma data posterior a hoje.";
  else if (draft.chosen.some((row) => row.dueDate > value))
    errors.until = "A data não pode antecipar o vencimento de nenhuma parcela selecionada.";
  return value;
}
function treatmentChoice(
  row: TreatmentRow,
  context: { value: string | undefined; errors: TreatmentErrors },
): FinancialTreatmentPreview["rows"][number] {
  const { value, errors } = context;
  const clean = (value ?? "0,00").trim();
  const reductionCents = row.chargesCents === 0 ? 0 : parseReduction(clean);
  if (!Number.isFinite(reductionCents)) errors[row.id] = "Informe um valor, como 10,00.";
  else if (reductionCents > row.chargesCents)
    errors[row.id] = "A redução não pode superar os encargos.";
  return { installmentId: row.id, reductionCents, forgiveCharges: false };
}

function parseReduction(value: string): number {
  if (!value) return 0;
  const parts = value.replace(",", ".").split(".");
  const [units = "", decimals = ""] = parts;
  if (parts.length > MONEY_PARTS || !/^\d+$/.test(units) || !/^\d{0,2}$/.test(decimals))
    return Number.NaN;
  return Math.round(Number(value.replace(",", ".")) * CENTS_PER_REAL);
}
