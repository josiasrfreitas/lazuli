import type { ReactElement } from "react";
import type { AppointmentSnapshot } from "@lazuli/validators";
import { formatDateOnlyBR } from "~/lib/format";

type Props = { row: AppointmentSnapshot; rescheduled?: boolean };
type Coverage = AppointmentSnapshot["coverages"][number];
export function AppointmentAccount({ row, rescheduled = false }: Props): ReactElement {
  return (
    <div className="grid gap-5">
      {row.status === "ATTENDED" ? (
        <PerformedAccount row={row} />
      ) : (
        <p className="text-sm text-muted-foreground">{accountStatus(row.status, rescheduled)}</p>
      )}
      {row.coverages.length > 0 && <CoverageList row={row} />}
      {row.notes && (
        <section className="grid gap-2 border-t border-border pt-4">
          <h2 className="text-sm font-semibold">Observação</h2>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{row.notes}</p>
        </section>
      )}
    </div>
  );
}
function PerformedAccount({ row }: Props): ReactElement {
  const activeMinutes = row.coverages
    .filter((item) => item.applicable)
    .reduce((sum, item) => sum + item.minutes, 0);
  return (
    <section className="grid gap-2">
      <h2 className="text-lg font-semibold">
        {row.performedMinutes === null
          ? "Comparecimento registrado"
          : `${row.performedMinutes} ${row.performedMinutes === 1 ? "minuto realizado" : "minutos realizados"}`}
      </h2>
      <p className="whitespace-pre-wrap text-sm leading-relaxed">
        {row.performedContent ?? "Conteúdo realizado não registrado."}
      </p>
      {row.purpose === "MAKEUP" && (
        <p className="text-caption text-muted-foreground">
          {activeMinutes} {activeMinutes === 1 ? "minuto compensado" : "minutos compensados"} nas
          faltas de origem.
        </p>
      )}
    </section>
  );
}
function accountStatus(status: AppointmentSnapshot["status"], rescheduled: boolean): string {
  if (status === "NO_SHOW")
    return "O aluno não compareceu. As faltas continuam disponíveis para reposição.";
  if (status === "CANCELLED")
    return rescheduled
      ? "Atendimento reagendado; consulte o novo agendamento."
      : "Agendamento cancelado; o histórico foi preservado.";
  return "O comparecimento será registrado após o término do encontro.";
}
function CoverageList({ row }: Props): ReactElement {
  return (
    <section className="grid gap-3">
      <h2 className="text-sm font-semibold">Faltas vinculadas</h2>
      <div className="divide-y divide-border rounded-md border border-border">
        {row.coverages.map((source) => (
          <CoverageRow key={source.attendanceId} row={row} source={source} />
        ))}
      </div>
    </section>
  );
}
function CoverageRow({ row, source }: Props & { source: Coverage }): ReactElement {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 p-3">
      <div>
        <p className="text-sm font-medium">
          {formatDateOnlyBR(source.date)} · {source.sourceClassName}
        </p>
        <p className="text-caption text-muted-foreground">
          {source.startTime}–{source.endTime}
        </p>
        {!source.applicable && (
          <p className="text-caption text-warning">
            A origem mudou; esta cobertura não entra na frequência.
          </p>
        )}
      </div>
      <span className="font-numeric text-sm tabular-nums">
        {source.minutes} min {coverageStatus(row.status, source.applicable)}
      </span>
    </div>
  );
}
function coverageStatus(status: AppointmentSnapshot["status"], applicable: boolean): string {
  if (status === "CANCELLED") return "liberados";
  if (status === "SCHEDULED") return "reservados";
  return applicable ? "compensados" : "sem efeito";
}
