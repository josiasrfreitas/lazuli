"use client";
import { useState, type ReactElement } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Button,
  DataTable,
  SegmentedControl,
  SegmentedControlItem,
  type DataTableColumn,
} from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { formatDateOnlyBR, toDateOnlySaoPaulo } from "~/lib/format";
import { ContractClosingsChart } from "./contract-closings-chart";
import {
  closingMeasures,
  closingRows,
  closingSummary,
  closingGrowth,
  closingValue,
  monthLabel,
  type ClosingChartMeasure,
  type ClosingMonth,
  type Closings,
} from "./contract-closings-model";

const YEAR_LENGTH = 4;
const MONTH_KEY_LENGTH = 7;
const growthFormat = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
});
const MIN_YEAR = 2000;
const MAX_YEAR = 2100;
const columns: DataTableColumn<ClosingMonth & { id: string }>[] = [
  {
    id: "month",
    header: "Mês de fechamento",
    cell: (row) => (
      <span className="capitalize">
        {monthLabel(row.month)} / {row.month.slice(0, YEAR_LENGTH)}
      </span>
    ),
  },
  ...closingMeasures.map((measure) => ({
    id: measure.id,
    header: measure.label,
    numeric: true,
    cell: (row: ClosingMonth) => closingValue(row, measure.id),
  })),
];
export function ContractClosingsPage(): ReactElement {
  const [year, setYear] = useState(() => Number(toDateOnlySaoPaulo(new Date()).split("-")[0]));
  const query = trpc.finance.contractClosings.useQuery({ year });
  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl space-y-5 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-heading">Visão financeira</h1>
        <div className="flex items-center gap-3" aria-label="Ano dos fechamentos">
          <Button
            variant="ghost"
            size="icon-md"
            aria-label="Ano anterior"
            disabled={year <= MIN_YEAR}
            onClick={() => setYear(year - 1)}
          >
            <ChevronLeft />
          </Button>
          <span className="font-numeric font-semibold" aria-live="polite">
            {year}
          </span>
          <Button
            variant="ghost"
            size="icon-md"
            aria-label="Próximo ano"
            disabled={year >= MAX_YEAR}
            onClick={() => setYear(year + 1)}
          >
            <ChevronRight />
          </Button>
        </div>
      </header>
      {query.isPending && <p role="status">Carregando fechamentos de {year}…</p>}
      {query.isError && (
        <div role="alert">
          <p>Não foi possível carregar os fechamentos.</p>
          <Button variant="secondary" onClick={() => void query.refetch()}>
            Tentar novamente
          </Button>
        </div>
      )}
      {query.data && !query.isError && <ContractClosings data={query.data} />}
    </div>
  );
}
function ContractClosings({ data }: { data: Closings }): ReactElement {
  const [view, setView] = useState("chart");
  const [measure, setMeasure] = useState<ClosingChartMeasure>("projectedCents");
  return (
    <section
      className="min-w-0 space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5"
      aria-labelledby="closings-title"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="closings-title" className="text-lg font-semibold text-heading">
            Volume contratado
          </h2>
          <p className="text-caption text-muted-foreground">
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
      <p className="text-caption text-muted-foreground">
        Até {formatDateOnlyBR(data.asOf)}
        {data.asOf.startsWith(`${data.year}-`) ? " · mês atual em andamento" : ""}
      </p>
      <SegmentedControl
        aria-label="Medida dos contratos"
        size="sm"
        value={measure}
        onValueChange={(value) => setMeasure(value === "count" ? "count" : "projectedCents")}
      >
        <SegmentedControlItem value="projectedCents">Volume em R$</SegmentedControlItem>
        <SegmentedControlItem value="count">Quantidade</SegmentedControlItem>
      </SegmentedControl>
      <ClosingVisualization data={data} view={view} measure={measure} />
      <ClosingBasis data={data} />
    </section>
  );
}

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
      <DataTable
        label="Contratos fechados por mês"
        columns={columns}
        state={{
          kind: "data",
          rows: rows.toReversed().map((row) => ({ ...row, id: row.month })),
        }}
        empty={{
          title: "Sem contratos no período",
          description: "Os contratos deste período aparecerão aqui.",
        }}
        errorTitle="Não foi possível carregar os contratos"
        onRetry={() => {}}
      />
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
    <dl className="grid grid-cols-2 gap-5 border-y border-border py-4 sm:grid-cols-3">
      <div>
        <dt className="text-caption text-muted-foreground">Volume contratado {period}</dt>
        <dd className="mt-1 font-numeric text-2xl font-semibold tabular-nums text-heading">
          {closingValue(totals, "projectedCents")}
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

function ClosingBasis({ data }: { data: Closings }): ReactElement {
  return (
    <>
      <p className="text-caption text-muted-foreground">
        Mensalidade nominal × prazo completo, pelo mês de fechamento. Inclui renovações; não
        representa novas inscrições nem dinheiro recebido. Descontos, cancelamentos e multas não
        alteram este volume original.
      </p>
      {data.incompleteCount > 0 && (
        <p className="text-caption text-warning">
          {data.incompleteCount} contratos sem valor ou prazo entram na quantidade, mas ficam fora
          da projeção em R$.
        </p>
      )}
    </>
  );
}
