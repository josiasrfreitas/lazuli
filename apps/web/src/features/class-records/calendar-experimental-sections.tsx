import type { ReactElement } from "react";
import Link from "next/link";
import { ArrowUpRight, CalendarDays, Check, MapPin, Pencil, UserRound, X } from "lucide-react";
import {
  ToastAlert,
  Badge,
  Button,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@lazuli/ui";
import { dateLabel, formatLabel, visitLabels, type Candidate } from "~/features/admissions/labels";
import { ExperimentalLeadDetails } from "./experimental-lead-details";
import type { CalendarExperimental } from "./calendar-model";
import styles from "./calendar-experimental-dialog.module.css";

export type ExperimentalVisit = Omit<CalendarExperimental, "date" | "kind"> & {
  kind?: CalendarExperimental["kind"];
  date: string | Date;
  classId?: string | null;
  className?: string;
};
export type VisitRecord = Candidate["visits"][number];
export type VisitStatus = VisitRecord["status"];

export function ExperimentalHeader({
  visit,
  lead,
  status,
  pending,
}: {
  visit: ExperimentalVisit;
  lead: Candidate | undefined;
  status: VisitStatus;
  pending: boolean;
}): ReactElement {
  return (
    <DialogHeader>
      <div className={styles.title}>
        <DialogTitle>{lead?.fullName ?? visit.candidate.fullName}</DialogTitle>
        <Badge variant={statusVariant(status, pending)}>
          {pending ? "Presença não registrada" : visitLabels[status]}
        </Badge>
      </div>
      <DialogDescription>
        Aula experimental ·{" "}
        {visit.className ? `Convidado na turma ${visit.className}` : "Individual"}
      </DialogDescription>
    </DialogHeader>
  );
}

function statusVariant(status: VisitStatus, pending: boolean): "success" | "warning" | "neutral" {
  if (status === "ATTENDED") return "success";
  if (status === "ABSENT" || pending) return "warning";
  return "neutral";
}

export function ExperimentalFacts({
  visit,
  record,
}: {
  visit: ExperimentalVisit;
  record: VisitRecord | undefined;
}): ReactElement {
  return (
    <dl className={styles.facts}>
      <VisitDateFact visit={visit} record={record} />
      <VisitTeacherFact visit={visit} record={record} />
      <VisitMeetingFact visit={visit} record={record} />
    </dl>
  );
}

function VisitDateFact({
  visit,
  record,
}: {
  visit: ExperimentalVisit;
  record: VisitRecord | undefined;
}): ReactElement {
  return (
    <div>
      <dt>
        <CalendarDays aria-hidden="true" />
        <span className="sr-only">Data e horário</span>
      </dt>
      <dd>
        {dateLabel(record?.date ?? visit.date)}
        <span>
          {" "}
          · {record?.startTime ?? visit.startTime}–{record?.endTime ?? visit.endTime}
        </span>
      </dd>
    </div>
  );
}

function VisitTeacherFact({
  visit,
  record,
}: {
  visit: ExperimentalVisit;
  record: VisitRecord | undefined;
}): ReactElement {
  return (
    <div>
      <dt>
        <UserRound aria-hidden="true" />
        Professor
      </dt>
      <dd>{record?.teacherName ?? visit.teacher?.name ?? "A definir"}</dd>
    </div>
  );
}

function VisitMeetingFact({
  visit,
  record,
}: {
  visit: ExperimentalVisit;
  record: VisitRecord | undefined;
}): ReactElement {
  return (
    <div>
      <dt>
        <MapPin aria-hidden="true" />
        Encontro
      </dt>
      <dd>
        {formatLabel(record?.format ?? visit.format)}
        <span>
          {" "}
          · <ClassVisitLink visit={visit} />
        </span>
      </dd>
    </div>
  );
}

function ClassVisitLink({ visit }: { visit: ExperimentalVisit }): ReactElement {
  if (!visit.classId) return <>Individual</>;
  return (
    <Link className={styles.textLink} href={`/turmas/${visit.classId}`}>
      {visit.className ?? "Ver turma"}
      <ArrowUpRight aria-hidden="true" />
    </Link>
  );
}

export function ExperimentalNotes({
  record,
  lead,
}: {
  record: VisitRecord | undefined;
  lead: Candidate | undefined;
}): ReactElement | null {
  if (!hasNotes(record, lead)) return null;
  return (
    <div className={styles.followUp}>
      <Narrative title="Motivo do cancelamento" text={record?.cancellationReason} />
      <Narrative title="Registro da experimental" text={record?.notes} />
      <Narrative title="Observações sobre o lead" text={lead?.notes} />
    </div>
  );
}

function hasNotes(record: VisitRecord | undefined, lead: Candidate | undefined): boolean {
  return [record?.notes?.trim(), record?.cancellationReason?.trim(), lead?.notes?.trim()].some(
    Boolean,
  );
}

function Narrative({
  title,
  text,
}: {
  title: string;
  text: string | null | undefined;
}): ReactElement | null {
  if (!text?.trim()) return null;
  return (
    <section className={styles.narrative}>
      <h3>{title}</h3>
      <p>{text}</p>
    </section>
  );
}

export function ExperimentalBodyContent({
  visit,
  record,
  lead,
  onEditContact,
}: {
  visit: ExperimentalVisit;
  record: VisitRecord | undefined;
  lead: Candidate | undefined;
  onEditContact: () => void;
}): ReactElement {
  return (
    <>
      <ExperimentalFacts visit={visit} record={record} />
      {record?.needsReschedule && (
        <ToastAlert variant="warning">
          O encontro mudou ou está sem professor. Abra o lead para remarcar a experimental.
        </ToastAlert>
      )}
      <div className={styles.body}>
        <ExperimentalLeadDetails
          lead={lead}
          candidate={visit.candidate}
          onEditContact={onEditContact}
        />
        <ExperimentalNotes record={record} lead={lead} />
      </div>
    </>
  );
}

export function ExperimentalFooter({
  visit,
  admin,
  status,
  canRecord,
  onClose,
  onRecord,
}: {
  visit: ExperimentalVisit;
  admin: boolean;
  status: VisitStatus;
  canRecord: boolean;
  onClose: () => void;
  onRecord: () => void;
}): ReactElement {
  return (
    <DialogFooter>
      <div className={styles.footer}>
        <div>
          {admin && (
            <Button
              variant="link"
              size="sm"
              nativeButton={false}
              render={<Link href={`/interessados/${visit.candidate.id}`} />}
            >
              Abrir lead
              <ArrowUpRight aria-hidden="true" />
            </Button>
          )}
        </div>
        <div className={styles.actions}>
          <Button variant="secondary" size="sm" onClick={onClose}>
            <X aria-hidden="true" />
            Fechar
          </Button>
          {canRecord && <RecordVisitButton status={status} onRecord={onRecord} />}
        </div>
      </div>
    </DialogFooter>
  );
}

function RecordVisitButton({
  status,
  onRecord,
}: {
  status: VisitStatus;
  onRecord: () => void;
}): ReactElement {
  const scheduled = status === "SCHEDULED";
  return (
    <Button size="sm" onClick={onRecord}>
      {scheduled ? <Check aria-hidden="true" /> : <Pencil aria-hidden="true" />}
      {scheduled ? "Registrar comparecimento" : "Editar registro"}
    </Button>
  );
}
