"use client";
import { useState } from "react";
import { Field, Input, Label, Textarea } from "@lazuli/ui";
import { TaskDialog, useValidation } from "~/features/shared/task-form";
import { trpc } from "~/lib/trpc";

export function AcademicEventForm({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [error, setError] = useState<string>();
  const validation = useValidation();
  const utils = trpc.useUtils();
  const save = trpc.calendar.academic.saveEvent.useMutation({
    onSuccess: async () => {
      await utils.calendar.academic.invalidate();
      onClose();
    },
  });
  return (
    <TaskDialog
      compactHeader
      actionSize="sm"
      title="Novo evento"
      description="Horários de São Paulo. O evento não suspende as aulas."
      formId="academic-event"
      firstField="event-title"
      submitLabel="Salvar evento"
      onClose={onClose}
      pending={save.isPending}
      error={error ?? save.error?.message}
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
          save.mutate({ title, description, startsAt, endsAt });
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
      </form>
    </TaskDialog>
  );
}
