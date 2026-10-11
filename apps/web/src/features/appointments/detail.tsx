"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Alert, Button, Tabs, TabsList, TabsTab } from "@lazuli/ui";
import { appointmentCancelSchema, type AppointmentSnapshot } from "@lazuli/validators";
import { trpc } from "~/lib/trpc";
import { formatDateOnlyBR } from "~/lib/format";
import { RecordState } from "~/features/class-records/shared";
import { NarrativeField, TaskDialog, useValidation } from "~/features/shared/task-form";
import { AppointmentRecordForm } from "./record-form";
import { ScheduleAppointmentDialog } from "./schedule-dialog";
import { AppointmentBadge, purposes, useAppointmentRefresh, type Appointment } from "./shared";

const stamp = (value: string | Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
export function AppointmentDetailPage({ id }: { id: string }) {
  const query = trpc.appointments.detail.useQuery(
    { id },
    {
      retry: false,
      refetchInterval: (current) =>
        current.state.data?.snapshot.status === "SCHEDULED" ? 30000 : false,
    },
  );
  const me = trpc.me.useQuery();
  const admin = me.data?.role === "ADMIN" || me.data?.role === "SYSTEM_ADMIN";
  return (
    <div className="mx-auto grid h-full w-full max-w-6xl content-start gap-6 overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div>
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={<Link href="/atendimentos" />}
        >
          <ArrowLeft />
          Atendimentos
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
function AppointmentContent({ data, admin }: { data: Appointment; admin: boolean }) {
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
          <h1 className="font-display text-h2 font-semibold text-heading">{row.student.name}</h1>
          <p className="text-sm text-muted-foreground">
            {purposes[row.purpose]} · {row.teacher?.name ?? "Professor a definir"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AppointmentBadge status={row.status} />
          {row.status === "SCHEDULED" && admin && (
            <>
              <Button variant="secondary" onClick={() => setAction("reschedule")}>
                Reagendar
              </Button>
              <Button variant="ghost" onClick={() => setAction("cancel")}>
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
              <Link
                href={`/aulas/${row.targetClassSessionId}`}
                className="text-sm font-medium text-interactive hover:underline"
              >
                {row.targetClassName} · Abrir aula
              </Link>
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
                Cancelado por {row.cancelledBy?.name ?? "autoria não registrada"}
                <br />
                {stamp(row.cancelledAt)}
              </p>
            )}
          </div>
          {admin && (
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
                <TabsTab value="history">Histórico · {data.history.length}</TabsTab>
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
                      Versão {revision.version} ·{" "}
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
              {!data.history.length && (
                <p className="text-sm text-muted-foreground">
                  O próximo registro preservará a informação legada no histórico.
                </p>
              )}
            </div>
          ) : (
            <AppointmentAccount row={row} />
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
function AppointmentAccount({ row }: { row: AppointmentSnapshot }) {
  const activeMinutes = row.coverages
    .filter((item) => item.applicable)
    .reduce((sum, item) => sum + item.minutes, 0);
  return (
    <div className="grid gap-5">
      {row.status === "ATTENDED" ? (
        <section className="grid gap-2">
          <h2 className="text-lg font-semibold">
            {row.performedMinutes !== null
              ? `${row.performedMinutes} ${row.performedMinutes === 1 ? "minuto realizado" : "minutos realizados"}`
              : "Comparecimento registrado"}
          </h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {row.performedContent ?? "Conteúdo realizado não registrado."}
          </p>
          {row.purpose === "MAKEUP" && (
            <p className="text-caption text-muted-foreground">
              {activeMinutes} {activeMinutes === 1 ? "minuto compensado" : "minutos compensados"}{" "}
              nas faltas de origem.
            </p>
          )}
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">
          {row.status === "NO_SHOW"
            ? "O aluno não compareceu. As faltas continuam disponíveis para reposição."
            : row.status === "CANCELLED"
              ? "Agendamento cancelado; o histórico foi preservado."
              : "O comparecimento será registrado após o término do encontro."}
        </p>
      )}
      {row.coverages.length > 0 && (
        <section className="grid gap-3">
          <h2 className="text-sm font-semibold">Faltas vinculadas</h2>
          <div className="divide-y divide-border rounded-md border border-border">
            {row.coverages.map((source) => (
              <div
                key={source.attendanceId}
                className="flex flex-wrap items-center justify-between gap-2 p-3"
              >
                <div>
                  <p className="text-sm font-medium">
                    {formatDateOnlyBR(source.date)} · {source.sourceClassName}
                  </p>
                  <p className="text-caption text-muted-foreground">
                    {source.startTime}–{source.endTime}
                  </p>
                  {!source.applicable && (
                    <p className="text-caption text-warning">
                      A origem mudou; esta cobertura não entra na frequência.
                    </p>
                  )}
                </div>
                <span className="font-numeric text-sm tabular-nums">
                  {source.minutes} min{" "}
                  {row.status === "CANCELLED"
                    ? "liberados"
                    : row.status === "SCHEDULED"
                      ? "reservados"
                      : source.applicable
                        ? "compensados"
                        : "sem efeito"}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
      {row.notes && (
        <section className="grid gap-2 border-t border-border pt-4">
          <h2 className="text-sm font-semibold">Observação</h2>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{row.notes}</p>
        </section>
      )}
    </div>
  );
}
function CancelAppointmentDialog({
  row,
  onClose,
}: {
  row: AppointmentSnapshot;
  onClose: () => void;
}) {
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
