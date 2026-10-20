import type { RouterOutputs } from "@lazuli/api";
import { formatBRLFromCents } from "../../lib/format";

export type Closings = RouterOutputs["finance"]["contractClosings"];
export type ClosingMonth = Closings["months"][number];
export const closingMeasures = [
  { id: "projectedCents", label: "Volume contratado" },
  { id: "monthlyEquivalentCents", label: "Mensalidade equivalente" },
  { id: "count", label: "Quantidade de contratos" },
] as const;
export type ClosingMeasure = (typeof closingMeasures)[number]["id"];
export type ClosingChartMeasure = "projectedCents" | "count";
const PREVIOUS_MONTH_INDEX = -2;
const MONTH_KEY_LENGTH = 7;
const CENTS_PER_UNIT = 100;
const monthName = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" });
export function monthLabel(month: string): string {
  return monthName.format(new Date(`${month}-01`)).replace(".", "");
}
export function compactMoney(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(
    cents / CENTS_PER_UNIT,
  );
}
export function closingRows(data: Closings): ClosingMonth[] {
  return data.months.filter((row) => row.month <= data.asOf.slice(0, MONTH_KEY_LENGTH));
}
export function closingSummary(data: Closings): {
  totals: Omit<ClosingMonth, "month">;
  period: string;
} {
  const rows = closingRows(data);
  const totals = { count: 0, projectedCents: 0, monthlyEquivalentCents: 0 };
  for (const row of rows) {
    totals.count += row.count;
    totals.projectedCents += row.projectedCents;
    totals.monthlyEquivalentCents += row.monthlyEquivalentCents;
  }
  return { totals, period: `em ${data.year}` };
}
export function closingValue(
  row: ClosingMonth | Omit<ClosingMonth, "month">,
  measure: ClosingMeasure,
): string {
  if (measure === "count") return `${row.count} ${row.count === 1 ? "contrato" : "contratos"}`;
  return `${formatBRLFromCents(row[measure])}${measure === "monthlyEquivalentCents" ? "/mês" : ""}`;
}

export function closingGrowth(
  data: Closings,
  measure: ClosingChartMeasure,
): { month: string; previousMonth: string; rate: number | null } | null {
  const completed = closingRows(data).filter(
    (row) => row.month < data.asOf.slice(0, MONTH_KEY_LENGTH),
  );
  const current = completed.at(-1);
  const previous = completed.at(PREVIOUS_MONTH_INDEX);
  if (!current || !previous) return null;
  return {
    month: current.month,
    previousMonth: previous.month,
    rate:
      previous[measure] === 0 ? null : (current[measure] - previous[measure]) / previous[measure],
  };
}
