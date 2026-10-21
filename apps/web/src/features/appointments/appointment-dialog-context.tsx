import type { ReactElement } from "react";
import Link from "next/link";
import { ClassRecordTrigger } from "~/features/class-records/class-record-trigger";
import { CalendarDays, History, MapPin, UserRound } from "lucide-react";
import { DialogDescription, DialogHeader, DialogTitle } from "@lazuli/ui";
import { formatDateOnlyBR } from "~/lib/format";
import {
  AppointmentBadge,
  purposes,
  isRescheduled,
  appointmentStamp,
  type Appointment,
} from "./shared";
import { appointmentChanges, type AppointmentChange } from "./appointment-history-changes";
import styles from "./student-appointment-dialog.module.css";
export function AppointmentDialogHeader({
  data,
  admin,
}: {
  data: Appointment;
  admin: boolean;
}): ReactElement {
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
          <AppointmentBadge status={row.status} rescheduled={isRescheduled(data)} />
        </div>
        <DialogDescription>{purposes[row.purpose]}</DialogDescription>
      </div>
      <AppointmentFacts data={data} />
    </DialogHeader>
  );
}
function AppointmentFacts({ data: { snapshot: row } }: { data: Appointment }): ReactElement {
  return (
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
  );
}
const events = new Map([
  ["SCHEDULED", "Agendado"],
  ["IMPORTED", "Registro importado"],
  ["RESCHEDULED", "Reagendado"],
  ["CANCELLED", "Cancelado"],
  ["CORRECTED", "Registro alterado"],
  ["RECORDED", "Atendimento registrado"],
]);
type Revision = Appointment["history"][number];
export function AppointmentDialogHistory({ data }: { data: Appointment }): ReactElement {
  const revisions = data.history.toSorted((left, right) => right.version - left.version);
  return (
    <details className={styles.disclosure}>
      <summary>
        <History aria-hidden="true" />
        Histórico de alterações <span>{revisions.length}</span>
      </summary>
      <p className={styles.attribution}>
        Agendado por {data.snapshot.scheduledBy?.name ?? "Autoria não registrada"} ·{" "}
        {appointmentStamp(data.snapshot.scheduledAt)}
      </p>
      <ol className={styles.history}>
        {revisions.length === 0 && <li>Não há alterações registradas para este atendimento.</li>}
        {revisions.map((revision, index) => (
          <DialogRevision
            key={revision.id}
            revision={revision}
            previous={revisions.at(index + 1)}
          />
        ))}
      </ol>
    </details>
  );
}
function DialogRevision({
  revision,
  previous,
}: {
  revision: Revision;
  previous: Revision | undefined;
}): ReactElement {
  const changes = previous
    ? appointmentChanges(previous.snapshot, revision.snapshot).map((change) =>
        change.label === "Situação" && revision.kind === "RESCHEDULED"
          ? { ...change, after: "Reagendado" }
          : change,
      )
    : [];
  return (
    <li>
      <strong>{events.get(revision.kind) ?? "Alteração registrada"}</strong>
      <p className={styles.attribution}>
        {appointmentStamp(revision.at)} · {revision.author?.name ?? "Autoria não registrada"}
      </p>
      {changes.length > 0 && <RevisionChanges changes={changes} />}
    </li>
  );
}
function RevisionChanges({ changes }: { changes: AppointmentChange[] }): ReactElement {
  return (
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
  );
}
