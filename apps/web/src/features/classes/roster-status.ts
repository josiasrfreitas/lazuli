import type { RouterOutputs } from "@lazuli/api";

export type RosterRow = RouterOutputs["classes"]["roster"]["rows"][number];
type Row = RosterRow;
const DATE_LENGTH = 10;
export function rosterStatus(row: Row, today: string): string {
  if (row.entryDate.toISOString().slice(0, DATE_LENGTH) > today) return "Programada";
  const close = row.actions[0];
  if (close && close.effectiveDate.toISOString().slice(0, DATE_LENGTH) <= today)
    return "Aguardando execução";
  if (row.exitDate === null || row.exitDate.toISOString().slice(0, DATE_LENGTH) > today)
    return "Vigente";
  return row.exitReason === "SUSPENDED" ? "Pausada" : "Encerrada";
}
