"use client";
import { useState, type ReactElement } from "react";
import Link from "next/link";
import {
  Button,
  DataTable,
  SegmentedControl,
  SegmentedControlItem,
  type DataTableColumn,
} from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { formatAttendancePercent, formatBRLFromCents, formatDateOnlyBR } from "~/lib/format";
import { monthLabel } from "./contract-closings-model";
import { RevenueChart, type Analytics, type CashMonth } from "./revenue-chart";

const MONTH_KEY_LENGTH = 7;
const YEAR_LENGTH = 4;
const columns: DataTableColumn<CashMonth & { id: string; asOf: string }>[] = [
  {
    id: "month",
    header: "Mês",
    cell: (row) => (
      <span className="capitalize">
        {monthLabel(row.month)} / {row.month.slice(0, YEAR_LENGTH)}
      </span>
    ),
  },
  {
    id: "expected",
    header: "Cobranças",
    numeric: true,
    cell: (row) => formatBRLFromCents(row.expectedCents),
  },
  {
    id: "received",
    header: "Recebido",
    numeric: true,
    cell: (row) =>
      row.month > row.asOf.slice(0, MONTH_KEY_LENGTH) ? "—" : formatBRLFromCents(row.receivedCents),
  },
  {
    id: "balance",
    header: "Saldo atual das cobranças",
    numeric: true,
    cell: (row) => formatBRLFromCents(row.balanceCents),
  },
];

export function CashPanel({ year }: { year: number }): ReactElement {
  const query = trpc.finance.analytics.useQuery({ year });
  return (
    <section
      className="min-w-0 space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5"
      aria-labelledby="cash-title"
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="cash-title" className="text-lg font-semibold text-heading">
            Cobranças e recebimentos
          </h2>
          <p className="text-caption text-muted-foreground">
            Pelo vencimento e pela data do pagamento · {year}.
          </p>
        </div>
        <Button variant="secondary" nativeButton={false} render={<Link href="/recebiveis" />}>
          Recebíveis
        </Button>
      </header>
      {query.isPending && <p role="status">Carregando valores de {year}…</p>}
      {query.isError && (
        <div role="alert">
          <p>Não foi possível carregar os valores financeiros.</p>
          <Button variant="secondary" onClick={() => void query.refetch()}>
            Tentar novamente
          </Button>
        </div>
      )}
      {query.data && !query.isError && <CashContent data={query.data} />}
    </section>
  );
}

function CashContent({ data }: { data: Analytics }): ReactElement {
  const [view, setView] = useState("chart");
  return (
    <>
      <CashMetrics data={data} />
      <p className="text-caption text-muted-foreground">
        Posição em {formatDateOnlyBR(data.asOf)}
        {data.asOf.startsWith(`${data.year}-`) ? " · mês atual em andamento" : ""}.
      </p>
      <SegmentedControl
        aria-label="Visualização de cobranças e recebimentos"
        size="sm"
        value={view}
        onValueChange={(value) => {
          if (value) setView(value);
        }}
      >
        <SegmentedControlItem value="chart">Gráfico</SegmentedControlItem>
        <SegmentedControlItem value="table">Tabela</SegmentedControlItem>
      </SegmentedControl>
      <CashVisualization data={data} view={view} />
      <p className="text-caption text-muted-foreground">
        Cobranças consideram ajustes e excluem pedidos cancelados e parcelas isentas. Recebimentos
        incluem pagamentos registrados até esta data, inclusive valores ainda não alocados. Saldo
        não é lucro: os indicadores não incluem despesas.
      </p>
    </>
  );
}

function CashMetrics({ data }: { data: Analytics }): ReactElement {
  const collection = data.maturedCents > 0 ? data.settledMaturedCents / data.maturedCents : null;
  return (
    <dl className="grid gap-5 border-y border-border py-4 sm:grid-cols-2 xl:grid-cols-4">
      <Metric
        label={`Recebido em ${data.year}`}
        value={formatBRLFromCents(data.receivedCents)}
        detail="Caixa registrado até hoje"
      />
      <Metric
        label={`Cobranças de ${data.year}`}
        value={formatBRLFromCents(data.expectedCents)}
        detail="Pelo vencimento · inclui meses futuros"
      />
      <Metric
        label="Saldo vencido hoje"
        value={formatBRLFromCents(data.overdueCents)}
        detail={`${data.overduePayers} pagadores · todos os anos`}
      />
      <Metric
        label="Liquidação até hoje"
        value={formatAttendancePercent(collection)}
        detail={`Parcelas de ${data.year} vencidas ou vencendo hoje`}
      />
    </dl>
  );
}
function CashVisualization({ data, view }: { data: Analytics; view: string }): ReactElement {
  if (view === "table")
    return (
      <DataTable
        label="Detalhamento financeiro mensal"
        columns={columns}
        state={{
          kind: "data",
          rows: data.months.map((month) => ({ ...month, id: month.month, asOf: data.asOf })),
        }}
        empty={{
          title: "Sem valores",
          description: "As movimentações do período aparecerão aqui.",
        }}
        errorTitle="Não foi possível carregar os valores"
        onRetry={() => {}}
      />
    );
  if (data.months.every((month) => month.expectedCents === 0 && month.receivedCents === 0))
    return (
      <p className="py-12 text-center text-muted-foreground">
        Nenhuma cobrança ou recebimento neste período.
      </p>
    );
  return <RevenueChart data={data} />;
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}): ReactElement {
  return (
    <div>
      <dt className="text-caption text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-numeric text-2xl font-semibold tabular-nums text-heading">
        {value}
      </dd>
      <dd className="mt-1 text-caption text-muted-foreground">{detail}</dd>
    </div>
  );
}
