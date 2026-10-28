"use client";

import type { JSX as ReactJSX } from "react";
import { useEffect, useRef, useState, type RefObject } from "react";
import {
  ArrowRight,
  ArrowLeft,
  CalendarClock,
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
  DialogPortal,
} from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { RecordState } from "~/features/class-records/shared";
import { CancelAppointmentDialog } from "./detail";
import { AppointmentAccount } from "./appointment-account";
import { AppointmentRecordForm } from "./record-form";
import { ScheduleAppointmentDialog } from "./schedule-dialog";
import type { Appointment } from "./shared";
import {
  AppointmentLoadingBody,
  AppointmentLoadingHeader,
  AppointmentLoadingFooter,
} from "./student-appointment-loading";
import { AppointmentDialogHeader, AppointmentDialogHistory } from "./appointment-dialog-context";
import styles from "./student-appointment-dialog.module.css";
import { AppointmentAssessmentFiles } from "~/features/assessment-files/attachments";

type StudentAppointmentDialogProps = {
  id: string;
  admin: boolean;
  readOnly?: boolean;
  embedded?: boolean;
  onPendingChange?: ((pending: boolean) => void) | undefined;
  onReschedule?: ((row: Appointment["snapshot"]) => void) | undefined;
  onOpenLesson?: ((id: string) => void) | undefined;
  onClose: () => void;
  onSelect: (id: string) => void;
};

export function StudentAppointmentDialog({
  id,
  admin,
  onClose,
  onSelect,
  readOnly = false,
  embedded = false,
  onPendingChange,
  onReschedule,
  onOpenLesson,
}: StudentAppointmentDialogProps): ReactJSX.Element {
  const query = trpc.appointments.detail.useQuery({ id }, { retry: false });
  const state = useAppointmentDialogState(id, { embedded, onPendingChange });
  const content = (
    <AppointmentDetailContent
      id={id}
      admin={admin}
      readOnly={readOnly}
      onSelect={onSelect}
      query={query}
      state={state}
      onReschedule={onReschedule}
      onReturn={embedded ? onClose : undefined}
      onOpenLesson={onOpenLesson}
    />
  );
  if (embedded)
    return (
      <EmbeddedAppointmentPanel
        state={state}
        data={query.data}
        onPendingChange={onPendingChange}
        content={content}
      />
    );
  return (
    <AppointmentDialogShell
      id={id}
      open={state.open}
      pending={state.pending}
      onClose={onClose}
      content={content}
    />
  );
}

function EmbeddedAppointmentPanel({
  state,
  data,
  onPendingChange,
  content,
}: {
  state: AppointmentDialogState;
  data: Appointment | undefined;
  onPendingChange: ((pending: boolean) => void) | undefined;
  content: ReactJSX.Element;
}): ReactJSX.Element {
  if (state.action === "cancel" && data)
    return (
      <div key="cancel" className={styles.embeddedPanel}>
        <CancelAppointmentDialog
          embedded
          row={data.snapshot}
          onClose={() => state.setAction(null)}
          onPendingChange={onPendingChange}
        />
      </div>
    );
  return (
    <div key="detail" ref={state.panel} className={styles.embeddedPanel}>
      {content}
    </div>
  );
}

function AppointmentDetailContent({
  id,
  admin,
  readOnly,
  onSelect,
  query,
  state,
  onReschedule,
  onReturn,
  onOpenLesson,
}: {
  id: string;
  admin: boolean;
  readOnly: boolean;
  onSelect: (id: string) => void;
  query: AppointmentDialogViewProps["query"];
  state: AppointmentDialogState;
  onReschedule: ((row: Appointment["snapshot"]) => void) | undefined;
  onReturn: (() => void) | undefined;
  onOpenLesson: ((id: string) => void) | undefined;
}): ReactJSX.Element {
  return (
    <AppointmentDialogView
      id={id}
      admin={admin}
      readOnly={readOnly}
      onSelect={onSelect}
      query={query}
      editing={state.editing}
      setEditing={state.setEditing}
      pending={state.pending}
      setPending={state.setPending}
      footerTarget={state.footerTarget}
      setFooterTarget={state.setFooterTarget}
      action={state.action}
      setAction={(next) => {
        if (next === "reschedule" && onReschedule && query.data) onReschedule(query.data.snapshot);
        else state.setAction(next);
      }}
      onReturn={onReturn}
      onOpenLesson={onOpenLesson}
    />
  );
}

