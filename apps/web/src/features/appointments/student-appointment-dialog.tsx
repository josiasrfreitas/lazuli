"use client";
import type { ReactElement } from "react";
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
import { RecordState } from "~/features/class-records/shared";
import { AppointmentAccount } from "./account";
import { CancelAppointmentDialog } from "./cancel-dialog";
import { AppointmentRecordForm } from "./record-form";
import { ScheduleAppointmentDialog } from "./schedule-dialog";
import { isRescheduled, appointmentRestriction, type Appointment } from "./shared";
import { AppointmentDialogHeader, AppointmentDialogHistory } from "./appointment-dialog-context";
import { AppointmentAssessmentFiles } from "~/features/assessment-files/attachments";
import {
  useStudentAppointment,
  type StudentAppointmentProps,
  type StudentAppointmentModel,
} from "./student-appointment-model";
import styles from "./student-appointment-dialog.module.css";
type DialogData = { model: StudentAppointmentModel; data: Appointment };
export function StudentAppointmentDialog(props: StudentAppointmentProps): ReactElement {
  const model = useStudentAppointment(props);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !model.pending) props.onClose();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <AppointmentPopup model={model} />
      </DialogPortal>
    </Dialog>
  );
}
function AppointmentPopup({ model }: { model: StudentAppointmentModel }): ReactElement {
  return (
    <DialogContent
      className="md:max-w-4xl md:w-[calc(100%_-_2rem)]"
      showCloseButton={!model.pending}
      finalFocus={() =>
        document.querySelector<HTMLElement>(`#${CSS.escape(`appointment-cell-${model.props.id}`)}`)
      }
    >
      {model.query.data ? (
        <AppointmentDialogHeader data={model.query.data} admin={model.props.admin} />
      ) : (
        <DialogHeader>
          <DialogTitle>Atendimento</DialogTitle>
        </DialogHeader>
      )}
      <AppointmentViewport model={model} />
      {model.query.data && <AppointmentFooter model={model} data={model.query.data} />}
      <AppointmentActionDialogs model={model} />
    </DialogContent>
  );
}
function AppointmentViewport({ model }: { model: StudentAppointmentModel }): ReactElement {
  return (
    <DialogBody>
      <div className={styles.body}>
        {model.query.isPending ? (
          <PencilLoader size="sm" label="Carregando atendimento" />
        ) : (
          <RecordState
            pending={false}
            error={model.query.error}
            retry={() => void model.query.refetch()}
          />
        )}
        {model.query.data && <AppointmentDialogBody model={model} data={model.query.data} />}
      </div>
    </DialogBody>
  );
}
function AppointmentFooter({ model, data }: DialogData): ReactElement {
  return (
    <DialogFooter className="border-t border-border pt-4" ref={model.setFooterTarget}>
      {!model.editing && !model.props.readOnly && (
        <AppointmentDialogActions model={model} data={data} />
      )}
    </DialogFooter>
  );
}
function AppointmentActionDialogs({ model }: { model: StudentAppointmentModel }): ReactElement {
  const row = model.query.data?.snapshot;
  return (
    <>
      {row && model.action === "cancel" && (
        <CancelAppointmentDialog row={row} onClose={() => model.setAction(null)} />
      )}
      {row && model.action === "reschedule" && (
        <ScheduleAppointmentDialog previous={row} onClose={() => model.setAction(null)} />
      )}
    </>
  );
}
function AppointmentDialogActions({ model, data }: DialogData): ReactElement {
  const row = data.snapshot;
  return (
    <div className={styles.toolbar}>
      <div className={styles.secondaryActions}>
        <AppointmentSecondaryActions model={model} data={data} />
      </div>
      {!data.restriction && (
        <Button
          id={`appointment-edit-${row.id}`}
          size="sm"
          variant="primary"
          onClick={() => model.setEditing(true)}
        >
          {row.status === "SCHEDULED" ? <Check /> : <Pencil />}
          {row.status === "SCHEDULED" ? "Registrar atendimento" : "Corrigir registro"}
        </Button>
      )}
    </div>
  );
}
function AppointmentSecondaryActions({ model, data }: DialogData): ReactElement {
  const row = data.snapshot;
  const previousId = row.rescheduledFromId;
  const nextId = data.rescheduledToId;
  return (
    <>
      {row.status === "SCHEDULED" && model.props.admin && (
        <>
          <Button size="sm" variant="secondary" onClick={() => model.setAction("reschedule")}>
            <CalendarClock />
            Reagendar
          </Button>
          <Button size="sm" variant="destructive-outline" onClick={() => model.setAction("cancel")}>
            <CalendarX2 />
            Cancelar
          </Button>
        </>
      )}
      {previousId && (
        <Button variant="link" size="sm" onClick={() => model.props.onSelect(previousId)}>
          Agendamento anterior
        </Button>
      )}
      {nextId && (
        <Button variant="link" size="sm" onClick={() => model.props.onSelect(nextId)}>
          Novo agendamento
        </Button>
      )}
    </>
  );
}
function AppointmentDialogBody({ model, data }: DialogData): ReactElement {
  const planning = data.snapshot.plannedContent?.trim();
  return (
    <>
      <AppointmentDialogNotices data={data} />
      {model.editing ? (
        <AppointmentRecordForm
          data={data}
          onClose={model.finish}
          context={planning ? <PlanningReference planning={planning} /> : undefined}
          footerTarget={model.footerTarget}
          onPendingChange={model.setPending}
        />
      ) : (
        <AppointmentOverview data={data} />
      )}
      <AppointmentDialogHistory data={data} />
      {data.snapshot.purpose === "ASSESSMENT" && (
        <AppointmentAssessmentFiles id={data.snapshot.id} studentId={data.snapshot.student.id} />
      )}
    </>
  );
}
function AppointmentDialogNotices({ data }: { data: Appointment }): ReactElement {
  const row = data.snapshot;
  const restriction =
    data.restriction === "O registro fica disponível após o término do atendimento."
      ? null
      : appointmentRestriction(data);
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
          {isRescheduled(data) ? "Motivo do reagendamento" : "Motivo do cancelamento"}:{" "}
          {row.cancellationReason}
        </p>
      )}
    </>
  );
}
function PlanningReference({ planning }: { planning: string }): ReactElement {
  return (
    <details className={styles.planReference}>
      <summary>
        <ClipboardList aria-hidden="true" />
        Consultar planejamento do encontro
      </summary>
      <p>{planning}</p>
    </details>
  );
}
function AppointmentOverview({ data }: { data: Appointment }): ReactElement {
  const planning = data.snapshot.plannedContent?.trim();
  return (
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
        <AppointmentAccount row={data.snapshot} rescheduled={isRescheduled(data)} />
      </section>
    </div>
  );
}
