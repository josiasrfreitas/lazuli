import { useState, type ReactElement } from "react";
import type { RouterOutputs } from "@lazuli/api";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button, InlineSkeleton } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { formatBRLFromCents } from "~/lib/format";
import { compactMoney, monthLabel } from "~/features/finance-analytics/contract-closings-model";
import { HomeError } from "./home-parts";
import styles from "./home.module.css";

type Business = RouterOutputs["dashboard"]["business"];
const CHART_HEIGHT = 210;
const RECENT_MONTHS = -6;
const YEAR_LENGTH = 4;
const BAR_RADIUS = 3;
const TICK = { fill: "var(--muted-foreground)", fontSize: 12 };
export function HomeBusiness(): ReactElement {
  const query = trpc.dashboard.business.useQuery(undefined, { refetchInterval: 60_000 });
  return (
    <section className={styles.business} aria-labelledby="home-business-title">
      <div className={styles.sectionHeading}>
        <h2 id="home-business-title">O mês da escola</h2>
        <Link className={styles.textLink} href="/financeiro">
          Visão financeira
          <ArrowUpRight aria-hidden="true" />
        </Link>
      </div>
      {query.isPending && (
        <div role="status" aria-label="Carregando indicadores financeiros">
          <InlineSkeleton className="h-40 w-full" />
        </div>
      )}
      {query.isError && (
        <HomeError retry={() => void query.refetch()}>
          Não foi possível atualizar os indicadores financeiros.
        </HomeError>
      )}
      {query.data && <BusinessContent data={query.data} />}
    </section>
  );
}
function BusinessContent({ data }: { data: Business }): ReactElement {
  return (
    <>
      <p className={styles.description}>
        Movimentação de {monthLabel(data.month)} de {data.month.slice(0, YEAR_LENGTH)} · mês em
        andamento
      </p>
      <div className={styles.businessGrid}>
        <BusinessNumbers data={data} />
        <BusinessChart data={data} />
      </div>
    </>
  );
}
function BusinessNumbers({ data }: { data: Business }): ReactElement {
  return (
    <dl className={styles.businessNumbers}>
      <BusinessNumber
        label="Recebido neste mês"
        value={formatBRLFromCents(data.receivedCents)}
        detail="Pagamentos registrados, inclusive valores ainda não alocados."
      />
      <BusinessNumber
        label="Contratos celebrados"
        value={String(data.newContracts + data.renewals)}
        secondary={`${data.newContracts} novos · ${data.renewals} renovações`}
        detail="Pela data do acordo; cancelamentos posteriores não apagam a contratação."
      />
      <BusinessNumber
        label="Saldo em atraso hoje"
        value={formatBRLFromCents(data.overdueCents)}
        detail={`${data.overduePayers} pagadores · todos os períodos`}
        href="/recebiveis"
      />
    </dl>
  );
}
function BusinessNumber({
  label,
  value,
  secondary,
  detail,
  href,
}: {
  label: string;
  value: string;
  secondary?: string;
  detail: string;
  href?: string;
}): ReactElement {
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        {value}
        {secondary && <span>{secondary}</span>}
      </dd>
      <dd className={styles.metricDetail}>{detail}</dd>
      {href && (
        <dd>
          <Link className={styles.textLink} href={href}>
            Acompanhar recebíveis
            <ArrowUpRight aria-hidden="true" />
          </Link>
        </dd>
      )}
    </div>
  );
}
function BusinessChart({ data }: { data: Business }): ReactElement {
  const [table, setTable] = useState(false);
  return (
    <div className={styles.cash}>
      <div className={styles.chartHeading}>
        <h3>Previsão e recebimentos</h3>
        <Button variant="ghost" size="sm" aria-pressed={table} onClick={() => setTable(!table)}>
          {table ? "Ver gráfico" : "Ver valores"}
        </Button>
      </div>
      <p className={styles.chartLegend}>
        <span>Parcelas por vencimento</span>
        <span>Pagamentos recebidos</span>
      </p>
      {table ? <CashTable data={data} /> : <CashChart data={data} />}
      <p className={styles.chartNote}>
        Previsto considera o vencimento das parcelas; recebido considera a data do pagamento. Não
        são medidas de lucro.
      </p>
    </div>
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
          <CartesianGrid vertical={false} stroke="var(--border-subtle)" />
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
