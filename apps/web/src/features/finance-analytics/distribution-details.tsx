import { useState, type ReactElement } from "react";
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
import { formatBRLFromCents, formatDateOnlyBR } from "~/lib/format";
import { compactMoney } from "./contract-closings-model";
import type { Analytics } from "./revenue-chart";

const METHOD_LABELS = new Map([
  ["PIX", "Pix"],
  ["CASH", "Dinheiro"],
  ["TRANSFER", "Transferência"],
  ["CARD", "Cartão"],
  ["CHEQUE", "Cheque"],
  ["BOLETO", "Boleto"],
  ["OTHER", "Outros"],
]);
const COLORS = ["var(--info)", "var(--success)", "var(--warning)", "var(--muted-foreground)"];
const AXIS_PROPS = {
  tick: { fill: "var(--muted-foreground)", fontSize: 12 },
  axisLine: false,
  tickLine: false,
};
const PIE_HEIGHT = 184;
const AGING_HEIGHT = 210;
const BAR_CORNER_RADIUS = 4;
type Method = Analytics["methods"][number] & { label: string };

export function DistributionDetails({ data }: { data: Analytics }): ReactElement {
  const [expanded, setExpanded] = useState(false);
  return (
    <details onToggle={(event) => setExpanded(event.currentTarget.open)}>
      <summary className="w-fit cursor-pointer rounded-sm text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        Detalhar atrasos e meios de pagamento
      </summary>
      {expanded && (
        <div className="mt-4 grid min-w-0 gap-5 lg:grid-cols-2">
          <AgingChart data={data} />
          <PaymentMethodsChart data={data} />
        </div>
      )}
    </details>
  );
}
function PaymentMethodsChart({ data }: { data: Analytics }): ReactElement {
  const methods = data.methods.map((row) => ({
    ...row,
    label: METHOD_LABELS.get(row.method) ?? row.method,
  }));
  return (
    <section className="min-w-0 border-t border-border pt-4" aria-labelledby="methods-title">
      <h3 id="methods-title" className="font-semibold text-heading">
        Meios de pagamento
      </h3>
      <p className="text-caption text-muted-foreground">
        Recebimentos de {data.year} · até {formatDateOnlyBR(data.asOf)}
      </p>
      {methods.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">Nenhum recebimento neste período.</p>
      ) : (
        <>
          <PaymentPie methods={methods} />
          <MethodAmounts methods={methods} />
        </>
      )}
    </section>
  );
}
function PaymentPie({ methods }: { methods: Method[] }): ReactElement {
  return (
    <div
      className="my-3"
      role="img"
      aria-label="Distribuição dos recebimentos por meio de pagamento; valores exatos na legenda."
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
              <Cell key={row.method} fill={methodColor(index)} />
            ))}
          </Pie>
          <Tooltip content={<AmountTooltip />} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
function methodColor(index: number): string {
  return COLORS.at(index % COLORS.length) ?? "var(--info)";
}
function MethodAmounts({ methods }: { methods: Method[] }): ReactElement {
  return (
    <dl className="grid gap-3">
      {methods.map((row, index) => (
        <div key={row.method} className="flex flex-wrap items-center justify-between gap-2">
          <dt className="inline-flex items-center gap-2 text-sm">
            <svg width={10} height={10} aria-hidden="true">
              <circle cx={5} cy={5} r={4} fill={methodColor(index)} />
            </svg>
            {row.label}
          </dt>
          <dd className="text-right">
            <p className="font-numeric text-sm tabular-nums">
              {formatBRLFromCents(row.receivedCents)}
            </p>
            <p className="text-caption text-muted-foreground">
              {row.count} {row.count === 1 ? "recebimento" : "recebimentos"}
            </p>
          </dd>
        </div>
      ))}
    </dl>
  );
}
function AgingChart({ data }: { data: Analytics }): ReactElement {
  return (
    <section className="min-w-0 border-t border-border pt-4" aria-labelledby="aging-title">
      <h3 id="aging-title" className="font-semibold text-heading">
        Tempo de atraso
      </h3>
      <p className="text-caption text-muted-foreground">Saldo vencido atual · todos os anos</p>
      <div
        className="mt-4"
        role="img"
        aria-label="Saldo vencido por dias de atraso; valores e quantidade de parcelas abaixo."
      >
        <ResponsiveContainer width="100%" height={AGING_HEIGHT} minWidth={0}>
          <BarChart
            data={data.aging}
            layout="vertical"
            margin={{ left: 0, right: 16 }}
            accessibilityLayer
          >
            <CartesianGrid horizontal={false} stroke="var(--border)" />
            <XAxis {...AXIS_PROPS} type="number" tickFormatter={compactMoney} />
            <YAxis {...AXIS_PROPS} type="category" dataKey="label" width={94} />
            <Tooltip content={<AmountTooltip />} cursor={{ fill: "var(--muted)" }} />
            <Bar
              dataKey="balanceCents"
              name="Saldo vencido"
              fill="var(--warning)"
              radius={[0, BAR_CORNER_RADIUS, BAR_CORNER_RADIUS, 0]}
              maxBarSize={20}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <AgingAmounts data={data} />
    </section>
  );
}
function AgingAmounts({ data }: { data: Analytics }): ReactElement {
  return (
    <dl className="mt-4 grid grid-cols-2 gap-4">
      {data.aging.map((row) => (
        <div key={row.label}>
          <dt className="text-caption text-muted-foreground">
            {row.label} · {row.count} {row.count === 1 ? "parcela" : "parcelas"}
          </dt>
          <dd className="mt-1 font-numeric text-sm tabular-nums">
            {formatBRLFromCents(row.balanceCents)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
function AmountTooltip({
  active,
  payload,
}: {
  active?: boolean | undefined;
  payload?:
    | readonly { value?: number | string; name?: string; payload?: { label?: string } }[]
    | undefined;
}): ReactElement | null {
  const row = payload?.[0];
  if (!active || !row || row.value === undefined) return null;
  return (
    <div className="grid gap-2 rounded-sm border border-border bg-popover p-3 text-caption text-popover-foreground shadow-md">
      <p>{row.payload?.label ?? row.name}</p>
      <p className="font-numeric tabular-nums">{formatBRLFromCents(Number(row.value))}</p>
    </div>
  );
}
