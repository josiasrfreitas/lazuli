"use client";
import { useState, type ReactElement } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarClock, Pencil, X } from "lucide-react";
import { Alert, Button, Tabs, TabsList, TabsTab } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { formatDateOnlyBR } from "~/lib/format";
import { ClassRecordTrigger } from "~/features/class-records/class-record-trigger";
import { RecordState } from "~/features/class-records/shared";
import { AppointmentRecordForm } from "./record-form";
import { ScheduleAppointmentDialog } from "./schedule-dialog";
import { AppointmentAccount } from "./account";
import { AppointmentHistory } from "./detail-history";
import { CancelAppointmentDialog } from "./cancel-dialog";
import {
  AppointmentBadge,
  purposes,
  isRescheduled,
  appointmentRestriction,
  appointmentStamp,
  type Appointment,
} from "./shared";
export { AppointmentAccount } from "./account";
export { CancelAppointmentDialog } from "./cancel-dialog";

const DETAIL_POLL_MS = 30_000;
const UNKNOWN_AUTHOR = "autoria não registrada";
type Action = "cancel" | "reschedule" | null;
type DetailContext = { data: Appointment; admin: boolean; embedded?: boolean };
type DetailState = ReturnType<typeof useDetailState>;
function useDetailState(): {
  view: string;
  setView: (view: string) => void;
  editing: boolean;
  setEditing: (editing: boolean) => void;
  action: Action;
  setAction: (action: Action) => void;
} {
  const [view, setView] = useState("record");
  const [editing, setEditing] = useState(false);
  const [action, setAction] = useState<Action>(null);
  return { view, setView, editing, setEditing, action, setAction };
}
export function AppointmentDetailPage({ id }: { id: string }): ReactElement {
  const query = trpc.appointments.detail.useQuery(
    { id },
    {
      retry: false,
      refetchInterval: (current) =>
        current.state.data?.snapshot.status === "SCHEDULED" ? DETAIL_POLL_MS : false,
    },
  );
  const me = trpc.me.useQuery();
  const admin = me.data?.role === "ADMIN" || me.data?.role === "SYSTEM_ADMIN";
  return (
    <div className="mx-auto grid h-full w-full max-w-6xl content-start gap-6 overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div>
        <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/aulas" />}>
          <ArrowLeft /> Agenda
        </Button>
      </div>
      <RecordState
        pending={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      {query.data && <AppointmentContent key={id} data={query.data} admin={admin} />}
    </div>
  );
}
export function AppointmentContent(props: DetailContext): ReactElement {
  const state = useDetailState();
  const { data } = props;
  return (
    <>
      <AppointmentHeader context={props} state={state} />
      <AppointmentNotices data={data} />
      <div className="grid min-w-0 items-start gap-6 lg:grid-cols-3">
        <AppointmentAside {...props} />
        <AppointmentRecord data={data} state={state} />
      </div>
      {state.action === "cancel" && (
        <CancelAppointmentDialog row={data.snapshot} onClose={() => state.setAction(null)} />
      )}
      {state.action === "reschedule" && (
        <ScheduleAppointmentDialog previous={data.snapshot} onClose={() => state.setAction(null)} />
      )}
    </>
  );
}
function AppointmentHeader({
  context,
  state,
}: {
  context: DetailContext;
  state: DetailState;
}): ReactElement {
  const { data, embedded } = context;
  const Heading = embedded ? "h3" : "h1";
  const row = data.snapshot;
  return (
    <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
      <div className="grid gap-2">
        <span className="text-caption text-muted-foreground">
          {formatDateOnlyBR(row.date)} · {row.startTime}–{row.endTime}
        </span>
        <Heading className="font-display text-h2 font-semibold text-heading">
          {embedded ? purposes[row.purpose] : row.student.name}
        </Heading>
        <p className="text-sm text-muted-foreground">
          {purposes[row.purpose]} · {row.teacher?.name ?? "Professor a definir"}
        </p>
      </div>
      <AppointmentActions context={context} state={state} />
    </header>
  );
}
function AppointmentActions({
  context: { data, admin },
  state,
}: {
  context: DetailContext;
  state: DetailState;
}): ReactElement {
  const row = data.snapshot;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <AppointmentBadge status={row.status} rescheduled={isRescheduled(data)} />
      {row.status === "SCHEDULED" && admin && (
        <>
          <Button variant="secondary" onClick={() => state.setAction("reschedule")}>
            <CalendarClock aria-hidden="true" /> Reagendar
          </Button>
          <Button variant="ghost" onClick={() => state.setAction("cancel")}>
            <X aria-hidden="true" /> Cancelar atendimento
          </Button>
        </>
      )}
      {!data.restriction && row.status !== "SCHEDULED" && !state.editing && (
        <Button
          variant="secondary"
          onClick={() => {
            state.setEditing(true);
            state.setView("record");
          }}
        >
          <Pencil aria-hidden="true" /> Corrigir registro
        </Button>
      )}
    </div>
  );
}
function AppointmentNotices({ data }: { data: Appointment }): ReactElement {
  const restriction = appointmentRestriction(data);
  return (
    <>
      {data.snapshot.version === 0 && (
        <Alert>
          Registro anterior aos atendimentos. Informações não registradas permanecem em aberto;
          faltas só são compensadas após a associação de uma origem verificada.
        </Alert>
      )}
      {restriction && (
        <Alert>
          {restriction}
          {data.snapshot.cancellationReason ? ` ${data.snapshot.cancellationReason}` : ""}
        </Alert>
      )}
    </>
  );
}
function AppointmentAside({ data, admin, embedded }: DetailContext): ReactElement {
  const row = data.snapshot;
  return (
    <aside className="grid gap-5 rounded-md border border-border bg-card p-5">
      <AppointmentMeeting data={data} />
      {row.plannedContent && (
        <div className="grid gap-2 border-t border-border pt-4">
          <h2 className="text-sm font-semibold">Previsto para o encontro</h2>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{row.plannedContent}</p>
        </div>
      )}
      <AppointmentAuthorship data={data} />
      {admin && !embedded && (
        <Link
          href={`/alunos/${row.student.id}`}
          className="text-sm font-medium text-interactive hover:underline"
        >
          Ver perfil do aluno
        </Link>
      )}
      <ReschedulingLinks data={data} />
    </aside>
  );
}
function AppointmentMeeting({ data: { snapshot: row } }: { data: Appointment }): ReactElement {
  return (
    <div className="grid gap-1">
      <h2 className="text-caption font-semibold text-muted-foreground">Encontro</h2>
      {row.targetClassSessionId ? (
        <ClassRecordTrigger sessionId={row.targetClassSessionId}>
          {row.targetClassName} · Abrir aula
        </ClassRecordTrigger>
      ) : (
        <p className="text-sm">Atendimento individual</p>
      )}
      <p className="text-caption text-muted-foreground">
        {row.format === "IN_PERSON" ? "Presencial" : "Online"}
      </p>
    </div>
  );
}
function AppointmentAuthorship({ data }: { data: Appointment }): ReactElement {
  const row = data.snapshot;
  return (
    <div className="grid gap-2 border-t border-border pt-4 text-caption text-muted-foreground">
      <p>
        Agendado por {row.scheduledBy?.name ?? UNKNOWN_AUTHOR}
        <br />
        {appointmentStamp(row.scheduledAt)}
      </p>
      {row.recordedAt && (
        <p>
          Registrado por {row.recordedBy?.name ?? UNKNOWN_AUTHOR}
          <br />
          {appointmentStamp(row.recordedAt)}
        </p>
      )}
      {row.cancelledAt && (
        <p>
          {isRescheduled(data) ? "Reagendado por" : "Cancelado por"}{" "}
          {row.cancelledBy?.name ?? UNKNOWN_AUTHOR}
          <br />
          {appointmentStamp(row.cancelledAt)}
        </p>
      )}
    </div>
  );
}
function ReschedulingLinks({ data }: { data: Appointment }): ReactElement {
  return (
    <>
      {data.snapshot.rescheduledFromId && (
        <Link
          href={`/atendimentos/${data.snapshot.rescheduledFromId}`}
          className="text-caption text-interactive hover:underline"
        >
          Ver agendamento anterior
        </Link>
      )}
      {data.rescheduledToId && (
        <Link
          href={`/atendimentos/${data.rescheduledToId}`}
          className="text-caption text-interactive hover:underline"
        >
          Abrir novo agendamento
        </Link>
      )}
    </>
  );
}
function AppointmentRecord({
  data,
  state,
}: {
  data: Appointment;
  state: DetailState;
}): ReactElement {
  const editable = !data.restriction && (data.snapshot.status === "SCHEDULED" || state.editing);
  return (
    <section className="grid min-w-0 gap-5 lg:col-span-2">
      {!editable && (
        <Tabs variant="underline" value={state.view} onValueChange={state.setView}>
          <TabsList aria-label="Registro do atendimento">
            <TabsTab value="record">Registro atual</TabsTab>
            <TabsTab value="history">Histórico de alterações · {data.history.length}</TabsTab>
          </TabsList>
        </Tabs>
      )}
      <RecordBody data={data} state={state} editable={editable} />
    </section>
  );
}
function RecordBody({
  data,
  state,
  editable,
}: {
  data: Appointment;
  state: DetailState;
  editable: boolean;
}): ReactElement {
  if (editable)
    return <AppointmentRecordForm data={data} onClose={() => state.setEditing(false)} />;
  if (state.view === "history") return <AppointmentHistory data={data} />;
  return <AppointmentAccount row={data.snapshot} rescheduled={isRescheduled(data)} />;
}
