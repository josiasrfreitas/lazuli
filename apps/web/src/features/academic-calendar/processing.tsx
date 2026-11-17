"use client";
import { useEffect, type ReactElement } from "react";
import Link from "next/link";
import { Alert, Button } from "@lazuli/ui";
import { notifyCalendarExecution } from "./execution-notifications";
import { trpc } from "~/lib/trpc";
import type { AcademicYear } from "./model";
const COMPLETION_NOTICE_MS = 600_000;
const RETRY_TIMEOUT_MS = 300_000;
export function CalendarProcessing({
  requests,
}: Pick<AcademicYear, "requests">): ReactElement | null {
  const utils = trpc.useUtils();
  const completionKey = requests
    .filter((row) => row.status === "SUCCEEDED")
    .map((row) => row.id)
    .toSorted()
    .join(",");
  useEffect(() => {
    if (!completionKey) return;
    void Promise.all([
      utils.classRecords.invalidate(),
      utils.appointments.invalidate(),
      utils.admissions.invalidate(),
      utils.planning.invalidate(),
      utils.sessionGeneration.invalidate(),
      utils.classes.invalidate(),
      utils.teachers.invalidate(),
      utils.teacherWorkspace.invalidate(),
      utils.students.invalidate(),
      utils.attendance.invalidate(),
      utils.dashboard.invalidate(),
      utils.activity.invalidate(),
    ]);
  }, [completionKey, utils]);
  const retry = trpc.calendar.academic.changes.retry.useMutation({
    onSuccess: async ({ id, dispatched }) => {
      notifyCalendarExecution({ id: id, state: dispatched ? "QUEUED" : "UNAVAILABLE" });
      await utils.calendar.academic.invalidate();
    },
  });
  const active = requests.filter((row) => row.status !== "SUCCEEDED");
  const completed = requests.find(
    (row) =>
      row.status === "SUCCEEDED" &&
      row.completedAt &&
      Date.now() - row.completedAt.getTime() < COMPLETION_NOTICE_MS,
  );
  if (active.length === 0 && !completed) return null;
  return (
    <div className="grid gap-2" role="status">
      {completed && (
        <p className="text-caption text-muted-foreground">
          Calendário atualizado. Cancelamentos: {completed.cancelledSessions} em aulas,{" "}
          {completed.cancelledAppointments} em atendimentos e {completed.cancelledVisits} em
          visitas.{" "}
          <Link className="text-interactive underline" href="/aulas">
            Conferir Agenda
          </Link>
        </p>
      )}
      {active.map((row) => (
        <ActiveRequest key={row.id} row={row} retry={retry} />
      ))}
      {retry.error && <Alert>{retry.error.message}</Alert>}
    </div>
  );
}

function ActiveRequest({
  row,
  retry,
}: {
  row: AcademicYear["requests"][number];
  retry: ReturnType<typeof trpc.calendar.academic.changes.retry.useMutation>;
}): ReactElement {
  const recoverable =
    row.status === "FAILED" ||
    (row.status === "RUNNING" &&
      row.startedAt &&
      Date.now() - row.startedAt.getTime() > RETRY_TIMEOUT_MS);
  const pendingMessage =
    row.status === "PENDING"
      ? "Calendário salvo. Aguardando atualização das atividades."
      : "Atualizando as atividades…";
  return (
    <Alert key={row.id}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>
          {row.reason} ·{" "}
          {recoverable ? "A atualização das atividades não foi concluída." : pendingMessage}
        </span>
        {recoverable && (
          <Button
            size="sm"
            variant="secondary"
            disabled={retry.isPending}
            onClick={() => retry.mutate({ id: row.id })}
          >
            Tentar novamente
          </Button>
        )}
      </div>
    </Alert>
  );
}
