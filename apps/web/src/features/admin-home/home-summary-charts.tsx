import type { ReactElement } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Line,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { BusinessData } from "./home-metrics";
import { useChartEntrance } from "./use-chart-entrance";
import styles from "./home-summary.module.css";

type Series = { month: string; value: number }[];
const COMPACT_MONEY_UNIT = 100_000;
const CENTS_PER_REAL = 100;
const COMPARISON_WIDTH = 100;
const monthLabel = (month: string): string =>
  new Intl.DateTimeFormat("pt-BR", {
    month: "short",
    timeZone: "UTC",
  })
    .format(new Date(`${month}-01T12:00:00Z`))
    .replace(".", "");
const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});
const compactMoney = (value: number): string =>
  value === 0
    ? "0"
    : `${(value / COMPACT_MONEY_UNIT).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}\u00A0mil`;

function monthAxis(): ReactElement {
  return (
    <XAxis
      dataKey="month"
      tickFormatter={monthLabel}
      tick={{ fill: "currentColor", fontSize: 12 }}
      axisLine={false}
      tickLine={false}
      interval={0}
    />
  );
}

export function EnrollmentChart({
  series,
  label = "entradas",
}: {
  series: Series;
  label?: string;
}): ReactElement {
  const animate = useChartEntrance();
  return (
    <div className={styles.enrollmentChart}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart
          data={series}
          accessibilityLayer
          margin={{ top: 24, right: 0, bottom: 0, left: 0 }}
        >
          {monthAxis()}
          <Tooltip
            cursor={false}
            content={({ active, payload, label: month }) =>
              active && payload?.[0] ? (
                <div className={styles.tooltip}>
                  {monthLabel(String(month))}: {payload[0].value} {label}
                </div>
              ) : null
            }
          />
          <Bar
            dataKey="value"
            name={label}
            fill="currentColor"
            radius={[2, 2, 0, 0]}
            maxBarSize={8}
            isAnimationActive={animate}
            animationBegin={120}
            animationDuration={750}
            animationEasing="ease-out"
          >
            <LabelList dataKey="value" position="top" fill="currentColor" fontSize={12} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ReceiptsChart({ months }: { months: BusinessData["months"] }): ReactElement {
  return (
    <div className={styles.receiptsChart}>
      <ReceiptsLegend />
      <ReceiptsPlot months={months} />
    </div>
  );
}
function ReceiptsLegend(): ReactElement {
  return (
    <div className={styles.chartLegend}>
      <span>
        <i />
        Recebido
      </span>
      <span>
        <i />
        Previsto
      </span>
    </div>
  );
}

function ReceiptsPlot({ months }: { months: BusinessData["months"] }): ReactElement {
  return (
    <div className={styles.linePlot}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <ComposedChart
          data={months}
          accessibilityLayer
          margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
        >
          <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.12} />
          {monthAxis()}
          <YAxis
            yAxisId="revenue"
            tickFormatter={compactMoney}
            tick={{ fill: "currentColor", fontSize: 11, width: 50 }}
            axisLine={false}
            tickLine={false}
            width={50}
            tickCount={3}
            domain={[0, "auto"]}
          />
          {receiptTooltip(months)}
          {receiptMarks()}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function receiptTooltip(months: BusinessData["months"]): ReactElement {
  return (
    <Tooltip
      position={{ ["y"]: 0 }}
      cursor={false}
      content={({ active, payload, label }) =>
        active && payload?.length ? (
          <div className={styles.tooltip}>
            <strong>{monthLabel(String(label))}</strong>
            {payload.map((item) => (
              <p key={String(item.dataKey)}>
                {item.name}: {money.format(Number(item.value) / CENTS_PER_REAL)}
              </p>
            ))}
            <p>
              Em aberto hoje:{" "}
              {money.format(
                (months.find((month) => month.month === String(label))?.balanceCents ?? 0) /
                  CENTS_PER_REAL,
              )}
            </p>
          </div>
        ) : null
      }
    />
  );
}

function receiptMarks(): ReactElement[] {
  return [
    <Line
      key="expected"
      yAxisId="revenue"
      dataKey="expectedCents"
      name="Previsto"
      type="linear"
      stroke="var(--info)"
      strokeOpacity={0.8}
      strokeDasharray="4 5"
      strokeWidth={1.5}
      dot={false}
      isAnimationActive={false}
    />,
    <Line
      key="received"
      yAxisId="revenue"
      dataKey="receivedCents"
      name="Recebido"
      type="monotone"
      stroke="var(--success)"
      strokeWidth={2.5}
      dot={{ ["r"]: 3, fill: "var(--success)", strokeWidth: 0 }}
      activeDot={{ ["r"]: 5 }}
      isAnimationActive={false}
    />,
  ];
}

export function TrialComparison({
  current,
  previous,
}: {
  current: number;
  previous: number;
}): ReactElement {
  const max = Math.max(1, current, previous);
  return (
    <div
      className={styles.trialComparison}
      role="img"
      aria-label={`${current} experimentais realizadas neste mês; ${previous} nos mesmos dias do mês anterior.`}
    >
      {[
        { label: "Neste mês", value: current },
        { label: "Mesmo período anterior", value: previous },
      ].map((item) => (
        <div key={item.label}>
          <span>{item.label}</span>
          <svg viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true">
            <rect width="100" height="8" rx="4" fill="currentColor" opacity="0.1" />
            <rect
              width={(item.value / max) * COMPARISON_WIDTH}
              height="8"
              rx="4"
              fill="currentColor"
            />
          </svg>
          <strong>{item.value.toLocaleString("pt-BR")}</strong>
        </div>
      ))}
    </div>
  );
}
