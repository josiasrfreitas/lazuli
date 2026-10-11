import type { ReactElement } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type LabelProps as RechartsLabelProps,
} from "recharts";
import { AXIS_STYLE, compactMoney, monthLabel } from "./chart-shared";
import {
  closingMeasures,
  closingValue,
  type ClosingMeasure,
  type ClosingMonth,
} from "./contract-closings-model";

const CHART_HEIGHT = 340;
const LABEL_LINE_HEIGHT = 15;
const LABEL_OFFSET = 8;
const CHART_MARGIN = { top: 60, right: 8, left: 0, bottom: 12 };
type ClosingChartProps = { rows: ClosingMonth[]; labels: ClosingMeasure[] };
type LabelProps = Pick<RechartsLabelProps, "x" | "y" | "width"> & {
  row: ClosingMonth | undefined;
  selected: ClosingMeasure[];
};

function labelText(row: ClosingMonth, measure: ClosingMeasure): string {
  if (measure === "count") return `${row.count} contr.`;
  return `${compactMoney(row[measure])}${measure === "monthlyEquivalentCents" ? "/mês" : ""}`;
}

function ClosingLabels({ x, y, width, row, selected }: LabelProps): ReactElement | null {
  if (!row?.count || x === undefined || y === undefined || width === undefined) return null;
  const labels = selected.map((measure) => labelText(row, measure));
  const center = Number(x) + Number(width) / 2;
  const top = Number(y) - LABEL_OFFSET - (labels.length - 1) * LABEL_LINE_HEIGHT;
  return (
    <text
      x={center}
      y={top}
      textAnchor="middle"
      fill="var(--foreground)"
      fontSize={11}
      fontFamily="var(--font-numeric)"
    >
      {labels.map((label, offset) => (
        <tspan key={label} x={center} dy={offset ? LABEL_LINE_HEIGHT : 0}>
          {label}
        </tspan>
      ))}
    </text>
  );
}

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
        Fechamentos de {monthLabel(row.month)} / {row.month.slice(0, 4)}
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

function ClosingBars({ rows, labels }: ClosingChartProps): ReactElement {
  return (
    <>
      <Bar
        dataKey="monthlyEquivalentCents"
        name="Mensalidade equivalente"
        stackId="projection"
        fill="var(--info)"
        maxBarSize={48}
        isAnimationActive={false}
      />
      <Bar
        dataKey="remainingProjectedCents"
        name="Demais meses do prazo contratado"
        stackId="projection"
        fill="var(--info)"
        fillOpacity={0.22}
        radius={[2, 2, 0, 0]}
        maxBarSize={48}
        isAnimationActive={false}
      >
        <LabelList
          dataKey="month"
          content={(props) => (
            <ClosingLabels
              {...props}
              row={rows.find((row) => row.month === props.value)}
              selected={labels}
            />
          )}
        />
      </Bar>
    </>
  );
}

function ClosingPlot({ rows, labels }: ClosingChartProps): ReactElement {
  const values = rows.map((row) => ({
    ...row,
    remainingProjectedCents: row.projectedCents - row.monthlyEquivalentCents,
  }));
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT} minWidth={0}>
      <BarChart data={values} margin={CHART_MARGIN} accessibilityLayer>
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
        <Tooltip content={<ClosingTooltip />} cursor={{ fill: "var(--muted)", fillOpacity: 0.5 }} />
        <ClosingBars rows={rows} labels={labels} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ContractClosingsChart({ rows, labels }: ClosingChartProps): ReactElement {
  return (
    <div className="scrollbar-subtle mt-5 overflow-x-auto">
      <div
        className="min-w-2xl"
        role="img"
        aria-label="Receita projetada dos contratos fechados por mês. A altura total mostra o prazo completo; a faixa destacada equivale a uma mensalidade. Consulte os valores na opção Tabela."
      >
        <ClosingPlot rows={rows} labels={labels} />
      </div>
    </div>
  );
}