type AppointmentDialogState = {
  open: boolean;
  editing: boolean;
  setEditing: (editing: boolean) => void;
  pending: boolean;
  setPending: (pending: boolean) => void;
  footerTarget: HTMLDivElement | null;
  setFooterTarget: (target: HTMLDivElement | null) => void;
  action: "cancel" | "reschedule" | null;
  setAction: (action: "cancel" | "reschedule" | null) => void;
  panel: RefObject<HTMLDivElement | null>;
};

function useAppointmentDialogState(
  id: string,
  {
    embedded,
    onPendingChange,
  }: {
    embedded: boolean;
    onPendingChange: ((pending: boolean) => void) | undefined;
  },
): AppointmentDialogState {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setOpen(true);
  }, [id]);
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [footerTarget, setFooterTarget] = useState<HTMLDivElement | null>(null);
  const [action, setAction] = useState<"cancel" | "reschedule" | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!embedded || action) return;
    const frame = requestAnimationFrame(() =>
      panel.current?.querySelector<HTMLButtonElement>("button")?.focus(),
    );
    return () => cancelAnimationFrame(frame);
  }, [embedded, action]);
  useEffect(() => {
    onPendingChange?.(pending);
    return () => onPendingChange?.(false);
  }, [pending, onPendingChange]);
  return {
    open,
    editing,
    setEditing,
    pending,
    setPending,
    footerTarget,
    setFooterTarget,
    action,
    setAction,
    panel,
  };
}

function AppointmentDialogShell({
  id,
  open,
  pending,
  onClose,
  content,
}: {
  id: string;
  open: boolean;
  pending: boolean;
  onClose: () => void;
  content: ReactJSX.Element;
}): ReactJSX.Element {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !pending) onClose();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent
          className="md:max-w-4xl md:w-[calc(100%-2rem)]"
          showCloseButton={!pending}
          finalFocus={() => document.querySelector<HTMLElement>(`#appointment-cell-${id}`)}
        >
          {content}
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}

type AppointmentDialogViewProps = {
  onReturn: (() => void) | undefined;
  onOpenLesson: ((id: string) => void) | undefined;
  id: string;
  admin: boolean;
  readOnly: boolean;
  onSelect: (id: string) => void;
  query: {
    data: Appointment | undefined;
    isPending: boolean;
    error: { message: string } | null;
    refetch: () => void;
  };
  editing: boolean;
  setEditing: (editing: boolean) => void;
  pending: boolean;
  setPending: (pending: boolean) => void;
  footerTarget: HTMLDivElement | null;
  setFooterTarget: (target: HTMLDivElement | null) => void;
  action: "cancel" | "reschedule" | null;
  setAction: (action: "cancel" | "reschedule" | null) => void;
};

function AppointmentDialogView(props: AppointmentDialogViewProps): ReactJSX.Element {
  const { admin, query, pending } = props;
  return (
    <>
      {props.onReturn && (
        <div className="mb-3">
          <Button variant="ghost" size="sm" disabled={pending} onClick={props.onReturn}>
            <ArrowLeft aria-hidden="true" /> Voltar à agenda
          </Button>
        </div>
      )}
      {query.data ? (
        <AppointmentDialogHeader
          data={query.data}
          admin={admin}
          onOpenLesson={props.onOpenLesson}
        />
      ) : (
        <AppointmentLoadingHeader />
      )}
      <AppointmentDialogMain {...props} />
      <AppointmentDialogFooter {...props} />
      <AppointmentActionDialogs {...props} />
    </>
  );
}

