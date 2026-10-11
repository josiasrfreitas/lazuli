import type { Analytics } from "./chart-shared";
import { formatBRLFromCents } from "~/lib/format";

export type ClosingMonth = Analytics["contractClosings"]["months"][number];
export const closingMeasures = [
  { id: "projectedCents", label: "Receita projetada" },
  { id: "monthlyEquivalentCents", label: "Mensalidade equivalente" },
  { id: "count", label: "Quantidade de contratos" },
] as const;
export type ClosingMeasure = (typeof closingMeasures)[number]["id"];
type ClosingTotals = Omit<ClosingMonth, "month">;
const monthName = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" });

export function closingSummary(data: Analytics): { totals: ClosingTotals; period: string } {
  const current = data.contractClosings.months.find((row) => row.month === data.asOf.slice(0, 7));
  const totals =
    current ??
    data.contractClosings.months.reduce(
      (sum, row) => ({
        count: sum.count + row.count,
        projectedCents: sum.projectedCents + row.projectedCents,
        monthlyEquivalentCents: sum.monthlyEquivalentCents + row.monthlyEquivalentCents,
      }),
      { count: 0, projectedCents: 0, monthlyEquivalentCents: 0 },
    );
  const period = current
    ? `em ${monthName.format(new Date(`${current.month}-01`))}`
    : `em ${data.year}`;
  return { totals, period };
}

export function closingValue(row: ClosingMonth, measure: ClosingMeasure): string {
  if (measure === "count") return `${row.count} ${row.count === 1 ? "contrato" : "contratos"}`;
  return `${formatBRLFromCents(row[measure])}${measure === "monthlyEquivalentCents" ? "/mês" : ""}`;
}
