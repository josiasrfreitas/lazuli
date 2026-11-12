"use client";
import { useState } from "react";
import { Button, Field, Input, Label, Textarea } from "@lazuli/ui";
import { TaskDialog, useValidation } from "~/features/shared/task-form";
import type { AcademicYear } from "./model";
import { trpc } from "~/lib/trpc";

const localInput = (value: Date) =>
  new Date(value.getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 16);
export function AcademicEventForm({
  onClose,
  item,
}: {
  onClose: () => void;
  item?: AcademicYear["events"][number] | undefined;
}) {
  const [title, setTitle] = useState(item?.title ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [start, setStart] = useState(item ? localInput(item.startsAt) : "");
  const [end, setEnd] = useState(item ? localInput(item.endsAt) : "");
  const [error, setError] = useState<string>();
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
      description="Horários de São Paulo. O evento não suspende as aulas."
      formId="academic-event"
      firstField="event-title"
      submitLabel="Salvar evento"
      onClose={onClose}
      pending={save.isPending || remove.isPending}
      error={error ?? save.error?.message ?? remove.error?.message}
      bodyRef={validation.body}
    >
      <form
        id="academic-event"
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (save.isPending) return;
          const startsAt = `${start}:00-03:00`;
          const endsAt = `${end}:00-03:00`;
          if (!start || !end || new Date(endsAt) <= new Date(startsAt)) {
            setError("Informe um fim posterior ao início.");
            return;
          }
          setError(undefined);
          save.mutate({ ...(item ? { id: item.id } : {}), title, description, startsAt, endsAt });
        }}
      >
        <Field>
          <Label htmlFor="event-title">Título</Label>
          <Input
            id="event-title"
            required
            maxLength={160}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field>
            <Label htmlFor="event-start">Início</Label>
            <Input
              id="event-start"
              type="datetime-local"
              required
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </Field>
          <Field>
            <Label htmlFor="event-end">Fim</Label>
            <Input
              id="event-end"
              type="datetime-local"
              required
              value={end}
              min={start}
              onChange={(e) => setEnd(e.target.value)}
            />
          </Field>
        </div>
        <Field>
          <Label htmlFor="event-description">Descrição (opcional)</Label>
          <Textarea
            id="event-description"
            maxLength={2000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        {item && (
          <div>
            {confirmRemoval ? (
              <>
                <p>Remover este evento do calendário?</p>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate({ id: item.id })}
                >
                  Confirmar remoção
                </Button>
              </>
            ) : (
              <Button type="button" variant="ghost" onClick={() => setConfirmRemoval(true)}>
                Remover evento
              </Button>
            )}
          </div>
        )}
      </form>
    </TaskDialog>
  );
}
