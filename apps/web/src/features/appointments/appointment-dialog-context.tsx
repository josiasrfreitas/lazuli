import type { JSX as ReactJSX } from "react";
import Link from "next/link";
import { ClassRecordTrigger } from "~/features/class-records/class-record-trigger";
import { CalendarDays, History, MapPin, UserRound } from "lucide-react";
import { DialogDescription, DialogHeader, DialogTitle } from "@lazuli/ui";
import { formatDateOnlyBR } from "~/lib/format";
import { AppointmentBadge, purposes, type Appointment } from "./shared";
import { AppointmentAccount } from "./appointment-account";
import { appointmentChanges } from "./appointment-history-changes";
import styles from "./student-appointment-dialog.module.css";

const stamp = (value: string | Date): string =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));

export function AppointmentDialogHeader({
  data,
  admin,
}: {
  data: Appointment;
  admin: boolean;
}): ReactJSX.Element {
  const row = data.snapshot;
  return (
    <DialogHeader>
      <div className={styles.headingRow}>
        <div className={styles.title}>
          <DialogTitle>
            {admin ? (
              <Link href={`/alunos/${row.student.id}`} className={styles.studentLink}>
                {row.student.name}
              </Link>
            ) : (
              row.student.name
            )}
          </DialogTitle>
          <AppointmentBadge status={row.status} rescheduled={Boolean(data.rescheduledToId)} />
        </div>
        <DialogDescription>{purposes[row.purpose]}</DialogDescription>
      </div>
      <dl className={styles.facts}>
        <div>
          <dt>
            <CalendarDays aria-hidden="true" />
            <span className="sr-only">Data e horário</span>
          </dt>
          <dd>
            {formatDateOnlyBR(row.date)}
            <span className={styles.factDetail}>
              {" "}
              · {row.startTime}–{row.endTime}
            </span>
          </dd>
        </div>
        <div>
          <dt>
            <UserRound aria-hidden="true" />
            Professor
          </dt>
          <dd>{row.teacher?.name ?? "A definir"}</dd>
        </div>
        <div>
          <dt>
            <MapPin aria-hidden="true" />
            Encontro
          </dt>
          <dd>
            {row.format === "IN_PERSON" ? "Presencial" : "Online"}
            <span className={styles.factDetail}>
              {" "}
              ·{" "}
              {row.targetClassSessionId ? (
                <ClassRecordTrigger sessionId={row.targetClassSessionId}>
                  {row.targetClassName} · Abrir aula
                </ClassRecordTrigger>
              ) : (
                "Individual"
              )}
            </span>
          </dd>
        </div>
      </dl>
    </DialogHeader>
  );
}

const events: Record<string, string> = {
  SCHEDULED: "Agendado",
  IMPORTED: "Registro importado",
  RESCHEDULED: "Reagendado",
  CANCELLED: "Cancelado",
  CORRECTED: "Registro alterado",
  RECORDED: "Atendimento registrado",
};

export function AppointmentDialogHistory({ data }: { data: Appointment }): ReactJSX.Element {
  const revisions = [...data.history].sort((a, b) => b.version - a.version);
  return (
    <details className={styles.disclosure}>
      <summary>
        <History aria-hidden="true" />
        Histórico de alterações <span>{revisions.length}</span>
      </summary>
      <p className={styles.attribution}>
        Agendado por {data.snapshot.scheduledBy?.name ?? "Autoria não registrada"} ·{" "}
        {stamp(data.snapshot.scheduledAt)}
      </p>
      <ol className={styles.history}>
        {revisions.length === 0 && <li>Não há alterações registradas para este atendimento.</li>}
        {revisions.map((revision, index) => {
          const previous = revisions[index + 1];
          const changes = previous ? appointmentChanges(previous.snapshot, revision.snapshot) : [];
          return (
            <li key={revision.id}>
              <strong>{events[revision.kind] ?? revision.kind}</strong>
              <p className={styles.attribution}>
                {stamp(revision.at)} · {revision.author?.name ?? "Autoria não registrada"}
              </p>
              {revision.reason && <p className="whitespace-pre-wrap text-sm">{revision.reason}</p>}
              <p className={styles.attribution}>
                {formatDateOnlyBR(revision.snapshot.date)} · {revision.snapshot.startTime}–
                {revision.snapshot.endTime}
              </p>
              <AppointmentAccount
                row={revision.snapshot}
                rescheduled={revision.kind === "RESCHEDULED"}
              />
              {changes.length > 0 && (
                <dl className={styles.changes}>
                  {changes.map((change) => (
                    <div key={change.label}>
                      <dt>{change.label}</dt>
                      <dd>
                        {change.before} → {change.after}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </li>
          );
        })}
      </ol>
    </details>
  );
}
