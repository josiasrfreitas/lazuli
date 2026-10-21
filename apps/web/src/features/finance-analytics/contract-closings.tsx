import { useState, type ReactElement } from "react";
import {
  Button,
  DataTable,
  SegmentedControl,
  SegmentedControlItem,
  type DataTableColumn,
} from "@lazuli/ui";
import { monthLabel, type Analytics } from "./chart-shared";
import { ContractClosingsChart } from "./contract-closings-chart";
import {
  closingMeasures,
  closingValue,
  closingSummary,
  closingRows,
  closingGrowth,
  type ClosingChartMeasure,
  type ClosingMonth,
  type Closings,
} from "./contract-closings-model";
import { trpc } from "~/lib/trpc";
import { formatBRLFromCents, formatDateOnlyBR } from "~/lib/format";

const ISO_YEAR_LENGTH = 4;

const MONTH_KEY_LENGTH = 7;
const growthFormat = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
});

function ClosingSummary({
  data,
  measure,
}: {
  data: Closings;
  measure: ClosingChartMeasure;
}): ReactElement {
  const { totals, period } = closingSummary(data);
  const growth = closingGrowth(data, measure);
  return (
    <dl className="my-5 grid grid-cols-2 gap-5 border-y border-border py-4 sm:grid-cols-3">
      <div>
        <dt className="text-caption text-muted-foreground">Volume contratado {period}</dt>
        <dd className="mt-1 font-numeric text-2xl font-semibold tabular-nums text-heading">
          {formatBRLFromCents(totals.projectedCents)}
        </dd>
      </div>
      <div>
        <dt className="text-caption text-muted-foreground">Contratos fechados</dt>
        <dd className="mt-1 font-numeric text-2xl font-semibold tabular-nums text-heading">
          {totals.count}
        </dd>
      </div>
      <div className="col-span-2 sm:col-span-1">
        <dt className="text-caption text-muted-foreground">
          Variação mensal · {measure === "count" ? "quantidade" : "volume"}
        </dt>
        <dd className="mt-1 font-numeric text-2xl font-semibold tabular-nums text-heading">
          {growth?.rate === null || !growth ? "—" : growthFormat.format(growth.rate)}
        </dd>
        <dd className="mt-1 text-caption text-muted-foreground">
          {growth
            ? `${monthLabel(growth.month)} vs. ${monthLabel(growth.previousMonth)} · ${growth.rate === null ? "sem base no mês anterior" : "meses encerrados"}`
            : "Aguardando dois meses encerrados"}
        </dd>
      </div>
    </dl>
  );
}

const columns: DataTableColumn<ClosingMonth & { id: string }>[] = [
  {
    id: "month",
    header: "Mês de fechamento",
    cell: (row) => (
      <span className="capitalize">
        {monthLabel(row.month)} / {row.month.slice(0, ISO_YEAR_LENGTH)}
      </span>
    ),
  },
  ...closingMeasures.map((measure) => ({
    id: measure.id,
    header: measure.label,
    width: "medium" as const,
    numeric: true,
    cell: (row: ClosingMonth) => (
      <span className="font-numeric tabular-nums">{closingValue(row, measure.id)}</span>
    ),
  })),
];

function ClosingVisualization({
  data,
  view,
  measure,
}: {
  data: Closings;
  view: string;
  measure: ClosingChartMeasure;
}): ReactElement {
  const rows = closingRows(data);
  if (rows.length === 0)
    return (
      <p className="py-12 text-center text-muted-foreground">Este período ainda não começou.</p>
    );
  if (view === "table")
    return (
      <div className="h-80">
        <DataTable
          label="Contratos fechados por mês"
          columns={columns}
          state={{
            kind: "data",
            rows: [...rows].toReversed().map((row) => ({ ...row, id: row.month })),
          }}
          empty={{
            title: "Sem contratos no período",
            description: "Os contratos deste período aparecerão aqui.",
          }}
          errorTitle="Não foi possível carregar os contratos"
          onRetry={() => {}}
        />
      </div>
    );
  if (rows.every((row) => row.count === 0))
    return (
      <p className="py-12 text-center text-muted-foreground">
        Nenhum contrato fechado neste período.
      </p>
    );
  return (
    <ContractClosingsChart
      rows={rows}
      measure={measure}
      currentMonth={data.asOf.slice(0, MONTH_KEY_LENGTH)}
    />
  );
}

function ClosingBasis({ incompleteCount }: { incompleteCount: number }): ReactElement {
  return (
    <details className="mt-4 text-caption text-muted-foreground">
      <summary className="w-fit cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        Como os valores são calculados
        {incompleteCount > 0 ? ` · ${incompleteCount} contratos incompletos` : ""}
      </summary>
      <p className="mt-2 max-w-prose">
        Mensalidade nominal × prazo completo, pelo mês de fechamento, mesmo com pagamento parcelado.
        Inclui renovações; não representa novas inscrições nem dinheiro recebido. Descontos,
        cancelamentos e multas não alteram este volume original.
      </p>
      {incompleteCount > 0 && (
        <p className="mt-2 text-warning">
          {incompleteCount} contratos sem valor ou prazo entram na quantidade, mas ficam fora do
          volume em R$.
        </p>
      )}
    </details>
  );
}

export function ContractClosings({ data }: { data: Analytics }): ReactElement {
  const query = trpc.finance.contractClosings.useQuery({ year: data.year });
  if (query.isError)
    return (
      <div role="alert">
        <p>Não foi possível carregar os fechamentos.</p>
        <Button variant="secondary" onClick={() => void query.refetch()}>
          Tentar novamente
        </Button>
      </div>
    );
  if (!query.data) return <p role="status">Carregando fechamentos…</p>;
  return <ClosingPanel data={query.data} />;
}
function ClosingPanel({ data }: { data: Closings }): ReactElement {
  const [view, setView] = useState("chart");
  const [measure, setMeasure] = useState<ClosingChartMeasure>("projectedCents");
  return (
    <section
      className="min-w-0 rounded-xl border border-border bg-card p-4 sm:p-5"
      aria-labelledby="contract-closings-title"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="contract-closings-title" className="text-lg font-semibold text-heading">
            Volume contratado
          </h2>
          <p className="mt-1 text-caption text-muted-foreground">
            Pelo mês de fechamento · prazo completo de cada contrato.
          </p>
        </div>
        <SegmentedControl
          aria-label="Visualização dos contratos"
          size="sm"
          value={view}
          onValueChange={(value) => {
            if (value) setView(value);
          }}
        >
          <SegmentedControlItem value="chart">Gráfico</SegmentedControlItem>
          <SegmentedControlItem value="table">Tabela</SegmentedControlItem>
        </SegmentedControl>
      </header>
      <ClosingSummary data={data} measure={measure} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          aria-label="Medida dos contratos"
          size="sm"
          value={measure}
          onValueChange={(value) => setMeasure(value === "count" ? "count" : "projectedCents")}
        >
          <SegmentedControlItem value="projectedCents">Volume em R$</SegmentedControlItem>
          <SegmentedControlItem value="count">Quantidade</SegmentedControlItem>
        </SegmentedControl>
        {data.asOf.startsWith(`${data.year}-`) && (
          <p className="text-caption text-muted-foreground">
            Até {formatDateOnlyBR(data.asOf)} · {monthLabel(data.asOf.slice(0, MONTH_KEY_LENGTH))}{" "}
            em andamento
          </p>
        )}
      </div>
      <ClosingVisualization data={data} view={view} measure={measure} />
      <ClosingBasis incompleteCount={data.incompleteCount} />
    </section>
  );
}
