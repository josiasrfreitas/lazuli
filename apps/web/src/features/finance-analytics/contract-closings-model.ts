import type { Analytics } from "./chart-shared";
import { formatBRLFromCents } from "../../lib/format";

export type ClosingMonth = Analytics["contractClosings"]["months"][number];
export const closingMeasures = [
  { id: "projectedCents", label: "Volume contratado" },
  { id: "monthlyEquivalentCents", label: "Mensalidade equivalente" },
  { id: "count", label: "Quantidade de contratos" },
] as const;
export type ClosingMeasure = (typeof closingMeasures)[number]["id"];
export type ClosingChartMeasure = "projectedCents" | "count";
type ClosingTotals = Omit<ClosingMonth, "month">;
const MONTH_KEY_LENGTH = 7;

export function closingSummary(data: Analytics): { totals: ClosingTotals; period: string } {
  const totals = closingRows(data).reduce(
    (sum, row) => ({
      count: sum.count + row.count,
      projectedCents: sum.projectedCents + row.projectedCents,
      monthlyEquivalentCents: sum.monthlyEquivalentCents + row.monthlyEquivalentCents,
    }),
    { count: 0, projectedCents: 0, monthlyEquivalentCents: 0 },
  );
  return { totals, period: `em ${data.year}` };
}

export function closingRows(data: Analytics): ClosingMonth[] {
  return data.contractClosings.months.filter(
    (row) => row.month <= data.asOf.slice(0, MONTH_KEY_LENGTH),
  );
}

export function closingGrowth(
  data: Analytics,
  measure: ClosingChartMeasure,
): {
  month: string;
  previousMonth: string;
  rate: number | null;
} | null {
  const completed = closingRows(data).filter(
    (row) => row.month < data.asOf.slice(0, MONTH_KEY_LENGTH),
  );
  const current = completed.at(-1);
  const previous = completed.at(-2);
  if (!current || !previous) return null;
  return {
    month: current.month,
    previousMonth: previous.month,
    rate:
      previous[measure] === 0 ? null : (current[measure] - previous[measure]) / previous[measure],
  };
}

export function closingValue(row: ClosingMonth, measure: ClosingMeasure): string {
  if (measure === "count") return `${row.count} ${row.count === 1 ? "contrato" : "contratos"}`;
  return `${formatBRLFromCents(row[measure])}${measure === "monthlyEquivalentCents" ? "/mês" : ""}`;
}
