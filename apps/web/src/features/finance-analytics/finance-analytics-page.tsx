"use client";
import { useState, type ReactElement } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import { Button, DataTable, PencilLoader, type DataTableColumn } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import {
  formatAttendancePercent,
  formatBRLFromCents,
  formatDateOnlyBR,
  toDateOnlySaoPaulo,
} from "~/lib/format";
import { RevenueChart } from "./revenue-chart";
import { ContractClosings } from "./contract-closings";
import type { Closings } from "./contract-closings-model";
import { AnalyticsDetails } from "./analytics-details";
import { type Analytics, monthLabel } from "./chart-shared";
import { AnalyticsLoading } from "./finance-analytics-loading";
const MONTH_KEY_LENGTH = 7;
const MIN_YEAR = 2000;
const MAX_YEAR = 2100;
export function FinanceAnalyticsPage({
  initial,
  initialClosings,
}: {
  initial?: { data: Analytics; updatedAt: number } | undefined;
  initialClosings?: { data: Closings; updatedAt: number } | undefined;
}): ReactElement {
  const [year, setYear] = useState(
    () => initial?.data.year ?? Number(toDateOnlySaoPaulo(new Date()).split("-")[0]),
  );
  const query = trpc.finance.analytics.useQuery(
    { year },
    {
      ...(initial?.data.year === year
        ? { initialData: initial.data, initialDataUpdatedAt: initial.updatedAt }
        : {}),
      placeholderData: keepPreviousData,
    },
  );
  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl space-y-5 p-4 sm:p-6 lg:p-8">
      <AnalyticsHeader year={year} setYear={setYear} />
      {query.isFetching && !query.isPending && (
        <div className="flex items-center gap-2 text-caption text-muted-foreground">
          <PencilLoader size="sm" label={`Atualizando indicadores de ${year}`} />
          <span>
            {query.isPlaceholderData
              ? `Carregando ${year} · exibindo ${query.data.year}`
              : `Atualizando ${year}`}
          </span>
        </div>
      )}
      {query.isPending && <AnalyticsLoading />}
      {query.isError && (
        <div role="alert" className="space-y-3">
          <p>Não foi possível carregar os indicadores.</p>
          <Button variant="secondary" onClick={() => void query.refetch()}>
            Tentar novamente
          </Button>
        </div>
      )}
      {query.data && (
        <div aria-busy={query.isFetching} className="space-y-5">
          <AnalyticsContent data={query.data} initialClosings={initialClosings} />
        </div>
      )}
    </div>
  );
}
function AnalyticsHeader({
  year,
  setYear,
}: {
  year: number;
  setYear: (year: number) => void;
}): ReactElement {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-heading">Visão financeira</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Contratos, recebimentos e valores em atraso.
        </p>
      </div>
      <YearSelector year={year} setYear={setYear} />
    </header>
  );
}
function YearSelector({
  year,
  setYear,
}: {
  year: number;
  setYear: (year: number) => void;
}): ReactElement {
  const utils = trpc.useUtils();
  const prefetch = (targetYear: number): void => {
    if (targetYear >= MIN_YEAR && targetYear <= MAX_YEAR)
      void utils.finance.analytics.prefetch({ year: targetYear });
  };
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-1">
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Ano anterior"
          disabled={year <= MIN_YEAR}
          onClick={() => setYear(year - 1)}
          onMouseEnter={() => prefetch(year - 1)}
          onFocus={() => prefetch(year - 1)}
        >
          <ChevronLeft />
        </Button>
        <span aria-live="polite" className="font-numeric text-sm font-semibold tabular-nums">
          {year}
        </span>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Próximo ano"
          disabled={year >= MAX_YEAR}
          onClick={() => setYear(year + 1)}
          onMouseEnter={() => prefetch(year + 1)}
          onFocus={() => prefetch(year + 1)}
        >
          <ChevronRight />
        </Button>
      </div>
      <Button variant="secondary" nativeButton={false} render={<Link href="/recebiveis" />}>
        Recebíveis
        <ArrowUpRight aria-hidden="true" />
      </Button>
    </div>
  );
}
function AnalyticsContent({
  data,
  initialClosings,
}: {
  data: Analytics;
  initialClosings: { data: Closings; updatedAt: number } | undefined;
}): ReactElement {
  return (
    <>
      <ContractClosings data={data} initial={initialClosings} />
      <AnalyticsMetrics data={data} />
      <RevenueChart data={data} />
      <MonthlyTable data={data} />
      <AnalyticsDetails data={data} />
      <p className="pb-4 text-caption text-muted-foreground">
        Posição em {formatDateOnlyBR(data.asOf)}. Cobranças consideram ajustes registrados e excluem
        pedidos cancelados e parcelas isentas. Recebimentos incluem pagamentos registrados até esta
        data, inclusive valores ainda não alocados. Os indicadores não incluem despesas.
      </p>
    </>
  );
}
function AnalyticsMetrics({ data }: { data: Analytics }): ReactElement {
  const collection = data.maturedCents > 0 ? data.settledMaturedCents / data.maturedCents : null;
  return (
    <dl className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 xl:grid-cols-4">
      <Metric
        label="Recebido no ano"
        value={formatBRLFromCents(data.receivedCents)}
        detail={`Caixa registrado em ${data.year}`}
        accent
      />
      <Metric
        label="Cobranças do ano"
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
        detail={`Parcelas de ${data.year} já vencidas ou vencendo hoje`}
      />
    </dl>
  );
}
function Metric({
  label,
  value,
  detail,
  accent = false,
}: {
  label: string;
  value: string;
  detail: string;
  accent?: boolean;
}): ReactElement {
  return (
    <div className="grid gap-2 bg-card p-5 sm:p-6">
      <dt className="text-caption text-muted-foreground">{label}</dt>
      <dd
        className={`font-numeric text-3xl font-semibold tracking-tight tabular-nums ${accent ? "text-success" : "text-heading"}`}
      >
        {value}
      </dd>
      <dd className="text-caption text-muted-foreground">{detail}</dd>
    </div>
  );
}
type MonthlyRow = Analytics["months"][number] & { id: string };
function MonthlyTable({ data }: { data: Analytics }): ReactElement {
  const [expanded, setExpanded] = useState(false);
  return (
    <section>
      <Button variant="ghost" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
        Consultar valores mês a mês
      </Button>
      {expanded && (
        <div className="mt-3 h-96">
          <DataTable
            onRetry={() => {}}
            errorTitle="Não foi possível carregar os valores"
            empty={{ title: "Sem valores", description: "Nenhuma movimentação no período." }}
            label="Detalhamento financeiro mensal"
            columns={monthlyColumns(data)}
            state={{
              kind: "data",
              rows: data.months.map((month) => ({ ...month, id: month.month })),
            }}
          />
        </div>
      )}
    </section>
  );
}
function monthlyColumns(data: Analytics): DataTableColumn<MonthlyRow>[] {
  return [
    {
      id: "month",
      header: "Mês",
      cell: (row) => (
        <span className="capitalize">
          {monthLabel(row.month)} / {data.year}
        </span>
      ),
    },
    {
      id: "expected",
      header: "Cobranças",
      numeric: true,
      cell: (row) => (
        <span className="font-numeric tabular-nums">{formatBRLFromCents(row.expectedCents)}</span>
      ),
    },
    {
      id: "received",
      header: "Recebido",
      numeric: true,
      cell: (row) => (
        <span className="font-numeric tabular-nums">
          {row.month > data.asOf.slice(0, MONTH_KEY_LENGTH)
            ? "—"
            : formatBRLFromCents(row.receivedCents)}
        </span>
      ),
    },
    {
      id: "balance",
      header: "Saldo atual das cobranças",
      numeric: true,
      cell: (row) => (
        <span className="font-numeric tabular-nums">{formatBRLFromCents(row.balanceCents)}</span>
      ),
    },
  ];
}
