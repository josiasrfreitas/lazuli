"use client";
import { useState } from "react";
import { Button } from "@lazuli/ui";
import { AcademicEventFields, eventDraftSchema, type EventDraft } from "./event-fields";
import { formatDateOnlyBR } from "~/lib/format";
import { parseDateBR } from "~/lib/masks";
import { TaskDialog, useValidation } from "~/features/shared/task-form";
import type { AcademicYear } from "./model";
import { trpc } from "~/lib/trpc";

const localInput = (value: Date) =>
  new Date(value.getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 16);
export function AcademicEventForm({
  onClose,
  item: initialItem,
}: {
  onClose: () => void;
  item?: AcademicYear["events"][number] | undefined;
}) {
  const [item] = useState(initialItem);
  const [values, setValues] = useState<EventDraft>(() => ({
    title: item?.title ?? "",
    description: item?.description ?? "",
    startDate: item ? formatDateOnlyBR(localInput(item.startsAt).slice(0, 10)) : "",
    startTime: item ? localInput(item.startsAt).slice(11, 16) : "",
    endDate: item ? formatDateOnlyBR(localInput(item.endsAt).slice(0, 10)) : "",
    endTime: item ? localInput(item.endsAt).slice(11, 16) : "",
  }));
  const validation = useValidation();
  const utils = trpc.useUtils();
  const save = trpc.calendar.academic.saveEvent.useMutation({
    onSuccess: async () => {
      await utils.calendar.academic.invalidate();
      onClose();
    },
  });
  const [confirmRemoval, setConfirmRemoval] = useState(false);
  const remove = trpc.calendar.academic.removeEvent.useMutation({
    onSuccess: async () => {
      await utils.calendar.academic.invalidate();
      onClose();
    },
  });
  return (
    <TaskDialog
      compactHeader
      actionSize="sm"
      title={item ? "Editar evento" : "Novo evento"}
      description="O evento aparece no calendário e não suspende as aulas."
      formId="academic-event"
      firstField="event-title"
      submitLabel="Salvar evento"
      onClose={onClose}
      pending={save.isPending || remove.isPending}
      error={save.error?.message ?? remove.error?.message}
      bodyRef={validation.body}
    >
      <AcademicEventFields
        values={values}
        errors={validation.errors}
        pending={save.isPending || remove.isPending}
        change={(name, value) => {
          setValues((current) => ({ ...current, [name]: value }));
          validation.clear(name);
        }}
        submit={(event) => {
          event.preventDefault();
          if (save.isPending || remove.isPending) return;
          const parsed = validation.validate(eventDraftSchema, values);
          if (!parsed) return;
          save.mutate({
            ...(item ? { id: item.id, expectedUpdatedAt: item.updatedAt.toISOString() } : {}),
            title: parsed.title,
            description: parsed.description,
            startsAt: `${parseDateBR(parsed.startDate)}T${parsed.startTime}:00-03:00`,
            endsAt: `${parseDateBR(parsed.endDate)}T${parsed.endTime}:00-03:00`,
          });
        }}
      />
      {item && (
        <div>
          {confirmRemoval ? (
            <>
              <p>Remover este evento do calendário?</p>
              <Button
                type="button"
                variant="secondary"
                disabled={remove.isPending || save.isPending}
                onClick={() =>
                  remove.mutate({ id: item.id, expectedUpdatedAt: item.updatedAt.toISOString() })
                }
              >
                Confirmar remoção
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={remove.isPending || save.isPending}
                onClick={() => setConfirmRemoval(false)}
              >
                Manter evento
              </Button>
            </>
          ) : (
            <Button type="button" variant="ghost" onClick={() => setConfirmRemoval(true)}>
              Remover evento
            </Button>
          )}
        </div>
      )}
    </TaskDialog>
  );
}
