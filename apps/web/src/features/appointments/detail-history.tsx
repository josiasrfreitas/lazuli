import type { ReactElement } from "react";
import { AppointmentAccount } from "./account";
import { appointmentStamp, type Appointment } from "./shared";

const revisionLabels = new Map([
  ["SCHEDULED", "Agendamento"],
  ["IMPORTED", "Registro anterior"],
  ["RESCHEDULED", "Reagendamento"],
  ["CANCELLED", "Cancelamento"],
  ["CORRECTED", "Correção"],
]);
export function AppointmentHistory({ data }: { data: Appointment }): ReactElement {
  return (
    <div className="grid gap-3">
      {data.history.map((revision) => (
        <AppointmentRevision key={revision.id} revision={revision} />
      ))}
      {data.history.length === 0 && (
        <p className="text-sm text-muted-foreground">
          O próximo registro preservará a informação legada no histórico.
        </p>
      )}
    </div>
  );
}
function AppointmentRevision({
  revision,
}: {
  revision: Appointment["history"][number];
}): ReactElement {
  return (
    <details className="rounded-md border border-border bg-card p-4">
      <summary className="cursor-pointer text-sm">
        <span className="font-medium">{revision.author?.name ?? "Autoria não registrada"}</span>
        <span className="mt-1 block text-caption text-muted-foreground">
          {appointmentStamp(revision.at)} · {revisionLabels.get(revision.kind) ?? "Registro"}
        </span>
      </summary>
      <div className="mt-4 grid gap-4">
        {revision.reason && <p className="text-caption text-muted-foreground">{revision.reason}</p>}
        <AppointmentAccount row={revision.snapshot} rescheduled={revision.kind === "RESCHEDULED"} />
      </div>
    </details>
  );
}
