import { Checkbox } from "@lazuli/ui";
import type { MakeupCoverageInput } from "@lazuli/validators";
import { TextControl } from "~/features/classes/form-controls";
import { formatDateOnlyBR } from "~/lib/format";
import type { Absence } from "./shared";

export function CoverageFields({
  sources,
  value,
  onChange,
  error,
}: {
  sources: Absence[];
  value: MakeupCoverageInput[];
  onChange: (value: MakeupCoverageInput[]) => void;
  error?: string;
}) {
  const selected = new Map(value.map((row) => [row.attendanceId, row.minutes]));
  return (
    <fieldset
      className="grid min-w-0 gap-3"
      aria-invalid={Boolean(error) || undefined}
      aria-describedby={error ? "coverage-error" : undefined}
    >
      <legend className="mb-2 text-sm font-semibold">Faltas de origem</legend>
      <p className="text-caption text-muted-foreground">
        Selecione a falta e os minutos que este atendimento vai repor. O saldo considera outras
        reposições agendadas.
      </p>
      <div className="grid max-h-64 divide-y divide-border overflow-y-auto rounded-md border border-border">
        {sources
          .filter((row) => row.available > 0 || selected.has(row.id))
          .map((source) => (
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
                {selected.has(source.id) && (
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
                )}
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
                <p className="pl-6 text-caption text-muted-foreground">
                  Conteúdo realizado não registrado nesta aula.
                </p>
              )}
            </div>
          ))}
        {!sources.some((row) => row.available > 0 || selected.has(row.id)) && (
          <p className="p-4 text-sm text-muted-foreground">Nenhuma falta com saldo disponível.</p>
        )}
      </div>
      <div className="flex justify-between gap-2 text-caption">
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
