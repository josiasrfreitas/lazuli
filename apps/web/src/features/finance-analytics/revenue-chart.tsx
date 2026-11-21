import { useState, type ReactElement } from "react";
import { SegmentedControl, SegmentedControlItem } from "@lazuli/ui";
import { AnalyticsFilters } from "./analytics-filters";
import { trpc } from "~/lib/trpc";
import { QueryNotice } from "./query-notice";
import styles from "./operations.module.css";
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
import { compactMoney, monthLabel } from "./contract-closings-model";
import type { RouterOutputs } from "@lazuli/api";
const MONTHS_PER_YEAR = 12;
const MONTHS_PER_HALF = 6;

export type Analytics = RouterOutputs["finance"]["analytics"];
export type CashMonth = Analytics["months"][number];

const MONTH_KEY_LENGTH = 7;
const YEAR_LENGTH = 4;
const CHART_HEIGHT = 280;
const CORNER_RADIUS = 3;
const AXIS_PROPS = {
  tick: { fill: "var(--muted-foreground)", fontSize: 12 },
  axisLine: false,
  tickLine: false,
};
function CashTooltip({
  forecast,
  typed,
  active,
  payload,
}: {
  typed: boolean;
  forecast: boolean;
  active?: boolean | undefined;
  payload?:
    | readonly { payload?: Omit<CashMonth, "receivedCents"> & { receivedCents: number | null } }[]
    | undefined;
}): ReactElement | null {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return (
    <div className="grid gap-2 rounded-sm border border-border bg-popover p-3 text-caption text-popover-foreground shadow-md">
      <p className="font-semibold capitalize">
        {monthLabel(row.month)} / {row.month.slice(0, YEAR_LENGTH)}
      </p>
      {forecast ? (
        <p>Saldo a receber: {formatBRLFromCents(row.balanceCents)}</p>
      ) : (
        <>
          {!typed && <p>Cobranças: {formatBRLFromCents(row.expectedCents)}</p>}
          <p>
            Recebido: {row.receivedCents === null ? "—" : formatBRLFromCents(row.receivedCents)}
          </p>
        </>
      )}
    </div>
  );
}

const receiptLabels: Record<string, string> = {
  TUITION: "Mensalidade",
  ENROLLMENT_FEE: "Matrícula",
  MATERIAL: "Material didático",
  OTHER: "Outras vendas",
  UNALLOCATED: "Sem alocação",
};
export function RevenueChart({ data }: { data: Analytics }): ReactElement {
  const [view, setView] = useState("balance");
  const [half, setHalf] = useState("all");
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(MONTHS_PER_YEAR);
  const forecast = view === "balance";
  const [kind, setKind] = useState("");
  const typed = !forecast && Boolean(kind);
  const parts = trpc.dashboard.receiptTypes.useQuery({ year: data.year }, { enabled: typed });
  const received = amountsByMonth(parts.data, kind);
  const months = data.months
    .filter((_unused, index) => withinPeriod(index + 1, { period: half, from, to }))
    .map((month) => ({
      ...month,
      receivedCents: receivedForMonth(month, { asOf: data.asOf, typed, kind, amounts: received }),
    }));
  const heading = cashHeading(forecast, kind);
  return (
    <section className={styles.panel}>
      <header className={styles.header}>
        <div>
          <h2>{heading.title}</h2>
          <p>{heading.description}</p>
        </div>
        <CashFilters
          data={data}
          forecast={forecast}
          kind={kind}
          setKind={setKind}
          half={half}
          setHalf={setHalf}
          from={from}
          to={to}
          setFrom={setFrom}
          setTo={setTo}
        />
      </header>
      <SegmentedControl
        aria-label="Indicador financeiro"
        size="sm"
        value={view}
        onValueChange={(value) => {
          if (value) setView(value);
        }}
      >
        <SegmentedControlItem value="balance">A receber</SegmentedControlItem>
        <SegmentedControlItem value="cash">Fluxo de caixa</SegmentedControlItem>
      </SegmentedControl>
      {!forecast && !typed && <CashLegend />}
      {typed && !parts.data ? (
        <QueryNotice failed={parts.isError} retry={() => void parts.refetch()} />
      ) : (
        <CashPlot months={months} forecast={forecast} typed={typed} year={data.year} />
      )}
      {(!typed || parts.data) && <CashValues months={months} forecast={forecast} typed={typed} />}
    </section>
  );
}

