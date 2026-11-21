import writeXlsxFile from "write-excel-file/node";
import type { Row } from "write-excel-file";
import type { TableExportRequest } from "@lazuli/validators";

export type Tone = "success" | "warning" | "danger" | "muted";
type Value = { value: string | number; format?: string; tone?: Tone };
export type ExportValue = string | number | Value;
export type ExportTable = { headings: string[]; rows: ExportValue[][] };
const CENTS_PER_REAL = 100;
const MIN_COLUMN_WIDTH = 15;
const MAX_COLUMN_WIDTH = 60;
const HEADING_PADDING = 4;
const CELL_PADDING = 3;
const colors = { success: "#176046", warning: "#865500", danger: "#9C3434", muted: "#536376" };
export const money = (cents: number): Value => ({
  value: cents / CENTS_PER_REAL,
  format: '"R$" #,##0.00',
});
export const percent = (value: number): Value => ({ value, format: "0%" });
export function buildWorkbook(request: TableExportRequest, table: ExportTable): Promise<Buffer> {
  const header = (labels: string[]): Row =>
    labels.map((value) => ({
      value,
      type: String,
      fontWeight: "bold",
      color: "#FFFFFF",
      backgroundColor: "#21476B",
      height: 25,
      alignVertical: "center",
    }));
  const data: Row[] = [
    [
      {
        value: "Lazuli  /  " + request.source.listing,
        span: table.headings.length,
        fontWeight: "bold",
        fontSize: 16,
        backgroundColor: "#142F4D",
        color: "#FFFFFF",
        height: 34,
        alignVertical: "center",
      },
    ],
    header(table.headings),
  ];
  const widths = table.headings.map((label) =>
    Math.max(MIN_COLUMN_WIDTH, label.length + HEADING_PADDING),
  );
  for (const [index, values] of table.rows.entries()) {
    data.push(
      values.map((entry, column) => {
        const cell = typeof entry === "object" ? entry : { value: entry };
        widths[column] = Math.min(
          MAX_COLUMN_WIDTH,
          Math.max(widths[column] ?? MIN_COLUMN_WIDTH, String(cell.value).length + CELL_PADDING),
        );
        return {
          value: cell.value,
          type: typeof cell.value === "number" ? Number : String,
          ...(cell.format ? { format: cell.format } : {}),
          ...(column === 0 || cell.tone ? { fontWeight: "bold" as const } : {}),
          color: cell.tone ? colors[cell.tone] : "#203753",
          backgroundColor: index % 2 ? "#EEF4FA" : "#FFFFFF",
          height: 22,
          alignVertical: "center",
        };
      }),
    );
  }
  const details: Row[] = [
    header(["Filtros aplicados", "Seleção"]),
    ...request.criteria.map(([label, value]): Row => [
      { value: label, fontWeight: "bold" },
      { value, type: String, wrap: true },
    ]),
    [
      { value: "Total de registros", fontWeight: "bold" },
      { value: table.rows.length, type: Number },
    ],
  ];
  return writeXlsxFile([data, details], {
    buffer: true,
    sheets: [request.source.listing, "Filtros"],
    columns: [widths.map((width) => ({ width })), [{ width: 24 }, { width: 65 }]],
    stickyRowsCount: 2,
  });
}