function AppointmentDialogMain({
  id,
  query,
  editing,
  footerTarget,
  setPending,
  setEditing,
}: AppointmentDialogViewProps): ReactJSX.Element {
  return (
    <DialogBody>
      <div className={styles.body}>
        {query.isPending ? (
          <AppointmentLoadingBody />
        ) : (
          <RecordState pending={false} error={query.error} retry={() => void query.refetch()} />
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
                document.querySelector<HTMLElement>(`#appointment-edit-${id}`)?.focus(),
              );
            }}
          />
        )}
      </div>
    </DialogBody>
  );
}

function AppointmentDialogFooter({
  query,
  editing,
  readOnly,
  admin,
  setEditing,
  setAction,
  onSelect,
  setFooterTarget,
}: AppointmentDialogViewProps): ReactJSX.Element | null {
  if (query.isPending) return <AppointmentLoadingFooter />;
  if (!query.data) return null;
  return (
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
  );
}

function AppointmentActionDialogs({
  query,
  action,
  setAction,
}: AppointmentDialogViewProps): ReactJSX.Element | null {
  if (!query.data) return null;
  if (action === "cancel")
    return <CancelAppointmentDialog row={query.data.snapshot} onClose={() => setAction(null)} />;
  if (action === "reschedule")
    return (
      <ScheduleAppointmentDialog previous={query.data.snapshot} onClose={() => setAction(null)} />
    );
  return null;
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
}): ReactJSX.Element {
  const row = data.snapshot;
  const previousId = row.rescheduledFromId;
  const nextId = data.rescheduledToId;
  return (
    <div className={styles.toolbar}>
      <AppointmentSecondaryActions
        scheduled={row.status === "SCHEDULED"}
        admin={admin}
        previousId={previousId}
        nextId={nextId}
        setAction={setAction}
        onSelect={onSelect}
      />
      {!data.restriction && (
        <Button
          id={`appointment-edit-${row.id}`}
          size="sm"
          variant="primary"
          onClick={() => setEditing(true)}
        >
          {row.status === "SCHEDULED" ? <ArrowRight /> : <Pencil />}
          {row.status === "SCHEDULED" ? "Registrar atendimento" : "Corrigir registro"}
        </Button>
      )}
    </div>
  );
}

function AppointmentSecondaryActions({
  scheduled,
  admin,
  previousId,
  nextId,
  setAction,
  onSelect,
}: {
  scheduled: boolean;
  admin: boolean;
  previousId: string | null;
  nextId: string | null;
  setAction: (value: "cancel" | "reschedule") => void;
  onSelect: (id: string) => void;
}): ReactJSX.Element {
  return (
    <div className={styles.secondaryActions}>
      {scheduled && admin && (
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
}): ReactJSX.Element {
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
      <AppointmentNotices data={data} restriction={restriction} />
      {editing ? (
        <AppointmentRecordForm
          data={data}
          onClose={onFinish}
          context={context}
          footerTarget={footerTarget}
          onPendingChange={onPendingChange}
        />
      ) : (
        <AppointmentOverview data={data} planning={planning} />
      )}
      <AppointmentDialogHistory data={data} />
      {row.purpose === "ASSESSMENT" && (
        <AppointmentAssessmentFiles id={row.id} studentId={row.student.id} />
      )}
    </>
  );
}

function AppointmentNotices({
  data,
  restriction,
}: {
  data: Appointment;
  restriction: string | null;
}): ReactJSX.Element {
  const row = data.snapshot;
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
    </>
  );
}

function AppointmentOverview({
  data,
  planning,
}: {
  data: Appointment;
  planning: string | undefined;
}): ReactJSX.Element {
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
        <AppointmentAccount row={data.snapshot} rescheduled={Boolean(data.rescheduledToId)} />
      </section>
    </div>
  );
}
