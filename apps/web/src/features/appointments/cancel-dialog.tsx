"use client";
import { useState, type ReactElement } from "react";
import { appointmentCancelSchema, type AppointmentSnapshot } from "@lazuli/validators";
import { trpc } from "~/lib/trpc";
import { formatDateOnlyBR } from "~/lib/format";
import { NarrativeField, TaskDialog, useValidation } from "~/features/shared/task-form";
import { useAppointmentRefresh } from "./shared";
export function CancelAppointmentDialog({
  row,
  onClose,
}: {
  row: AppointmentSnapshot;
  onClose: () => void;
}): ReactElement {
  const { reason, setReason, validation, mutation } = useCancellation(onClose);
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
      <CancellationFields row={row} model={{ reason, setReason, validation, mutation }} />
    </TaskDialog>
  );
}

type Cancellation = ReturnType<typeof useCancellation>;
export function useCancellation(onClose: () => void): {
  reason: string;
  setReason: (reason: string) => void;
  validation: ReturnType<typeof useValidation>;
  mutation: ReturnType<typeof trpc.appointments.cancel.useMutation>;
} {
  const [reason, setReason] = useState("");
  const validation = useValidation();
  const refresh = useAppointmentRefresh();
  const mutation = trpc.appointments.cancel.useMutation({
    onSuccess: async () => {
      await refresh();
      onClose();
    },
  });
  return { reason, setReason, validation, mutation };
}

export function CancellationFields({
  row,
  model,
}: {
  row: AppointmentSnapshot;
  model: Cancellation;
}): ReactElement {
  const { reason, setReason, validation, mutation } = model;
  return (
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
  );
}
