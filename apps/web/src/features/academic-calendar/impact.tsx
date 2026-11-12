"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { RouterOutputs } from "@lazuli/api";
import { Alert } from "@lazuli/ui";
import { TaskDialog } from "~/features/shared/task-form";
import { formatDateOnlyBR } from "~/lib/format";
import { trpc } from "~/lib/trpc";
import type { CalendarChange } from "./change-form";

type Preview = RouterOutputs["calendar"]["academic"]["changes"]["preview"];
const hours = (minutes: number) =>
  `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(minutes / 60)} h`;
export function CalendarImpact({
  change,
  preview,
  onBack,
  onClose,
  onSaved,
  embedded = false,
  onPendingChange,
}: {
  embedded?: boolean;
  onPendingChange?: ((pending: boolean) => void) | undefined;
  change: CalendarChange;
  preview: Preview;
  onBack: () => void;
  onClose: () => void;
  onSaved?: ((semesterId: string) => void) | undefined;
}) {
  const [commandId] = useState(() => crypto.randomUUID());
  const utils = trpc.useUtils();
  const confirm = trpc.calendar.academic.changes.confirm.useMutation({
    onSuccess: async (result) => {
      await Promise.all([utils.calendar.invalidate(), utils.semesterOrganization.invalidate()]);
      if (result.semesterId) onSaved?.(result.semesterId);
      onClose();
    },
  });
  useEffect(() => {
    onPendingChange?.(confirm.isPending);
    return () => onPendingChange?.(false);
  }, [confirm.isPending, onPendingChange]);
  const total = preview.sessions.length + preview.appointments.length + preview.visits.length;
  return (
    <TaskDialog
      embedded={embedded}
      compactHeader
      size="medium"
      actionSize="sm"
      title="Conferir alteração"
      description={`${preview.subject} · ${formatDateOnlyBR("from" in change ? change.from : preview.from)} a ${formatDateOnlyBR("through" in change ? change.through : preview.through)}`}
      formId="calendar-confirm"
      firstField="calendar-confirm-submit"
      submitLabel="Confirmar e aplicar"
      pending={confirm.isPending}
      onBack={onBack}
      onClose={onClose}
      error={confirm.error?.message}
    >
      <form
        id="calendar-confirm"
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!confirm.isPending)
            confirm.mutate({ change, fingerprint: preview.fingerprint, commandId });
        }}
      >
        <p>
          {total
            ? `${total} atividades futuras serão canceladas. Confira os detalhes antes de aplicar.`
            : "Nenhuma atividade futura precisa ser cancelada."}{" "}
          {preview.preserved > 0 &&
            `${preview.preserved} ${preview.preserved === 1 ? "registro passado, iniciado ou com informações registradas será preservado" : "registros passados, iniciados ou com informações registradas serão preservados"}.`}
        </p>
        {(
          [
            ["Aulas regulares", preview.sessions],
            ["Atendimentos", preview.appointments],
            ["Aulas experimentais e visitas", preview.visits],
          ] as const
        ).map(([label, entries]) => (
          <details key={label} className="border-b border-border pb-2">
            <summary className="cursor-pointer text-body font-medium">
              {label} · {entries.length}
            </summary>
            {entries.length ? (
              <ul className="mt-2 grid gap-2 text-caption">
                {entries.map((row) => (
                  <li key={row.id} className="flex flex-wrap justify-between gap-x-3">
                    <span>{row.name}</span>
                    <span className="text-muted-foreground">
                      {formatDateOnlyBR(row.date)} · {row.startTime}–{row.endTime}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-caption text-muted-foreground">Nenhuma atividade afetada.</p>
            )}
          </details>
        ))}
        {preview.plans.length > 0 && (
          <details>
            <summary className="cursor-pointer font-medium">
              Itens do plano que precisam de nova data · {preview.plans.length}
            </summary>
            <ul className="mt-2 grid gap-2 text-caption">
              {preview.plans.map((row) => (
                <li key={row.id}>
                  {row.classId ? (
                    <Link className="text-interactive underline" href={`/turmas/${row.classId}`}>
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
        {preview.capacity.some((row) => row.deficitMinutes && row.deficitMinutes > 0) && (
          <Alert>
            A carga disponível ficou abaixo do plano de uma ou mais turmas. Você pode salvar e
            decidir depois sobre reposição ou revisão do plano.
          </Alert>
        )}
        {preview.capacity.length > 0 && (
          <details>
            <summary className="cursor-pointer font-medium">Carga disponível das turmas</summary>
            <ul className="mt-2 grid gap-2 text-caption">
              {preview.capacity.map((row) => (
                <li key={row.classId} className="flex flex-wrap justify-between gap-x-3">
                  <span>{row.name}</span>
                  <span className="text-muted-foreground">
                    {hours(row.availableMinutes)} disponíveis ·{" "}
                    {row.requiredMinutes === null
                      ? "meta do plano não definida"
                      : `${hours(row.requiredMinutes)} no plano${row.deficitMinutes ? ` · faltam ${hours(row.deficitMinutes)}` : ""}`}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
        {preview.releasedDates.length > 0 && (
          <Alert>
            {preview.releasedDates.length} dias serão liberados. Aulas já canceladas não serão
            reativadas; confira o plano e reagende o que for necessário.
          </Alert>
        )}
        <p className="text-caption text-muted-foreground">
          O calendário passa a valer ao confirmar. A atualização das atividades aparece na Agenda;
          eventos e registros realizados permanecem disponíveis.
        </p>
      </form>
    </TaskDialog>
  );
}
