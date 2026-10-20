import { createHash } from "node:crypto";
import { saoPauloDateOnly } from "@lazuli/domain";
import type { FinancialTreatmentPreview } from "@lazuli/validators";
import { badRequest } from "../../trpc/errors.js";
import { loadSettlementItems, settlementLine, type SettlementItem } from "./settlement-data.js";
import { toDateOnlyString, type FinanceDatabase } from "./shared.js";
import {
  treatmentParties,
  treatmentParty,
  type TreatmentParty,
  type TreatmentRow,
} from "./treatment-data.js";

export const treatmentHash = <T>(value: T): string =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
export type TreatmentLine = {
  installmentId: string;
  party: TreatmentParty;
  sequenceNumber: number;
  origin: TreatmentRow["origin"];
  previousDueDate: string;
  newDueDate: string | null;
  chargesCents: number;
  reductionCents: number;
  balanceCents: number;
  resultingBalanceCents: number;
  newInterestCents: number;
  version: string;
};
export type TreatmentPreview = { date: string; lines: TreatmentLine[]; version: string };

export async function previewTreatment(
  database: FinanceDatabase,
  input: { values: FinancialTreatmentPreview; now: Date },
): Promise<TreatmentPreview> {
  const { values, now } = input;
  const today = saoPauloDateOnly(now);
  const ids = values.rows.map((row) => row.installmentId);
  if (new Set(ids).size !== ids.length) throw badRequest("Parcela repetida.");
  if (values.newDueDate && values.newDueDate <= today)
    throw badRequest("O novo vencimento deve ser posterior a hoje.");
  const parties = await treatmentParties(database, { ids, studentId: values.studentId });
  if (parties.size !== ids.length)
    throw badRequest("Selecione apenas parcelas disponíveis deste aluno ou lote.");
  const items = await loadSettlementItems(database, ids);
  const byId = new Map(items.map((item) => [item.id, item]));
  const lines = values.rows.map((choice) => {
    const item = byId.get(choice.installmentId);
    if (!item) throw badRequest("Uma parcela não está mais disponível. Revise a seleção.");
    return previewLine({
      item,
      choice,
      newDueDate: values.newDueDate,
      party: treatmentParty(parties, item.id),
      today,
      now,
    });
  });
  if (!values.newDueDate && lines.every((line) => line.reductionCents === 0))
    throw badRequest("Informe uma redução de encargos ou uma suspensão.");
  return { date: today, lines, version: treatmentHash({ today, values, lines }) };
}

function previewLine(input: {
  item: SettlementItem;
  choice: FinancialTreatmentPreview["rows"][number];
  newDueDate: string | undefined;
  party: TreatmentParty;
  today: string;
  now: Date;
}): TreatmentLine {
  const { item, choice, newDueDate, party, today, now } = input;
  const line = settlementLine({ item, date: today, now });
  const balance = line.quote.balanceCents + line.quote.newInterestCents;
  if (balance <= 0) throw badRequest("Parcela quitada não aceita tratativa.");
  if (newDueDate && newDueDate < toDateOnlyString(item.dueDate))
    throw badRequest("A suspensão não pode antecipar o vencimento atual.");
  const charges = line.quote.outstandingChargesCents;
  const reduction = choice.forgiveCharges ? charges : choice.reductionCents;
  if (reduction > charges)
    throw badRequest(`Parcela ${item.sequenceNumber}: redução maior que os encargos em aberto.`);
  return {
    installmentId: item.id,
    party,
    sequenceNumber: item.sequenceNumber,
    origin: item.order.kind,
    previousDueDate: toDateOnlyString(item.dueDate),
    newDueDate: newDueDate ?? null,
    chargesCents: charges,
    reductionCents: reduction,
    balanceCents: balance,
    resultingBalanceCents: balance - reduction,
    newInterestCents: line.quote.newInterestCents,
    version: line.version,
  };
}
