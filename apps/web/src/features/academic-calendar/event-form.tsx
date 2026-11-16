"use client";
import { useEffect, useState, type ReactElement, type Dispatch, type SetStateAction } from "react";
import { Check, CalendarPlus, Trash2, X } from "lucide-react";
import { Alert, Button } from "@lazuli/ui";
import { AcademicEventFields, eventDraftSchema, type EventDraft } from "./event-fields";
import { parseDateBR } from "~/lib/masks";
import { TaskDialog, useValidation } from "~/features/shared/task-form";
import type { AcademicYear } from "./model";
import { trpc } from "~/lib/trpc";
import styles from "./event-form.module.css";

import { initialEventDraft } from "./event-form-model";
type EventFormProps = {
  onClose: () => void;
  item?: AcademicYear["events"][number] | undefined;
  initialDate?: string | undefined;
  inline?: boolean;
  onPendingChange?: ((pending: boolean) => void) | undefined;
  onCompleted?: ((message: string) => void) | undefined;
};
type EventFormState = {
  item: EventFormProps["item"];
  values: EventDraft;
  setValues: Dispatch<SetStateAction<EventDraft>>;
  validation: ReturnType<typeof useValidation>;
  save: ReturnType<typeof trpc.calendar.academic.saveEvent.useMutation>;
  remove: ReturnType<typeof trpc.calendar.academic.removeEvent.useMutation>;
  confirmRemoval: boolean;
  setConfirmRemoval: Dispatch<SetStateAction<boolean>>;
  pending: boolean;
};
type EventViewProps = { props: EventFormProps; state: EventFormState };
export function AcademicEventForm(props: EventFormProps): ReactElement {
  const state = useEventFormState(props);
  return props.inline ? (
    <InlineEventEditor props={props} state={state} />
  ) : (
    <EventDialog props={props} state={state} />
  );
}
function useEventFormState({
  item: initialItem,
  initialDate,
  inline = false,
  onClose,
  onCompleted,
  onPendingChange,
}: EventFormProps): EventFormState {
  const [item] = useState(initialItem);
  const [values, setValues] = useState<EventDraft>(() => initialEventDraft({ item, initialDate }));
  const validation = useValidation();
  const utils = trpc.useUtils();
  const save = trpc.calendar.academic.saveEvent.useMutation({
    onSuccess: async () => {
      await utils.calendar.academic.invalidate();
      onCompleted?.("Evento salvo no calendário. As aulas foram mantidas.");
      onClose();
    },
  });
  const [confirmRemoval, setConfirmRemoval] = useState(false);
  const remove = trpc.calendar.academic.removeEvent.useMutation({
    onSuccess: async () => {
      await utils.calendar.academic.invalidate();
      onCompleted?.("Evento removido do calendário.");
      onClose();
    },
  });
  const pending = save.isPending || remove.isPending;
  useEffect(() => {
    onPendingChange?.(pending);
    return () => onPendingChange?.(false);
  }, [pending, onPendingChange]);
  useEffect(() => {
    if (!inline) return;
    const frame = requestAnimationFrame(() => {
      document.querySelector<HTMLInputElement>("#event-title")?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [inline]);
  return {
    item,
    values,
    setValues,
    validation,
    save,
    remove,
    confirmRemoval,
    setConfirmRemoval,
    pending,
  };
}
function EventFields({ state }: { state: EventFormState }): ReactElement {
  const { item, values, setValues, validation, save, remove } = state;
  return (
    <>
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
      <EventRemoval state={state} />
    </>
  );
}
function InlineEventEditor({ props: { onClose }, state }: EventViewProps): ReactElement {
  const { item, pending, validation, save, remove } = state;
  const fields = <EventFields state={state} />;
  return (
    <section
      className={styles.editor}
      aria-labelledby="event-editor-title"
      onKeyDown={(event) => {
        if (event.key === "Escape" && !pending) {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <div className={styles.heading}>
        <h2 id="event-editor-title">
          <CalendarPlus aria-hidden="true" /> {item ? "Editar evento" : "Novo evento"}
        </h2>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Fechar editor de evento"
          disabled={pending}
          onClick={onClose}
        >
          <X />
        </Button>
      </div>
      <p className={styles.note}>O evento aparece no calendário. As aulas são mantidas.</p>
      <div ref={validation.body}>{fields}</div>
      {(save.error || remove.error) && (
        <Alert variant="destructive">{save.error?.message ?? remove.error?.message}</Alert>
      )}
      <div className={styles.actions}>
        <Button size="sm" variant="secondary" disabled={pending} onClick={onClose}>
          Cancelar
        </Button>
        <Button size="sm" form="academic-event" type="submit" disabled={pending}>
          <Check aria-hidden="true" /> {pending ? "Salvando…" : "Salvar evento"}
        </Button>
      </div>
    </section>
  );
}
function EventDialog({ props: { onClose }, state }: EventViewProps): ReactElement {
  const { item, pending, validation, save, remove } = state;
  const fields = <EventFields state={state} />;
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
      pending={pending}
      error={save.error?.message ?? remove.error?.message}
      bodyRef={validation.body}
    >
      {fields}
    </TaskDialog>
  );
}

function EventRemoval({ state }: { state: EventFormState }): ReactElement | null {
  const { item, confirmRemoval, remove, save, setConfirmRemoval, pending } = state;
  if (!item) return null;
  return (
    <div>
      {confirmRemoval ? (
        <>
          <p>Remover este evento do calendário?</p>
          <Button
            type="button"
            variant="destructive"
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
        <Button
          type="button"
          variant="destructive-ghost"
          disabled={pending}
          onClick={() => setConfirmRemoval(true)}
        >
          <Trash2 aria-hidden="true" /> Remover evento
        </Button>
      )}
    </div>
  );
}