function CashLegend(): ReactElement {
  return (
    <div className="flex flex-wrap gap-5 text-caption text-muted-foreground">
      <span className="inline-flex items-center gap-2">
        <span aria-hidden="true" className="size-2.5 rounded-sm bg-info" />
        Cobranças (barras)
      </span>
      <span className="inline-flex items-center gap-2">
        <span aria-hidden="true" className="h-0.5 w-4 bg-success" />
        Recebido (linha)
      </span>
    </div>
  );
}

function CashValues({
  months,
  forecast,
  typed,
}: {
  months: PlotMonth[];
  forecast: boolean;
  typed: boolean;
}): ReactElement {
  return (
    <details>
      <summary className="w-fit cursor-pointer text-sm text-interactive">
        Ver valores do gráfico
      </summary>
      <div className={styles.scroll}>
        <table>
          <thead>
            <tr>
              <th>Mês</th>
              {!typed && <th>{forecast ? "Saldo a receber" : "Cobranças"}</th>}
              {!forecast && <th>Recebido</th>}
            </tr>
          </thead>
          <tbody>
            {months.map((month) => (
              <tr key={month.month}>
                <th>{monthLabel(month.month)}</th>
                {!typed && (
                  <td>{formatBRLFromCents(forecast ? month.balanceCents : month.expectedCents)}</td>
                )}
                {!forecast && (
                  <td>
                    {month.receivedCents === null ? "—" : formatBRLFromCents(month.receivedCents)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function CashPlot({
  months,
  forecast,
  typed,
  year,
}: {
  months: PlotMonth[];
  forecast: boolean;
  typed: boolean;
  year: number;
}): ReactElement {
  return (
    <div
      className="min-w-0"
      role="img"
      aria-label={`${forecast ? "Saldo a receber" : "Cobranças e recebimentos"} em ${year}. Valores exatos no detalhamento do gráfico.`}
    >
      <ResponsiveContainer width="100%" height={CHART_HEIGHT} minWidth={0}>
        <ComposedChart
          data={months}
          margin={{ top: 16, right: 12, left: 0, bottom: 8 }}
          accessibilityLayer
        >
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis {...AXIS_PROPS} dataKey="month" tickFormatter={monthLabel} />
          <YAxis {...AXIS_PROPS} tickFormatter={compactMoney} width={52} />
          <Tooltip
            content={<CashTooltip forecast={forecast} typed={typed} />}
            cursor={{ fill: "var(--muted)", fillOpacity: 0.5 }}
          />
          {!typed && (
            <Bar
              dataKey={forecast ? "balanceCents" : "expectedCents"}
              name={forecast ? "A receber" : "Cobranças"}
              fill="var(--info)"
              fillOpacity={0.65}
              radius={[CORNER_RADIUS, CORNER_RADIUS, 0, 0]}
              maxBarSize={32}
              isAnimationActive={false}
            />
          )}
          {!forecast && (
            <Line
              dataKey="receivedCents"
              name="Recebido"
              type="monotone"
              stroke="var(--success)"
              strokeWidth={3}
              dot={false}
              isAnimationActive={false}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function CashFilters({
  data,
  forecast,
  kind,
  setKind,
  half,
  setHalf,
  from,
  to,
  setFrom,
  setTo,
}: {
  data: Analytics;
  forecast: boolean;
  kind: string;
  setKind: (value: string) => void;
  half: string;
  setHalf: (value: string) => void;
  from: number;
  to: number;
  setFrom: (value: number) => void;
  setTo: (value: number) => void;
}): ReactElement {
  return (
    <AnalyticsFilters label={`Período · ${periodLabel({ period: half, from, to })}`}>
      <label>
        Meses exibidos
        <select value={half} onChange={(event) => setHalf(event.target.value)}>
          <option value="all">Ano completo</option>
          <option value="custom">Escolher meses</option>
          <option value="first">Janeiro a junho</option>
          <option value="second">Julho a dezembro</option>
        </select>
      </label>
      {half === "custom" && (
        <MonthRange data={data} from={from} to={to} setFrom={setFrom} setTo={setTo} />
      )}
      {!forecast && (
        <label>
          Tipo de recebível
          <select value={kind} onChange={(event) => setKind(event.target.value)}>
            <option value="">Todos os tipos</option>
            {Object.entries(receiptLabels).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
      )}
    </AnalyticsFilters>
  );
}

function MonthRange({
  data,
  from,
  to,
  setFrom,
  setTo,
}: {
  data: Analytics;
  from: number;
  to: number;
  setFrom: (value: number) => void;
  setTo: (value: number) => void;
}): ReactElement {
  return (
    <div className="grid grid-cols-2 gap-2">
      {["De", "Até"].map((label, index) => (
        <label key={label}>
          {label}
          <select
            value={index ? to : from}
            onChange={(event) => {
              const value = Number(event.target.value);
              if (index) {
                setTo(value);
                setFrom(Math.min(from, value));
              } else {
                setFrom(value);
                setTo(Math.max(to, value));
              }
            }}
          >
            {data.months.map((row, index) => (
              <option key={row.month} value={index + 1}>
                {monthLabel(row.month)}
              </option>
            ))}
          </select>
        </label>
      ))}
    </div>
  );
}

type PlotMonth = Omit<CashMonth, "receivedCents"> & { receivedCents: number | null };
type PeriodFilter = { period: string; from: number; to: number };
function withinPeriod(month: number, { period, from, to }: PeriodFilter): boolean {
  if (period === "first") return month <= MONTHS_PER_HALF;
  if (period === "second") return month > MONTHS_PER_HALF;
  return period !== "custom" || (month >= from && month <= to);
}
function periodLabel({ period, from, to }: PeriodFilter): string {
  if (period === "first") return "1º semestre";
  if (period === "second") return "2º semestre";
  return period === "custom" ? `${from}–${to}` : "ano";
}
function receivedForMonth(
  month: CashMonth,
  {
    asOf,
    typed,
    kind,
    amounts,
  }: { asOf: string; typed: boolean; kind: string; amounts: Map<string, number> },
): number | null {
  if (month.month > asOf.slice(0, MONTH_KEY_LENGTH)) return null;
  if (!typed) return month.receivedCents;
  const amount = amounts.get(month.month) ?? 0;
  return kind === "UNALLOCATED" ? month.receivedCents - amount : amount;
}
function cashHeading(forecast: boolean, kind: string): { title: string; description: string } {
  if (forecast)
    return {
      title: "Saldo a receber por mês",
      description: "Saldo em aberto pela data de vencimento.",
    };
  if (kind)
    return {
      title: `Recebido · ${receiptLabels[kind]}`,
      description: "Recebimentos líquidos dos estornos, pela data de pagamento ou devolução.",
    };
  return {
    title: "Cobranças e recebimentos",
    description: "Cobranças pelo vencimento e recebimentos pela data de pagamento.",
  };
}

function amountsByMonth(
  parts: RouterOutputs["dashboard"]["receiptTypes"] | undefined,
  kind: string,
): Map<string, number> {
  const received = new Map<string, number>();
  for (const row of parts ?? []) {
    if (row.kind === kind || kind === "UNALLOCATED")
      received.set(row.month, (received.get(row.month) ?? 0) + row.cents);
  }
  return received;
}
