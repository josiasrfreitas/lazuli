"use client";

import { useState } from "react";
import {
  CalendarClock,
  Check,
  ClipboardList,
  MessageSquareText,
  Pencil,
  CalendarX2,
} from "lucide-react";
import {
  Alert,
  Button,
  Dialog,
  DialogBackdrop,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogPortal,
  DialogTitle,
  PencilLoader,
} from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { RecordState } from "~/features/class-records/shared";
import { CancelAppointmentDialog } from "./detail";
import { AppointmentAccount } from "./appointment-account";
import { AppointmentRecordForm } from "./record-form";
import { ScheduleAppointmentDialog } from "./schedule-dialog";
import type { Appointment } from "./shared";
import { AppointmentDialogHeader, AppointmentDialogHistory } from "./appointment-dialog-context";
import styles from "./student-appointment-dialog.module.css";
import { AppointmentAssessmentFiles } from "~/features/assessment-files/attachments";

export function StudentAppointmentDialog({
  id,
  admin,
  onClose,
  onSelect,
  readOnly = false,
}: {
  id: string;
  admin: boolean;
  readOnly?: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
}) {
  const query = trpc.appointments.detail.useQuery({ id }, { retry: false });
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [footerTarget, setFooterTarget] = useState<HTMLDivElement | null>(null);
  const [action, setAction] = useState<"cancel" | "reschedule" | null>(null);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent
          className="md:max-w-4xl md:w-[calc(100%-2rem)]"
          showCloseButton={!pending}
          finalFocus={() => document.getElementById(`appointment-cell-${id}`)}
        >
          {query.data ? (
            <AppointmentDialogHeader data={query.data} admin={admin} />
          ) : (
            <DialogHeader>
              <DialogTitle>Atendimento</DialogTitle>
            </DialogHeader>
          )}
          <DialogBody>
            <div className={styles.body}>
              {query.isPending ? (
                <PencilLoader size="sm" label="Carregando atendimento" />
              ) : (
                <RecordState
                  pending={false}
                  error={query.error}
                  retry={() => void query.refetch()}
                />
              )}
              {query.data && (
                <AppointmentDialogBody
                  data={query.data}
                  editing={editing}
                  footerTarget={footerTarget}
                  onPendingChange={setPending}
                  onFinish={() => {
                    setPending(false);
                    setEditing(false);
                    requestAnimationFrame(() =>
                      document.getElementById(`appointment-edit-${id}`)?.focus(),
                    );
                  }}
                />
              )}
            </div>
          </DialogBody>
          {query.data && (
            <DialogFooter className="border-t border-border pt-4" ref={setFooterTarget}>
              {!editing && !readOnly && (
                <AppointmentDialogActions
                  data={query.data}
                  admin={admin}
                  setEditing={setEditing}
                  setAction={setAction}
                  onSelect={onSelect}
                />
              )}
            </DialogFooter>
          )}
          {query.data && action === "cancel" && (
            <CancelAppointmentDialog row={query.data.snapshot} onClose={() => setAction(null)} />
          )}
          {query.data && action === "reschedule" && (
            <ScheduleAppointmentDialog
              previous={query.data.snapshot}
              onClose={() => setAction(null)}
            />
          )}
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}

function AppointmentDialogActions({
  data,
  admin,
  setEditing,
  setAction,
  onSelect,
}: {
  data: Appointment;
  admin: boolean;
  setEditing: (value: boolean) => void;
  setAction: (value: "cancel" | "reschedule") => void;
  onSelect: (id: string) => void;
}) {
  const row = data.snapshot;
  const previousId = row.rescheduledFromId;
  const nextId = data.rescheduledToId;
  return (
    <div className={styles.toolbar}>
      <div className={styles.secondaryActions}>
        {row.status === "SCHEDULED" && admin && (
          <>
            <Button size="sm" variant="secondary" onClick={() => setAction("reschedule")}>
              <CalendarClock />
              Reagendar
            </Button>
            <Button size="sm" variant="destructive-outline" onClick={() => setAction("cancel")}>
              <CalendarX2 />
              Cancelar
            </Button>
          </>
        )}
        {previousId && (
          <Button variant="link" size="sm" onClick={() => onSelect(previousId)}>
            Agendamento anterior
          </Button>
        )}
        {nextId && (
          <Button variant="link" size="sm" onClick={() => onSelect(nextId)}>
            Novo agendamento
          </Button>
        )}
      </div>
      {!data.restriction && (
        <Button
          id={`appointment-edit-${row.id}`}
          size="sm"
          variant="primary"
          onClick={() => setEditing(true)}
        >
          {row.status === "SCHEDULED" ? <Check /> : <Pencil />}
          {row.status === "SCHEDULED" ? "Registrar atendimento" : "Corrigir registro"}
        </Button>
      )}
    </div>
  );
}

function AppointmentDialogBody({
  data,
  editing,
  onFinish,
  footerTarget,
  onPendingChange,
}: {
  data: Appointment;
  editing: boolean;
  onFinish: () => void;
  footerTarget: HTMLDivElement | null;
  onPendingChange: (pending: boolean) => void;
}) {
  const row = data.snapshot;
  const restriction =
    data.restriction === "O registro fica disponível após o término do atendimento."
      ? null
      : data.restriction;
  const planning = row.plannedContent?.trim();
  const context = planning ? (
    <details className={styles.planReference}>
      <summary>
        <ClipboardList aria-hidden="true" />
        Consultar planejamento do encontro
      </summary>
      <p>{planning}</p>
    </details>
  ) : undefined;
  return (
    <>
      {row.version === 0 && (
        <Alert>
          Registro anterior aos atendimentos. Informações não registradas permanecem em aberto;
          faltas só são compensadas após a associação de uma origem verificada.
        </Alert>
      )}
      {restriction && <Alert>{restriction}</Alert>}
      {row.cancellationReason && (
        <p className={styles.reason}>
          Motivo {data.rescheduledToId ? "do reagendamento" : "do cancelamento"}:{" "}
          {row.cancellationReason}
        </p>
      )}
      {editing ? (
        <AppointmentRecordForm
          data={data}
          onClose={onFinish}
          context={context}
          footerTarget={footerTarget}
          onPendingChange={onPendingChange}
        />
      ) : (
        <div className={styles.overview}>
          {planning && (
            <section className={styles.planning}>
              <h3>
                <ClipboardList aria-hidden="true" />
                Previsto para o encontro
              </h3>
              <p>{planning}</p>
            </section>
          )}
          <section className={styles.account}>
            <h3>
              <MessageSquareText aria-hidden="true" />
              Registro do atendimento
            </h3>
            <AppointmentAccount row={row} rescheduled={Boolean(data.rescheduledToId)} />
          </section>
        </div>
      )}
      <AppointmentDialogHistory data={data} />
      {row.purpose === "ASSESSMENT" && (
        <AppointmentAssessmentFiles id={row.id} studentId={row.student.id} />
      )}
    </>
  );
}
