"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CalendarDays, Check, MapPin, Pencil, UserRound } from "lucide-react";
import { sessionEndInstant } from "@lazuli/domain";
import {
  Alert,
  Badge,
  Button,
  Dialog,
  DialogBackdrop,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPortal,
  DialogTitle,
  PencilLoader,
} from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { dateLabel, formatLabel, visitLabels } from "~/features/admissions/labels";
import { LeadCaptureDialog } from "~/features/admissions/lead-capture-dialog";
import { OutcomeDialog } from "~/features/admissions/visit-outcome";
import type { CalendarExperimental } from "./calendar-model";
import { PlacementVisitDialog } from "~/features/admissions/placement-assessment";
import { ExperimentalLeadDetails } from "./experimental-lead-details";
import { RecordState } from "./shared";
import styles from "./calendar-experimental-dialog.module.css";
import { TeacherVisitDialog } from "~/features/teacher-workspace/visits";

type ExperimentalVisit = Omit<CalendarExperimental, "date" | "kind"> & {
  kind?: CalendarExperimental["kind"];
  date: string | Date;
  classId?: string | null;
  className?: string;
};

export function CalendarExperimentalDialog({
  visit,
  admin,
  onClose,
}: {
  visit: ExperimentalVisit;
  admin: boolean;
  onClose: () => void;
}) {
  if (!admin) return <TeacherVisitDialog id={visit.id} onClose={onClose} />;
  if (visit.kind === "PLACEMENT")
    return (
      <PlacementVisitDialog candidateId={visit.candidate.id} visitId={visit.id} onClose={onClose} />
    );
  return <ExperimentalDetails visit={visit} admin={admin} onClose={onClose} />;
}

function ExperimentalDetails({
  visit,
  admin,
  onClose,
}: {
  visit: ExperimentalVisit;
  admin: boolean;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState<"contact" | "outcome" | null>(null);
  // Commercial information and edits retain the existing admin-only permissions.
  const query = trpc.admissions.byId.useQuery(
    { id: visit.candidate.id },
    { enabled: admin, retry: false },
  );
  const lead = admin ? query.data : undefined;
  const record = lead?.visits.find((item) => item.id === visit.id);
  const status = record?.status ?? visit.status;
  const pending = status === "SCHEDULED" && visit.overdue;
  const editable = lead?.status === "WAITING";
  const canRecord = Boolean(
    admin &&
    record &&
    status !== "CANCELLED" &&
    !record.needsReschedule &&
    sessionEndInstant({ date: record.date, endTime: record.startTime }) <= new Date(),
  );
  const hasNotes = Boolean(
    record?.notes?.trim() || record?.cancellationReason?.trim() || lead?.notes?.trim(),
  );
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !editing) onClose();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent className="md:max-w-4xl md:w-[calc(100%-2rem)]">
          <DialogHeader>
            <div className={styles.title}>
              <DialogTitle>{lead?.fullName ?? visit.candidate.fullName}</DialogTitle>
              <Badge
                variant={
                  status === "ATTENDED"
                    ? "success"
                    : status === "ABSENT" || pending
                      ? "warning"
                      : "neutral"
                }
              >
                {pending ? "Presença não registrada" : visitLabels[status]}
              </Badge>
            </div>
            <DialogDescription>
              Aula experimental ·{" "}
              {visit.className ? `Convidado na turma ${visit.className}` : "Individual"}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <dl className={styles.facts}>
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
              <div>
                <dt>
                  <UserRound aria-hidden="true" />
                  Professor
                </dt>
                <dd>{record?.teacherName ?? visit.teacher?.name ?? "A definir"}</dd>
              </div>
              <div>
                <dt>
                  <MapPin aria-hidden="true" />
                  Encontro
                </dt>
                <dd>
                  {formatLabel(record?.format ?? visit.format)}
                  <span>
                    {" "}
                    ·{" "}
                    {visit.classId ? (
                      <Link className={styles.textLink} href={`/turmas/${visit.classId}`}>
                        {visit.className ?? "Ver turma"}
                        <ArrowUpRight aria-hidden="true" />
                      </Link>
                    ) : (
                      "Individual"
                    )}
                  </span>
                </dd>
              </div>
            </dl>
            {record?.needsReschedule && (
              <Alert variant="warning">
                O encontro mudou ou está sem professor. Abra o lead para remarcar a experimental.
              </Alert>
            )}
            <div className={styles.body}>
              <ExperimentalLeadDetails
                lead={lead}
                candidate={visit.candidate}
                onEditContact={() => setEditing("contact")}
              />
              {hasNotes && (
                <div className={styles.followUp}>
                  {record?.cancellationReason?.trim() && (
                    <section className={styles.narrative}>
                      <h3>Motivo do cancelamento</h3>
                      <p>{record.cancellationReason}</p>
                    </section>
                  )}
                  {record?.notes?.trim() && (
                    <section className={styles.narrative}>
                      <h3>Registro da experimental</h3>
                      <p>{record.notes}</p>
                    </section>
                  )}
                  {lead?.notes?.trim() && (
                    <section className={styles.narrative}>
                      <h3>Observações sobre o lead</h3>
                      <p>{lead.notes}</p>
                    </section>
                  )}
                </div>
              )}
            </div>
            {admin && query.isPending && (
              <div className={styles.loading}>
                <PencilLoader size="sm" label="Carregando dados do lead" />
              </div>
            )}
            {admin && (
              <RecordState pending={false} error={query.error} retry={() => void query.refetch()} />
            )}
          </DialogBody>
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
                  Fechar
                </Button>
                {canRecord && (
                  <Button size="sm" onClick={() => setEditing("outcome")}>
                    {status === "SCHEDULED" ? (
                      <Check aria-hidden="true" />
                    ) : (
                      <Pencil aria-hidden="true" />
                    )}
                    {status === "SCHEDULED" ? "Registrar comparecimento" : "Editar registro"}
                  </Button>
                )}
              </div>
            </div>
          </DialogFooter>
          {lead && editable && editing === "contact" && (
            <LeadCaptureDialog candidate={lead} onClose={() => setEditing(null)} />
          )}
          {record && editing === "outcome" && (
            <OutcomeDialog visit={record} cancel={false} onClose={() => setEditing(null)} />
          )}
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
