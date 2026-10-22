import type { JSX as ReactJSX } from "react";
import { Checkbox, InlineSkeleton, Input } from "@lazuli/ui";
import type { MakeupCoverageInput } from "@lazuli/validators";
import { TextControl } from "~/features/classes/form-controls";
import { formatDateOnlyBR } from "~/lib/format";
import type { Absence } from "./shared";

type CoverageProps = {
  value: MakeupCoverageInput[];
  onChange: (value: MakeupCoverageInput[]) => void;
  error: string | undefined;
  compact: boolean;
};

export function CoverageList({
  sources,
  visible,
  value,
  onChange,
  error,
  compact,
  loading,
}: CoverageProps & {
  sources: Absence[];
  visible: Absence[];
  loading: boolean;
}): ReactJSX.Element {
  const selected = new Map(value.map((row) => [row.attendanceId, row.minutes]));
  return (
    <div
      className={
        compact
          ? "grid min-h-32 content-start divide-y divide-border rounded-md border border-border"
          : "grid max-h-64 divide-y divide-border overflow-y-auto rounded-md border border-border"
      }
    >
      {loading && <CoverageLoading compact={compact} />}
      {!loading &&
        visible.map((source) => (
          <CoverageSourceRow
            key={source.id}
            source={source}
            selectedMinutes={selected.get(source.id)}
            value={value}
            onChange={onChange}
            error={error}
            compact={compact}
          />
        ))}
      {!loading && !sources.some((row) => row.available > 0 || selected.has(row.id)) && (
        <p className="p-4 text-sm text-muted-foreground">Nenhuma falta com saldo disponível.</p>
      )}
    </div>
  );
}

function CoverageLoading({ compact }: { compact: boolean }): ReactJSX.Element {
  if (!compact)
    return (
      <div role="status" aria-label="Carregando faltas de origem" className="grid gap-2 p-3">
        <div className="flex items-start gap-2" aria-hidden="true">
          <InlineSkeleton className="h-4 w-4 rounded-sm" />
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
  return (
    <div role="status" aria-label="Carregando faltas de origem" className="grid gap-4 p-3">
      {[0, 1].map((row) => (
        <div key={row} className="flex items-center gap-3" aria-hidden="true">
          <InlineSkeleton className="h-4 w-4 rounded-sm" />
          <div className="grid flex-1 gap-2">
            <InlineSkeleton className="h-4 w-1/2" />
            <InlineSkeleton className="w-1/3" />
          </div>
          <InlineSkeleton className="h-8 w-20 rounded-md" />
        </div>
      ))}
    </div>
  );
}

function CoverageSourceRow({
  source,
  selectedMinutes,
  value,
  onChange,
  error,
  compact,
}: CoverageProps & { source: Absence; selectedMinutes: number | undefined }): ReactJSX.Element {
  return (
    <div className="grid gap-2 p-3">
      <div className="flex items-start justify-between gap-3">
        <label className="flex min-w-0 items-start gap-2 text-sm">
          <Checkbox
            aria-label={`Repor falta de ${formatDateOnlyBR(source.date)}`}
            checked={selectedMinutes !== undefined}
            onCheckedChange={(checked) =>
              onChange(
                checked
                  ? [...value, { attendanceId: source.id, minutes: source.available }]
                  : value.filter((row) => row.attendanceId !== source.id),
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
        {selectedMinutes !== undefined && (
          <CoverageMinutes
            source={source}
            minutes={selectedMinutes}
            value={value}
            onChange={onChange}
            error={error}
            compact={compact}
          />
        )}
      </div>
      <CoverageContent source={source} compact={compact} />
    </div>
  );
}

function CoverageMinutes({
  source,
  minutes,
  value,
  onChange,
  error,
  compact,
}: CoverageProps & { source: Absence; minutes: number }): ReactJSX.Element {
  const update = (next: string): void =>
    onChange(
      value.map((row) =>
        row.attendanceId === source.id
          ? { ...row, minutes: Number(next.replaceAll(/\D/g, "")) }
          : row,
      ),
    );
  if (!compact)
    return (
      <div className="w-24 shrink-0">
        <TextControl
          name={`coverage-${source.id}`}
          label="Minutos"
          placeholder="45"
          inputMode="numeric"
          invalid={Boolean(error)}
          value={String(minutes)}
          onChange={update}
        />
      </div>
    );
  return (
    <div className="flex w-24 shrink-0 items-center gap-2">
      <Input
        size="compact-responsive"
        name={`coverage-${source.id}`}
        aria-label={`Minutos para repor em ${formatDateOnlyBR(source.date)}`}
        inputMode="numeric"
        value={String(minutes)}
        invalid={Boolean(error)}
        onChange={(event) => update(event.target.value)}
      />
      <span className="text-caption text-muted-foreground">min</span>
    </div>
  );
}

function CoverageContent({
  source,
  compact,
}: {
  source: Absence;
  compact: boolean;
}): ReactJSX.Element | null {
  if (!source.content)
    return compact ? null : (
      <p className="pl-6 text-caption text-muted-foreground">
        Conteúdo realizado não registrado nesta aula.
      </p>
    );
  return (
    <details className="pl-6 text-caption">
      <summary className="cursor-pointer text-interactive">Conteúdo registrado na aula</summary>
      <p className="mt-2 whitespace-pre-wrap text-muted-foreground">
        {source.content.account}
        {source.content.reference ? ` · ${source.content.reference}` : ""}
        {source.content.pageFrom === null
          ? ""
          : ` · pág. ${source.content.pageFrom}${source.content.pageTo ? `–${source.content.pageTo}` : ""}`}
      </p>
    </details>
  );
}
