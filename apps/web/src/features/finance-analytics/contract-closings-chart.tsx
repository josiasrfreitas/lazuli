import type { ReactElement } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AXIS_STYLE, compactMoney, monthLabel } from "./chart-shared";
import {
  closingMeasures,
  closingValue,
  type ClosingChartMeasure,
  type ClosingMonth,
} from "./contract-closings-model";

const CHART_HEIGHT = 280;
const CHART_MARGIN = { top: 16, right: 12, left: 0, bottom: 8 };
type ClosingChartProps = {
  rows: ClosingMonth[];
  measure: ClosingChartMeasure;
  currentMonth: string;
};

function ClosingTooltip({
  active,
  payload,
}: {
  active?: boolean | undefined;
  payload?: readonly { payload?: ClosingMonth }[] | undefined;
}): ReactElement | null {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return (
    <div className="grid gap-3 rounded-sm border border-border bg-popover p-3 text-caption text-popover-foreground shadow-md">
      <p className="font-semibold capitalize">
        {monthLabel(row.month)} / {row.month.slice(0, 4)}
      </p>
      <dl className="grid gap-2">
        {closingMeasures.map((measure) => (
          <div key={measure.id} className="flex justify-between gap-6">
            <dt className="text-muted-foreground">{measure.label}</dt>
            <dd className="font-numeric font-medium tabular-nums">
              {closingValue(row, measure.id)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function ContractClosingsChart({
  rows,
  measure,
  currentMonth,
}: ClosingChartProps): ReactElement {
  return (
    <div
      className="mt-4 min-w-0"
      role="img"
      aria-label={`${measure === "count" ? "Quantidade de contratos" : "Volume contratado em reais"} por mês. O mês em andamento aparece atenuado. Valores disponíveis na tabela.`}
    >
      <ResponsiveContainer width="100%" height={CHART_HEIGHT} minWidth={0}>
        <BarChart data={rows} margin={CHART_MARGIN} accessibilityLayer>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 5" />
          <XAxis
            dataKey="month"
            tickFormatter={monthLabel}
            tick={AXIS_STYLE}
            axisLine={false}
            tickLine={false}
            minTickGap={12}
            dy={8}
          />
          <YAxis
            tickFormatter={measure === "count" ? String : compactMoney}
            allowDecimals={false}
            tick={AXIS_STYLE}
            axisLine={false}
            tickLine={false}
            width={52}
          />
          <Tooltip
            content={<ClosingTooltip />}
            cursor={{ fill: "var(--muted)", fillOpacity: 0.5 }}
          />
          <Bar
            dataKey={measure}
            name={measure === "count" ? "Contratos" : "Volume contratado"}
            fill="var(--info)"
            radius={[3, 3, 0, 0]}
            maxBarSize={40}
            isAnimationActive={false}
          >
            {rows.map((row) => (
              <Cell key={row.month} fillOpacity={row.month === currentMonth ? 0.4 : 1} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
