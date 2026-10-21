import { useState, type ReactElement } from "react";
import { ChevronLeft, ChevronRight, ListChecks } from "lucide-react";
import { Button, Checkbox, InlineSkeleton, Input } from "@lazuli/ui";
import type { MakeupCoverageInput } from "@lazuli/validators";
import { TextControl } from "~/features/classes/form-controls";
import { formatDateOnlyBR } from "~/lib/format";
import type { Absence } from "./shared";
const PAGE_SIZE = 2;
type CoverageProps = {
  sources: Absence[];
  value: MakeupCoverageInput[];
  onChange: (value: MakeupCoverageInput[]) => void;
  error?: string | undefined;
  loading?: boolean;
  compact?: boolean;
};
type Selection = CoverageProps & { selected: Map<string, number> };
export function CoverageFields(props: CoverageProps): ReactElement {
  const { loading, compact, error, value } = props;
  const selected = new Map(value.map((row) => [row.attendanceId, row.minutes]));
  const available = props.sources.filter((row) => row.available > 0 || selected.has(row.id));
  const [page, setPage] = useState(0);
  const current = Math.min(page, Math.max(0, Math.ceil(available.length / PAGE_SIZE) - 1));
  const visible = compact
    ? available.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE)
    : available;
  return (
    <fieldset
      className="grid min-w-0 gap-3"
      aria-busy={loading || undefined}
      aria-invalid={Boolean(error) || undefined}
      aria-describedby={error ? "coverage-error" : undefined}
    >
      <CoverageHeading />
      <div
        className={
          compact
            ? "grid min-h-32 content-start divide-y divide-border rounded-md border border-border"
            : "grid max-h-64 divide-y divide-border overflow-y-auto rounded-md border border-border"
        }
      >
        <CoverageRows props={{ ...props, selected }} visible={visible} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-caption">
        {compact && available.length > PAGE_SIZE && (
          <CoveragePagination current={current} total={available.length} onPage={setPage} />
        )}
        <span className="text-muted-foreground">Total selecionado</span>
        <strong className="font-numeric tabular-nums">
          {value.reduce((sum, row) => sum + row.minutes, 0)} min
        </strong>
      </div>
      {error && (
        <p id="coverage-error" role="alert" className="text-caption text-destructive">
          {error}
        </p>
      )}
    </fieldset>
  );
}
function CoverageHeading(): ReactElement {
  return (
    <>
      <legend className="mb-2 text-sm font-semibold">
        <span className="inline-flex items-center gap-2">
          <ListChecks className="size-4" aria-hidden="true" /> Faltas de origem
        </span>
      </legend>
      <p className="text-caption text-muted-foreground">
        Selecione a falta e os minutos que este atendimento vai repor. O saldo considera outras
        reposições agendadas.
      </p>
    </>
  );
}
function CoverageRows({ props, visible }: { props: Selection; visible: Absence[] }): ReactElement {
  if (props.loading) return <CoverageLoading compact={Boolean(props.compact)} />;
  return (
    <>
      {visible.map((source) => (
        <CoverageSource key={source.id} source={source} form={props} />
      ))}
      {visible.length === 0 && (
        <p className="p-4 text-sm text-muted-foreground">Nenhuma falta com saldo disponível.</p>
      )}
    </>
  );
}
function CoverageLoading({ compact }: { compact: boolean }): ReactElement {
  if (compact)
    return (
      <div role="status" aria-label="Carregando faltas de origem" className="grid gap-4 p-3">
        {[0, 1].map((row) => (
          <div key={row} className="flex items-center gap-3" aria-hidden="true">
            <InlineSkeleton className="h-4 w-4" />
            <div className="grid flex-1 gap-2">
              <InlineSkeleton className="h-4 w-1/2" />
              <InlineSkeleton className="w-1/3" />
            </div>
            <InlineSkeleton className="h-8 w-20" />
          </div>
        ))}
      </div>
    );
  return (
    <div role="status" aria-label="Carregando faltas de origem" className="grid gap-2 p-3">
      <div className="flex items-start gap-2" aria-hidden="true">
        <InlineSkeleton className="h-4 w-4" />
        <div className="grid min-w-0 flex-1 gap-2">
          <InlineSkeleton className="h-4 w-3/4" />
          <InlineSkeleton className="w-2/3" />
        </div>
      </div>
      <div className="pl-6" aria-hidden="true">
        <InlineSkeleton className="w-1/2" />
      </div>
    </div>
  );
}
function CoverageSource({ source, form }: { source: Absence; form: Selection }): ReactElement {
  return (
    <div className="grid gap-2 p-3">
      <div className="flex items-start justify-between gap-3">
        <label className="flex min-w-0 items-start gap-2 text-sm">
          <Checkbox
            aria-label={`Repor falta de ${formatDateOnlyBR(source.date)}`}
            checked={form.selected.has(source.id)}
            onCheckedChange={(checked) =>
              form.onChange(
                checked
                  ? [...form.value, { attendanceId: source.id, minutes: source.available }]
                  : form.value.filter((row) => row.attendanceId !== source.id),
              )
            }
          />
          <span>
            <span className="font-medium">
              {formatDateOnlyBR(source.date)} · {source.className}
            </span>
            <span className="mt-1 block text-caption text-muted-foreground">
              {source.available} min disponíveis · {source.duration} min de falta
            </span>
          </span>
        </label>
        {form.selected.has(source.id) && <CoverageMinutes source={source} form={form} />}
      </div>
      <CoverageContent source={source} compact={Boolean(form.compact)} />
    </div>
  );
}
function CoverageMinutes({ source, form }: { source: Absence; form: Selection }): ReactElement {
  const value = String(form.selected.get(source.id) ?? "");
  function change(next: string): void {
    form.onChange(
      form.value.map((row) =>
        row.attendanceId === source.id
          ? { ...row, minutes: Number(next.replaceAll(/\D/g, "")) }
          : row,
      ),
    );
  }
  if (form.compact)
    return (
      <div className="flex w-24 shrink-0 items-center gap-2">
        <Input
          size="compact-responsive"
          name={`coverage-${source.id}`}
          id={`coverage-${source.id}`}
          placeholder="45"
          autoComplete="off"
          aria-label={`Minutos para repor em ${formatDateOnlyBR(source.date)}`}
          inputMode="numeric"
          value={value}
          invalid={Boolean(form.error)}
          onChange={(event) => change(event.target.value)}
        />
        <span className="text-caption text-muted-foreground">min</span>
      </div>
    );
  return (
    <div className="w-24 shrink-0">
      <TextControl
        name={`coverage-${source.id}`}
        label="Minutos"
        placeholder="45"
        inputMode="numeric"
        invalid={Boolean(form.error)}
        value={value}
        onChange={change}
      />
    </div>
  );
}
function CoverageContent({
  source,
  compact,
}: {
  source: Absence;
  compact: boolean;
}): ReactElement | null {
  if (source.content)
    return (
      <details className="pl-6 text-caption">
        <summary className="cursor-pointer text-interactive">Conteúdo registrado na aula</summary>
        <p className="mt-2 whitespace-pre-wrap text-muted-foreground">
          {source.content.account}
          {source.content.reference ? ` · ${source.content.reference}` : ""}
          {sourcePages(source.content)}
        </p>
      </details>
    );
  if (compact) return null;
  return (
    <p className="pl-6 text-caption text-muted-foreground">
      Conteúdo realizado não registrado nesta aula.
    </p>
  );
}
function sourcePages(content: NonNullable<Absence["content"]>): string {
  if (content.pageFrom === null) return "";
  return ` · pág. ${content.pageFrom}${content.pageTo ? `–${content.pageTo}` : ""}`;
}
function CoveragePagination({
  current,
  total,
  onPage,
}: {
  current: number;
  total: number;
  onPage: (page: number) => void;
}): ReactElement {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">
        {current * PAGE_SIZE + 1}–{Math.min(current * PAGE_SIZE + PAGE_SIZE, total)} de {total}{" "}
        faltas
      </span>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label="Faltas anteriores"
        disabled={current === 0}
        onClick={() => onPage(current - 1)}
      >
        <ChevronLeft />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label="Mais faltas"
        disabled={current * PAGE_SIZE + PAGE_SIZE >= total}
        onClick={() => onPage(current + 1)}
      >
        <ChevronRight />
      </Button>
    </div>
  );
}
