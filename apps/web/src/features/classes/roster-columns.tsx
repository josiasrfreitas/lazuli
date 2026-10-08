import { Button, type DataTableColumn } from "@lazuli/ui";
import type { RouterOutputs } from "@lazuli/api";

export type RosterRow = RouterOutputs["classes"]["roster"]["rows"][number];
type Row = RosterRow;
const DATE_LENGTH = 10;
const COLUMN_WIDTHS = {
  student: "wide",
} as const satisfies Record<string, NonNullable<DataTableColumn<Row>["width"]>>;

function status(row: Row, today: string): string {
  if (row.entryDate.toISOString().slice(0, DATE_LENGTH) > today) return "Programada";
  const close = row.actions[0];
  if (close && close.effectiveDate.toISOString().slice(0, DATE_LENGTH) <= today)
    return "Aguardando execução";
  if (row.exitDate === null || row.exitDate.toISOString().slice(0, DATE_LENGTH) > today)
    return "Vigente";
  return row.exitReason === "SUSPENDED" ? "Pausada" : "Encerrada";
}
export function rosterColumns(
  today: string,
  close: (row: Row) => void,
): readonly DataTableColumn<Row>[] {
  return [
    {
      id: "student",
      header: "Aluno",
      width: COLUMN_WIDTHS.student,
      cell: (row) => row.student.fullName,
    },
    { id: "stage", header: "Etapa", cell: (row) => row.progressRecords[0]?.stage.name ?? "—" },
    {
      id: "entry",
      header: "Entrada",
      cell: (row) => row.entryDate.toLocaleDateString("pt-BR", { timeZone: "UTC" }),
    },
    { id: "status", header: "Situação", cell: (row) => status(row, today) },
    {
      id: "actions",
      header: "Ação",
      cell: (row) =>
        status(row, today) === "Vigente" ? (
          <Button size="sm" variant="secondary" onClick={() => close(row)}>
            Pausar ou encerrar
          </Button>
        ) : null,
    },
  ];
}
