import type { ReactElement } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatBRLFromCents } from "~/lib/format";
import {
  AXIS_STYLE,
  CHART_COLORS,
  TOOLTIP_STYLE,
  ChartLegend,
  ChartPanel,
  compactMoney,
  type Analytics,
} from "./chart-shared";
const METHOD_LABELS: Record<string, string> = {
  PIX: "Pix",
  CARD: "Cartão",
  TRANSFER: "Transferência",
  CASH: "Dinheiro",
  CREDIT_CARD: "Cartão de crédito",
  DEBIT_CARD: "Cartão de débito",
  BANK_TRANSFER: "Transferência",
  BOLETO: "Boleto",
  OTHER: "Outros",
};
const PIE_HEIGHT = 184;
const AGING_HEIGHT = 210;
export function PaymentMethodsChart({ data }: { data: Analytics }): ReactElement {
  const methods = data.methods.map((row) => ({
    ...row,
    label: METHOD_LABELS[row.method] ?? row.method,
  }));
  return (
    <ChartPanel title="Meios de pagamento" description={`Recebimentos de ${data.year}`}>
      {methods.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Nenhum recebimento neste período.
        </p>
      ) : (
        <>
          <div
            className="my-3"
            role="img"
            aria-label="Distribuição dos recebimentos por meio de pagamento; valores na legenda."
          >
            <ResponsiveContainer width="100%" height={PIE_HEIGHT} minWidth={0}>
              <PieChart accessibilityLayer>
                <Pie
                  data={methods}
                  dataKey="receivedCents"
                  nameKey="label"
                  innerRadius={56}
                  outerRadius={80}
                  paddingAngle={3}
                  stroke="var(--card)"
                  isAnimationActive={false}
                >
                  {methods.map((row, index) => (
                    <Cell key={row.method} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(value) => formatBRLFromCents(Number(value))}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <dl className="grid gap-2.5">
            {methods.map((row, index) => (
              <div key={row.method} className="flex flex-wrap items-center justify-between gap-2">
                <dt>
                  <ChartLegend
                    label={row.label}
                    color={CHART_COLORS[index % CHART_COLORS.length]!}
                  />
                </dt>
                <dd className="font-numeric text-sm tabular-nums">
                  {formatBRLFromCents(row.receivedCents)}
                </dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </ChartPanel>
  );
}
export function AgingChart({ data }: { data: Analytics }): ReactElement {
  return (
    <ChartPanel title="Tempo de atraso" description="Saldo vencido atual · todos os anos">
      <div
        className="mt-6"
        role="img"
        aria-label="Saldo vencido agrupado por dias de atraso; valores detalhados abaixo."
      >
        <ResponsiveContainer width="100%" height={AGING_HEIGHT} minWidth={0}>
          <BarChart
            data={data.aging}
            layout="vertical"
            margin={{ left: 0, right: 16 }}
            accessibilityLayer
          >
            <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="3 5" />
            <XAxis
              type="number"
              tickFormatter={compactMoney}
              tick={AXIS_STYLE}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={94}
              tick={AXIS_STYLE}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(value) => formatBRLFromCents(Number(value))}
              cursor={{ fill: "var(--muted)" }}
            />
            <Bar
              dataKey="balanceCents"
              name="Saldo vencido"
              fill="var(--warning)"
              radius={[0, 4, 4, 0]}
              maxBarSize={20}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-4">
        {data.aging.map((row) => (
          <div key={row.label}>
            <dt className="text-caption text-muted-foreground">
              {row.label} · {row.count} parcelas
            </dt>
            <dd className="mt-1 font-numeric text-sm font-medium tabular-nums">
              {formatBRLFromCents(row.balanceCents)}
            </dd>
          </div>
        ))}
      </dl>
    </ChartPanel>
  );
}
