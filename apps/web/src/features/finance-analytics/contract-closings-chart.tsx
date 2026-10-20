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
import {
  closingMeasures,
  closingValue,
  compactMoney,
  monthLabel,
  type ClosingChartMeasure,
  type ClosingMonth,
} from "./contract-closings-model";

const BAR_CORNER_RADIUS = 3;
const CURRENT_MONTH_OPACITY = 0.4;
const YEAR_LENGTH = 4;
const CHART_HEIGHT = 280;
const CHART_MARGIN = { top: 16, right: 12, left: 0, bottom: 8 };
const AXIS_PROPS = {
  tick: { fill: "var(--muted-foreground)", fontSize: 12 },
  axisLine: false,
  tickLine: false,
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
    <div className="grid gap-2 rounded-sm border border-border bg-popover p-3 text-caption text-popover-foreground shadow-md">
      <p className="font-semibold capitalize">
        {monthLabel(row.month)} / {row.month.slice(0, YEAR_LENGTH)}
      </p>
      <dl className="grid gap-2">
        {closingMeasures.map((measure) => (
          <div key={measure.id} className="flex justify-between gap-4">
            <dt>{measure.label}</dt>
            <dd className="font-numeric tabular-nums">{closingValue(row, measure.id)}</dd>
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
}: {
  rows: ClosingMonth[];
  measure: ClosingChartMeasure;
  currentMonth: string;
}): ReactElement {
  return (
    <div className="mt-4 min-w-0">
      <div
        className="min-w-0"
        role="img"
        aria-label={`${measure === "count" ? "Quantidade de contratos" : "Volume contratado em reais"} por mês. O mês em andamento aparece atenuado. Valores disponíveis na tabela.`}
      >
        <ResponsiveContainer width="100%" height={CHART_HEIGHT} minWidth={0}>
          <BarChart data={rows} margin={CHART_MARGIN} accessibilityLayer>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis {...AXIS_PROPS} dataKey="month" tickFormatter={monthLabel} />
            <YAxis
              {...AXIS_PROPS}
              tickFormatter={measure === "count" ? String : compactMoney}
              allowDecimals={false}
              width={52}
            />
            <Tooltip
              content={<ClosingTooltip />}
              cursor={{ fill: "var(--muted)", fillOpacity: 0.5 }}
            />
            <Bar
              dataKey={measure}
              fill="var(--info)"
              radius={[BAR_CORNER_RADIUS, BAR_CORNER_RADIUS, 0, 0]}
              maxBarSize={40}
              isAnimationActive={false}
            >
              {rows.map((row) => (
                <Cell
                  key={row.month}
                  fillOpacity={row.month === currentMonth ? CURRENT_MONTH_OPACITY : 1}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
