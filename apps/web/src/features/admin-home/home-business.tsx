import { useState, type ReactElement } from "react";
import type { RouterOutputs } from "@lazuli/api";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@lazuli/ui";
import { formatBRLFromCents } from "~/lib/format";
import { compactMoney, monthLabel } from "~/features/finance-analytics/contract-closings-model";
import styles from "./home.module.css";

type Business = RouterOutputs["dashboard"]["business"];
const CHART_HEIGHT = 220;
const RECENT_MONTHS = -6;
const BAR_RADIUS = 3;
const TICK = { fill: "var(--muted-foreground)", fontSize: 12 };
export function BusinessChart({ data }: { data: Business }): ReactElement {
  const [table, setTable] = useState(false);
  return (
    <section className={styles.chartPanel} aria-label="Evolução financeira">
      <div className={styles.chartHeading}>
        <div><h2>Como o caixa está evoluindo</h2><p className={styles.description}>Previsão e recebimentos · {data.months.length} meses</p></div>
        <Button variant="ghost" size="sm" aria-pressed={table} onClick={() => setTable(!table)}>
          {table ? "Ver gráfico" : "Ver valores"}
        </Button>
      </div>
      <p className={styles.chartLegend}>
        <span>Parcelas por vencimento</span>
        <span>Pagamentos recebidos</span>
      </p>
      {table ? <CashTable data={data} /> : <CashChart data={data} />}
      <div className={styles.chartFooter}><p className={styles.chartNote}>Previsto por vencimento · recebido por pagamento.<br />{data.partial ? "Mês atual em andamento. " : ""}Estes valores não representam lucro.</p><Link className={styles.textLink} href="/financeiro">Explorar financeiro <ArrowUpRight aria-hidden="true" /></Link></div>
    </section>
  );
}
function CashTable({ data }: { data: Business }): ReactElement {
  return (
    <table className={styles.values}>
      <caption className="sr-only">Valores mensais em reais</caption>
      <thead>
        <tr>
          <th>Mês</th>
          <th>Previsto</th>
          <th>Recebido</th>
        </tr>
      </thead>
      <tbody>
        {data.months.slice(RECENT_MONTHS).map((month) => (
          <tr key={month.month}>
            <th scope="row">{monthLabel(month.month)}</th>
            <td>{formatBRLFromCents(month.expectedCents)}</td>
            <td>{formatBRLFromCents(month.receivedCents)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
function CashChart({ data }: { data: Business }): ReactElement {
  return (
    <div
      role="img"
      aria-label="Comparação mensal de parcelas previstas e pagamentos recebidos. Valores disponíveis em Ver valores."
    >
      <ResponsiveContainer width="100%" height={CHART_HEIGHT} minWidth={0}>
        <BarChart
          data={data.months.slice(RECENT_MONTHS)}
          accessibilityLayer
          margin={{ top: 12, right: 0, left: 0, bottom: 0 }}
        >
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 5" />
          <XAxis
            dataKey="month"
            tickFormatter={monthLabel}
            tick={TICK}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tickFormatter={compactMoney}
            tick={TICK}
            tickLine={false}
            axisLine={false}
            width={48}
          />
          <Tooltip content={<CashTooltip />} cursor={false} />
          <Bar
            dataKey="expectedCents"
            name="Previsto"
            fill="var(--border-strong)"
            radius={[BAR_RADIUS, BAR_RADIUS, 0, 0]}
            maxBarSize={22}
            isAnimationActive={false}
          />
          <Bar
            dataKey="receivedCents"
            name="Recebido"
            fill="var(--interactive)"
            radius={[BAR_RADIUS, BAR_RADIUS, 0, 0]}
            maxBarSize={22}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
function CashTooltip({
  active,
  payload,
}: {
  active?: boolean | undefined;
  payload?:
    | readonly { payload?: { month: string; expectedCents: number; receivedCents: number } }[]
    | undefined;
}): ReactElement | null {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return (
    <div className={styles.tooltip}>
      <strong>{monthLabel(row.month)}</strong>
      <p>Previsto: {formatBRLFromCents(row.expectedCents)}</p>
      <p>Recebido: {formatBRLFromCents(row.receivedCents)}</p>
    </div>
  );
}
