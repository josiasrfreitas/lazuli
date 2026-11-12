"use client";
import Link from "next/link";
import { formatDateOnlyBR } from "~/lib/format";
import { Alert, Button } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import type { AcademicYear } from "./model";
export function CalendarProcessing({
  requests,
  planWarnings,
}: Pick<AcademicYear, "requests" | "planWarnings">) {
  const utils = trpc.useUtils();
  const retry = trpc.calendar.academic.changes.retry.useMutation({
    onSuccess: () => utils.calendar.academic.invalidate(),
  });
  const active = requests.filter((row) => row.status !== "SUCCEEDED");
  const completed = requests.find(
    (row) =>
      row.status === "SUCCEEDED" &&
      row.completedAt &&
      Date.now() - row.completedAt.getTime() < 600000,
  );
  if (!active.length && !completed && !planWarnings.length) return null;
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
      {planWarnings.length > 0 && (
        <details>
          <summary className="cursor-pointer text-caption">
            Revisar datas de {planWarnings.length} itens do plano fora do calendário
          </summary>
          <ul className="mt-2 grid gap-2 text-caption">
            {planWarnings.map((row) => (
              <li key={row.id}>
                {row.classId ? (
                  <Link
                    className="text-interactive underline"
                    href={`/turmas/${row.classId}?secao=planejamento`}
                  >
                    {row.name}
                  </Link>
                ) : (
                  row.name
                )}{" "}
                · {row.title} · {formatDateOnlyBR(row.date)}
              </li>
            ))}
          </ul>
        </details>
      )}
      {active.map((row) => {
        const recoverable =
          row.status === "FAILED" ||
          (row.status === "RUNNING" &&
            row.startedAt &&
            Date.now() - row.startedAt.getTime() > 300000);
        return (
          <Alert key={row.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                {row.reason} ·{" "}
                {recoverable
                  ? "A atualização das atividades não foi concluída."
                  : "Calendário salvo. Atualizando as atividades…"}
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
      })}
      {retry.error && <Alert>{retry.error.message}</Alert>}
    </div>
  );
}
