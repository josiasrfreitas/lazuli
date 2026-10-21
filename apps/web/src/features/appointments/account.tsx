import type { ReactElement } from "react";
import type { AppointmentSnapshot } from "@lazuli/validators";
import { formatDateOnlyBR } from "~/lib/format";
export function AppointmentAccount({
  row,
  rescheduled = false,
}: {
  row: AppointmentSnapshot;
  rescheduled?: boolean;
}): ReactElement {
  return (
    <div className="grid gap-5">
      <AccountOutcome row={row} rescheduled={rescheduled} />
      <AccountCoverages row={row} />
      {row.notes && (
        <section className="grid gap-2 border-t border-border pt-4">
          <h2 className="text-sm font-semibold">Observação</h2>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{row.notes}</p>
        </section>
      )}
    </div>
  );
}

function AccountOutcome({
  row,
  rescheduled,
}: {
  row: AppointmentSnapshot;
  rescheduled: boolean;
}): ReactElement {
  if (row.status !== "ATTENDED")
    return (
      <p className="text-sm text-muted-foreground">{outcomeMessage(row.status, rescheduled)}</p>
    );
  const activeMinutes = row.coverages
    .filter((item) => item.applicable)
    .reduce((sum, item) => sum + item.minutes, 0);
  return (
    <section className="grid gap-2">
      <h2 className="text-lg font-semibold">{performedLabel(row.performedMinutes)}</h2>
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
function performedLabel(minutes: number | null): string {
  if (minutes === null) return "Comparecimento registrado";
  return `${minutes} ${minutes === 1 ? "minuto realizado" : "minutos realizados"}`;
}
function outcomeMessage(status: AppointmentSnapshot["status"], rescheduled: boolean): string {
  if (status === "NO_SHOW")
    return "O aluno não compareceu. As faltas continuam disponíveis para reposição.";
  if (status === "CANCELLED")
    return rescheduled
      ? "Atendimento reagendado; o histórico foi preservado."
      : "Agendamento cancelado; o histórico foi preservado.";
  return "O comparecimento será registrado após o término do encontro.";
}
function AccountCoverages({ row }: { row: AppointmentSnapshot }): ReactElement | null {
  if (row.coverages.length === 0) return null;
  return (
    <section className="grid gap-3">
      <h2 className="text-sm font-semibold">Faltas vinculadas</h2>
      <div className="divide-y divide-border rounded-md border border-border">
        {row.coverages.map((source) => (
          <AccountCoverage key={source.attendanceId} source={source} status={row.status} />
        ))}
      </div>
    </section>
  );
}
function AccountCoverage({
  source,
  status,
}: {
  source: AppointmentSnapshot["coverages"][number];
  status: AppointmentSnapshot["status"];
}): ReactElement {
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
        {source.minutes} min {coverageLabel(status, source.applicable)}
      </span>
    </div>
  );
}
function coverageLabel(status: AppointmentSnapshot["status"], applicable: boolean): string {
  if (status === "CANCELLED") return "liberados";
  if (status === "SCHEDULED") return "reservados";
  return applicable ? "compensados" : "sem efeito";
}
