"use client";
import { useEffect, useState } from "react";
import { Check, CalendarPlus, Trash2, X } from "lucide-react";
import { Alert, Button } from "@lazuli/ui";
import { AcademicEventFields, eventDraftSchema, type EventDraft } from "./event-fields";
import { formatDateOnlyBR } from "~/lib/format";
import { parseDateBR } from "~/lib/masks";
import { TaskDialog, useValidation } from "~/features/shared/task-form";
import type { AcademicYear } from "./model";
import { trpc } from "~/lib/trpc";
import styles from "./event-form.module.css";

const localInput = (value: Date) =>
  new Date(value.getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 16);
export function AcademicEventForm({
  onClose,
  item: initialItem,
  initialDate,
  inline = false,
  onPendingChange,
  onCompleted,
}: {
  onClose: () => void;
  item?: AcademicYear["events"][number] | undefined;
  initialDate?: string | undefined;
  inline?: boolean;
  onPendingChange?: ((pending: boolean) => void) | undefined;
  onCompleted?: ((message: string) => void) | undefined;
}) {
  const [item] = useState(initialItem);
  const [values, setValues] = useState<EventDraft>(() => ({
    title: item?.title ?? "",
    description: item?.description ?? "",
    startDate: item
      ? formatDateOnlyBR(localInput(item.startsAt).slice(0, 10))
      : initialDate
        ? formatDateOnlyBR(initialDate)
        : "",
    startTime: item ? localInput(item.startsAt).slice(11, 16) : "",
    endDate: item
      ? formatDateOnlyBR(localInput(item.endsAt).slice(0, 10))
      : initialDate
        ? formatDateOnlyBR(initialDate)
        : "",
    endTime: item ? localInput(item.endsAt).slice(11, 16) : "",
  }));
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
      document.getElementById("event-title")?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [inline]);
  const fields = (
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
      {item && (
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
      )}
    </>
  );
  if (inline)
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
