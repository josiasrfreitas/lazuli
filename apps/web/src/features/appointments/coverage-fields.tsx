import { useState } from "react";
import { ChevronLeft, ChevronRight, ListChecks } from "lucide-react";
import { Button, Checkbox, InlineSkeleton, Input } from "@lazuli/ui";
import type { MakeupCoverageInput } from "@lazuli/validators";
import { TextControl } from "~/features/classes/form-controls";
import { formatDateOnlyBR } from "~/lib/format";
import type { Absence } from "./shared";

export function CoverageFields({
  sources,
  value,
  onChange,
  error,
  loading = false,
  compact = false,
}: {
  sources: Absence[];
  value: MakeupCoverageInput[];
  onChange: (value: MakeupCoverageInput[]) => void;
  error?: string | undefined;
  loading?: boolean;
  compact?: boolean;
}) {
  const selected = new Map(value.map((row) => [row.attendanceId, row.minutes]));
  const [page, setPage] = useState(0);
  const available = sources.filter((row) => row.available > 0 || selected.has(row.id));
  const currentPage = Math.min(page, Math.max(0, Math.ceil(available.length / 2) - 1));
  const visible = compact ? available.slice(currentPage * 2, currentPage * 2 + 2) : available;
  return (
    <fieldset
      className="grid min-w-0 gap-3"
      aria-busy={loading || undefined}
      aria-invalid={Boolean(error) || undefined}
      aria-describedby={error ? "coverage-error" : undefined}
    >
      <legend className="mb-2 text-sm font-semibold">
        <span className="inline-flex items-center gap-2">
          <ListChecks className="size-4" aria-hidden="true" />
          Faltas de origem
        </span>
      </legend>
      <p className="text-caption text-muted-foreground">
        Selecione a falta e os minutos que este atendimento vai repor. O saldo considera outras
        reposições agendadas.
      </p>
      <div
        className={
          compact
            ? "grid min-h-32 content-start divide-y divide-border rounded-md border border-border"
            : "grid max-h-64 divide-y divide-border overflow-y-auto rounded-md border border-border"
        }
      >
        {loading && compact && (
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
        )}
        {loading && !compact && (
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
        )}
        {!loading &&
          visible.map((source) => (
            <div key={source.id} className="grid gap-2 p-3">
              <div className="flex items-start justify-between gap-3">
                <label className="flex min-w-0 items-start gap-2 text-sm">
                  <Checkbox
                    aria-label={`Repor falta de ${formatDateOnlyBR(source.date)}`}
                    checked={selected.has(source.id)}
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
                {selected.has(source.id) &&
                  (compact ? (
                    <div className="flex w-24 shrink-0 items-center gap-2">
                      <Input
                        size="compact-responsive"
                        name={`coverage-${source.id}`}
                        aria-label={`Minutos para repor em ${formatDateOnlyBR(source.date)}`}
                        inputMode="numeric"
                        value={String(selected.get(source.id) ?? "")}
                        invalid={Boolean(error)}
                        onChange={(event) =>
                          onChange(
                            value.map((row) =>
                              row.attendanceId === source.id
                                ? { ...row, minutes: Number(event.target.value.replace(/\D/g, "")) }
                                : row,
                            ),
                          )
                        }
                      />
                      <span className="text-caption text-muted-foreground">min</span>
                    </div>
                  ) : (
                    <div className="w-24 shrink-0">
                      <TextControl
                        name={`coverage-${source.id}`}
                        label="Minutos"
                        placeholder="45"
                        inputMode="numeric"
                        invalid={Boolean(error)}
                        value={String(selected.get(source.id) ?? "")}
                        onChange={(next) =>
                          onChange(
                            value.map((row) =>
                              row.attendanceId === source.id
                                ? { ...row, minutes: Number(next.replace(/\D/g, "")) }
                                : row,
                            ),
                          )
                        }
                      />
                    </div>
                  ))}
              </div>
              {source.content ? (
                <details className="pl-6 text-caption">
                  <summary className="cursor-pointer text-interactive">
                    Conteúdo registrado na aula
                  </summary>
                  <p className="mt-2 whitespace-pre-wrap text-muted-foreground">
                    {source.content.account}
                    {source.content.reference ? ` · ${source.content.reference}` : ""}
                    {source.content.pageFrom !== null
                      ? ` · pág. ${source.content.pageFrom}${source.content.pageTo ? `–${source.content.pageTo}` : ""}`
                      : ""}
                  </p>
                </details>
              ) : (
                !compact && (
                  <p className="pl-6 text-caption text-muted-foreground">
                    Conteúdo realizado não registrado nesta aula.
                  </p>
                )
              )}
            </div>
          ))}
        {!loading && !sources.some((row) => row.available > 0 || selected.has(row.id)) && (
          <p className="p-4 text-sm text-muted-foreground">Nenhuma falta com saldo disponível.</p>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-caption">
        {compact && available.length > 2 && (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">
              {currentPage * 2 + 1}–{Math.min(currentPage * 2 + 2, available.length)} de{" "}
              {available.length} faltas
            </span>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label="Faltas anteriores"
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
            >
              <ChevronLeft />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label="Mais faltas"
              disabled={currentPage * 2 + 2 >= available.length}
              onClick={() => setPage(currentPage + 1)}
            >
              <ChevronRight />
            </Button>
          </div>
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
