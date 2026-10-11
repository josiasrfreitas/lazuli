import { useState, type ReactElement } from "react";
import { SlidersHorizontal } from "lucide-react";
import {
  Button,
  Checkbox,
  DataTable,
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
  SegmentedControl,
  SegmentedControlItem,
  type DataTableColumn,
} from "@lazuli/ui";
import { ChartLegend, monthLabel, type Analytics } from "./chart-shared";
import { ContractClosingsChart } from "./contract-closings-chart";
import {
  closingMeasures,
  closingValue,
  closingSummary,
  type ClosingMeasure,
  type ClosingMonth,
} from "./contract-closings-model";
import { formatBRLFromCents, formatDateOnlyBR } from "~/lib/format";

type ClosingLabelsProps = { labels: ClosingMeasure[]; onLabels: (value: ClosingMeasure[]) => void };
type ClosingControlsProps = ClosingLabelsProps & { view: string; onView: (value: string) => void };

function ClosingMetric({
  label,
  value,
  suffix,
  primary = false,
}: {
  label: string;
  value: string;
  suffix?: string;
  primary?: boolean;
}): ReactElement {
  return (
    <div className={primary ? "col-span-2 sm:col-span-1" : undefined}>
      <dt className="text-caption text-muted-foreground">{label}</dt>
      <dd
        className={`mt-2 font-numeric font-semibold tabular-nums ${primary ? "text-3xl text-info" : "text-xl text-heading sm:text-2xl"}`}
      >
        {value}
        {suffix && (
          <span className="block text-caption font-normal text-muted-foreground sm:inline">
            {suffix}
          </span>
        )}
      </dd>
    </div>
  );
}

function ClosingSummary({ data }: { data: Analytics }): ReactElement {
  const { totals, period } = closingSummary(data);
  return (
    <dl className="mt-6 grid grid-cols-2 gap-5 border-y border-border py-5 sm:grid-cols-3">
      <ClosingMetric
        label={`Receita projetada · fechados ${period}`}
        value={formatBRLFromCents(totals.projectedCents)}
        primary
      />
      <ClosingMetric
        label="Mensalidade equivalente"
        value={formatBRLFromCents(totals.monthlyEquivalentCents)}
        suffix="/mês"
      />
      <ClosingMetric label={`Contratos fechados ${period}`} value={String(totals.count)} />
    </dl>
  );
}

function ClosingLabelOptions({ labels, onLabels }: ClosingLabelsProps): ReactElement {
  const toggle = (measure: ClosingMeasure, checked: boolean): void => {
    onLabels(
      checked
        ? closingMeasures
            .filter((option) => option.id === measure || labels.includes(option.id))
            .map((option) => option.id)
        : labels.filter((id) => id !== measure),
    );
  };
  return (
    <div className="mt-3 grid gap-1">
      {closingMeasures.map((measure) => (
        <label key={measure.id} className="flex min-h-11 cursor-pointer items-center gap-2">
          <Checkbox
            checked={labels.includes(measure.id)}
            onCheckedChange={(checked) => toggle(measure.id, checked)}
          />
          {measure.label}
        </label>
      ))}
    </div>
  );
}

function ClosingControls({ view, onView, labels, onLabels }: ClosingControlsProps): ReactElement {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {view === "chart" && (
        <Popover>
          <PopoverTrigger
            render={
              <Button
                variant="secondary"
                size="compact-responsive"
                aria-label="Valores nas barras"
              />
            }
          >
            <SlidersHorizontal />
            <span className="sm:hidden">Valores</span>
            <span className="hidden sm:inline">Valores nas barras</span>
          </PopoverTrigger>
          <PopoverContent align="end">
            <PopoverTitle>Mostrar em cada mês</PopoverTitle>
            <ClosingLabelOptions labels={labels} onLabels={onLabels} />
          </PopoverContent>
        </Popover>
      )}
      <SegmentedControl
        aria-label="Visualização dos contratos fechados"
        size="sm"
        value={view}
        onValueChange={onView}
      >
        <SegmentedControlItem value="chart">Gráfico</SegmentedControlItem>
        <SegmentedControlItem value="table">Tabela</SegmentedControlItem>
      </SegmentedControl>
    </div>
  );
}

const columns: DataTableColumn<ClosingMonth & { id: string }>[] = [
  {
    id: "month",
    header: "Mês de fechamento",
    cell: (row) => (
      <span className="capitalize">
        {monthLabel(row.month)} / {row.month.slice(0, 4)}
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
  rows,
  view,
  labels,
}: {
  rows: ClosingMonth[];
  view: string;
  labels: ClosingMeasure[];
}): ReactElement {
  if (rows.length === 0)
    return (
      <p className="py-12 text-center text-muted-foreground">Este período ainda não começou.</p>
    );
  if (view === "table")
    return (
      <div className="mt-5 h-96">
        <DataTable
          label="Contratos fechados por mês"
          columns={columns}
          state={{
            kind: "data",
            rows: [...rows].reverse().map((row) => ({ ...row, id: row.month })),
          }}
          empty={{ title: "Sem contratos no período" }}
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
    <>
      <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2">
        <ChartLegend label="Altura total: receita projetada" color="var(--info)" />
        <span className="text-caption text-muted-foreground">
          Faixa destacada: mensalidade equivalente
        </span>
      </div>
      <ContractClosingsChart rows={rows} labels={labels} />
    </>
  );
}

function ClosingBasis({ incompleteCount }: { incompleteCount: number }): ReactElement {
  return (
    <>
      <p className="mt-4 text-caption text-muted-foreground">
        Valor nominal das mensalidades × prazo contratado, sujeito a descontos e cancelamentos.
        Multas não compõem a projeção. Recebimentos aparecem no fluxo de caixa abaixo.
      </p>
      {incompleteCount > 0 && (
        <p className="mt-2 text-caption text-warning">
          {incompleteCount} contratos sem valor ou prazo definidos entram na quantidade, mas ficaram
          fora dos valores projetados.
        </p>
      )}
    </>
  );
}

function ClosingPeriod({ data }: { data: Analytics }): ReactElement {
  const ongoing = data.asOf.startsWith(`${data.year}-`);
  return (
    <p className="mt-1 text-caption text-muted-foreground">
      Projeção pelo prazo completo dos contratos fechados em cada mês de {data.year}.
      {ongoing && ` Até ${formatDateOnlyBR(data.asOf)}; mês atual em andamento.`}
    </p>
  );
}

export function ContractClosings({ data }: { data: Analytics }): ReactElement {
  const [view, setView] = useState("chart");
  const [labels, setLabels] = useState<ClosingMeasure[]>(["projectedCents", "count"]);
  const rows = data.contractClosings.months.filter((month) => month.month <= data.asOf.slice(0, 7));
  return (
    <section
      className="min-w-0 rounded-xl border border-border bg-card p-5 sm:p-6"
      aria-labelledby="contract-closings-title"
    >
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="contract-closings-title" className="text-lg font-semibold text-heading">
            Receita trazida por novos contratos
          </h2>
          <ClosingPeriod data={data} />
        </div>
        <ClosingControls view={view} onView={setView} labels={labels} onLabels={setLabels} />
      </header>
      <ClosingSummary data={data} />
      <ClosingVisualization rows={rows} view={view} labels={labels} />
      <ClosingBasis incompleteCount={data.contractClosings.incompleteCount} />
    </section>
  );
}
