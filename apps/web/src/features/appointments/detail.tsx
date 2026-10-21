"use client";
import type { JSX as ReactJSX } from "react";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarClock, Pencil, X } from "lucide-react";
import { Alert, Button, Tabs, TabsList, TabsTab } from "@lazuli/ui";
import { appointmentCancelSchema, type AppointmentSnapshot } from "@lazuli/validators";
import { trpc } from "~/lib/trpc";
import { formatDateOnlyBR } from "~/lib/format";
import { ClassRecordTrigger } from "~/features/class-records/class-record-trigger";
import { RecordState } from "~/features/class-records/shared";
import { NarrativeField, TaskDialog, useValidation } from "~/features/shared/task-form";
import { AppointmentAccount } from "./appointment-account";
import { AppointmentRecordForm } from "./record-form";
import { ScheduleAppointmentDialog } from "./schedule-dialog";
import { AppointmentBadge, purposes, useAppointmentRefresh, type Appointment } from "./shared";

const stamp = (value: string | Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
export function AppointmentDetailPage({ id }: { id: string }): ReactJSX.Element {
  const query = trpc.appointments.detail.useQuery(
    { id },
    {
      retry: false,
      refetchInterval: (current) =>
        current.state.data?.snapshot.status === "SCHEDULED" ? 30_000 : false,
    },
  );
  const me = trpc.me.useQuery();
  const admin = me.data?.role === "ADMIN" || me.data?.role === "SYSTEM_ADMIN";
  return (
    <div className="mx-auto grid h-full w-full max-w-6xl content-start gap-6 overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div>
        <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/aulas" />}>
          <ArrowLeft />
          Agenda
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
export function AppointmentContent({
  data,
  admin,
  embedded = false,
}: {
  data: Appointment;
  admin: boolean;
  embedded?: boolean;
}): ReactJSX.Element {
  const Heading = embedded ? "h3" : "h1";
  const row = data.snapshot;
  const [view, setView] = useState("record");
  const [editing, setEditing] = useState(false);
  const [action, setAction] = useState<"cancel" | "reschedule" | null>(null);
  const editable = !data.restriction && (row.status === "SCHEDULED" || editing);
  return (
    <>
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
        <div className="flex flex-wrap items-center gap-2">
          <AppointmentBadge status={row.status} rescheduled={Boolean(data.rescheduledToId)} />
          {row.status === "SCHEDULED" && admin && (
            <>
              <Button variant="secondary" onClick={() => setAction("reschedule")}>
                <CalendarClock aria-hidden="true" />
                Reagendar
              </Button>
              <Button variant="ghost" onClick={() => setAction("cancel")}>
                <X aria-hidden="true" />
                Cancelar atendimento
              </Button>
            </>
          )}
          {!data.restriction && row.status !== "SCHEDULED" && !editing && (
            <Button
              variant="secondary"
              onClick={() => {
                setEditing(true);
                setView("record");
              }}
            >
              <Pencil aria-hidden="true" />
              Corrigir registro
            </Button>
          )}
        </div>
      </header>
      {row.version === 0 && (
        <Alert>
          Registro anterior aos atendimentos. Informações não registradas permanecem em aberto;
          faltas só são compensadas após a associação de uma origem verificada.
        </Alert>
      )}
      {data.restriction && (
        <Alert>
          {data.restriction}
          {row.cancellationReason ? ` ${row.cancellationReason}` : ""}
        </Alert>
      )}
      <div className="grid min-w-0 items-start gap-6 lg:grid-cols-3">
        <aside className="grid gap-5 rounded-md border border-border bg-card p-5">
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
          {row.plannedContent && (
            <div className="grid gap-2 border-t border-border pt-4">
              <h2 className="text-sm font-semibold">Previsto para o encontro</h2>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {row.plannedContent}
              </p>
            </div>
          )}
          <div className="grid gap-2 border-t border-border pt-4 text-caption text-muted-foreground">
            <p>
              Agendado por {row.scheduledBy?.name ?? "autoria não registrada"}
              <br />
              {stamp(row.scheduledAt)}
            </p>
            {row.recordedAt && (
              <p>
                Registrado por {row.recordedBy?.name ?? "autoria não registrada"}
                <br />
                {stamp(row.recordedAt)}
              </p>
            )}
            {row.cancelledAt && (
              <p>
                {data.rescheduledToId ? "Reagendado" : "Cancelado"} por{" "}
                {row.cancelledBy?.name ?? "autoria não registrada"}
                <br />
                {stamp(row.cancelledAt)}
              </p>
            )}
          </div>
          {admin && !embedded && (
            <Link
              href={`/alunos/${row.student.id}`}
              className="text-sm font-medium text-interactive hover:underline"
            >
              Ver perfil do aluno
            </Link>
          )}
          {row.rescheduledFromId && (
            <Link
              href={`/atendimentos/${row.rescheduledFromId}`}
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
        </aside>
        <section className="grid min-w-0 gap-5 lg:col-span-2">
          {!editable && (
            <Tabs variant="underline" value={view} onValueChange={setView}>
              <TabsList aria-label="Registro do atendimento">
                <TabsTab value="record">Registro atual</TabsTab>
                <TabsTab value="history">Histórico de alterações · {data.history.length}</TabsTab>
              </TabsList>
            </Tabs>
          )}
          {editable ? (
            <AppointmentRecordForm data={data} onClose={() => setEditing(false)} />
          ) : view === "history" ? (
            <div className="grid gap-3">
              {data.history.map((revision) => (
                <details key={revision.id} className="rounded-md border border-border bg-card p-4">
                  <summary className="cursor-pointer text-sm">
                    <span className="font-medium">
                      {revision.author?.name ?? "Autoria não registrada"}
                    </span>
                    <span className="mt-1 block text-caption text-muted-foreground">
                      {stamp(revision.at)} ·{" "}
                      {revision.kind === "SCHEDULED"
                        ? "Agendamento"
                        : revision.kind === "IMPORTED"
                          ? "Registro anterior"
                          : revision.kind === "RESCHEDULED"
                            ? "Reagendamento"
                            : revision.kind === "CANCELLED"
                              ? "Cancelamento"
                              : revision.kind === "CORRECTED"
                                ? "Correção"
                                : "Registro"}
                    </span>
                  </summary>
                  <div className="mt-4 grid gap-4">
                    {revision.reason && (
                      <p className="text-caption text-muted-foreground">{revision.reason}</p>
                    )}
                    <AppointmentAccount row={revision.snapshot} />
                  </div>
                </details>
              ))}
              {data.history.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  O próximo registro preservará a informação legada no histórico.
                </p>
              )}
            </div>
          ) : (
            <AppointmentAccount row={row} rescheduled={Boolean(data.rescheduledToId)} />
          )}
        </section>
      </div>
      {action === "cancel" && <CancelAppointmentDialog row={row} onClose={() => setAction(null)} />}
      {action === "reschedule" && (
        <ScheduleAppointmentDialog previous={row} onClose={() => setAction(null)} />
      )}
    </>
  );
}
export function CancelAppointmentDialog({
  row,
  onClose,
}: {
  row: AppointmentSnapshot;
  onClose: () => void;
}): ReactJSX.Element {
  const [reason, setReason] = useState("");
  const validation = useValidation();
  const refresh = useAppointmentRefresh();
  const mutation = trpc.appointments.cancel.useMutation({
    onSuccess: async () => {
      await refresh();
      onClose();
    },
  });
  return (
    <TaskDialog
      title="Cancelar atendimento"
      description={`${row.student.name} · ${formatDateOnlyBR(row.date)} às ${row.startTime}`}
      firstField="cancel-reason"
      formId="appointment-cancel"
      submitLabel="Confirmar cancelamento"
      submitVariant="destructive"
      pending={mutation.isPending}
      onClose={onClose}
      error={mutation.error?.message}
      bodyRef={validation.body}
    >
      <form
        id="appointment-cancel"
        noValidate
        className="grid gap-4 pt-4"
        onSubmit={(event) => {
          event.preventDefault();
          const parsed = validation.validate(appointmentCancelSchema, {
            id: row.id,
            expectedVersion: row.version,
            reason,
          });
          if (parsed && !mutation.isPending) mutation.mutate(parsed);
        }}
      >
        <p className="text-sm text-muted-foreground">
          O histórico será preservado e os minutos reservados ficarão disponíveis para outra
          reposição.
        </p>
        <NarrativeField
          name="cancel-reason"
          label="Motivo"
          placeholder="Por que o atendimento foi cancelado"
          value={reason}
          onChange={(value) => {
            setReason(value);
            validation.clear("reason");
          }}
          error={validation.errors.reason}
        />
      </form>
    </TaskDialog>
  );
}
