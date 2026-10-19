import type { ReactElement } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatBRLFromCents } from "~/lib/format";
import {
  AXIS_STYLE,
  CHART_HEIGHT,
  TOOLTIP_STYLE,
  ChartLegend,
  ChartPanel,
  compactMoney,
  monthLabel,
  type Analytics,
} from "./chart-shared";

const MONTH_KEY_LENGTH = 7;

export function RevenueChart({ data }: { data: Analytics }): ReactElement {
  const months = data.months.map((month) => ({
    ...month,
    receivedCents: month.month > data.asOf.slice(0, MONTH_KEY_LENGTH) ? null : month.receivedCents,
  }));
  return (
    <ChartPanel
      title="Cobranças e recebimentos"
      description={`Por vencimento e data de pagamento · ${data.year}.${data.asOf.startsWith(`${data.year}-`) ? " Mês atual em andamento." : ""}`}
    >
      <div className="mt-5 flex flex-wrap gap-5">
        <ChartLegend label="Cobranças" color="var(--info)" />
        <ChartLegend label="Recebido" color="var(--success)" />
      </div>
      <div
        className="mt-6 h-72 min-w-0"
        role="img"
        aria-label={`Gráfico mensal de cobranças e recebimentos em ${data.year}. Valores detalhados na tabela abaixo.`}
      >
        <ResponsiveContainer width="100%" height={CHART_HEIGHT} minWidth={0}>
          <ComposedChart
            data={months}
            margin={{ top: 12, right: 8, left: 0, bottom: 0 }}
            accessibilityLayer
          >
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 5" />
            <XAxis
              dataKey="month"
              tickFormatter={monthLabel}
              tick={AXIS_STYLE}
              axisLine={false}
              tickLine={false}
              dy={8}
            />
            <YAxis
              tickFormatter={compactMoney}
              tick={AXIS_STYLE}
              axisLine={false}
              tickLine={false}
              width={60}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              labelFormatter={(value) => monthLabel(String(value))}
              formatter={(value) => formatBRLFromCents(Number(value))}
              cursor={{ fill: "var(--muted)", fillOpacity: 0.5 }}
            />
            <Bar
              dataKey="expectedCents"
              name="Cobranças"
              fill="var(--info)"
              fillOpacity={0.2}
              radius={[4, 4, 0, 0]}
              maxBarSize={32}
              isAnimationActive={false}
            />
            <Line
              dataKey="receivedCents"
              name="Recebido"
              type="monotone"
              stroke="var(--success)"
              strokeWidth={3}
              dot={{ r: 3, fill: "var(--card)", strokeWidth: 2 }}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartPanel>
  );
}
