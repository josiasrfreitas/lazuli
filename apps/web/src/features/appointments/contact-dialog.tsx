"use client";
import { useState } from "react";
import { sessionEndInstant } from "@lazuli/domain";
import { absenceContactSchema } from "@lazuli/validators";
import { trpc } from "~/lib/trpc";
import { formatDateOnlyBR } from "~/lib/format";
import { parseDateBR } from "~/lib/masks";
import { ContactFields, type ContactValues } from "./form-fields";
import { TaskDialog, useValidation } from "~/features/shared/task-form";
import { today, useAppointmentRefresh } from "./shared";

export function AbsenceContactDialog({
  student,
  attendanceId,
  onClose,
}: {
  student: { id: string; name: string };
  attendanceId?: string;
  onClose: () => void;
}) {
  const [id] = useState(() => crypto.randomUUID());
  const [values, setValues] = useState<ContactValues>({
    date: formatDateOnlyBR(today()),
    time: new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date()),
    channel: "WHATSAPP",
    outcome: "REPLIED",
    notes: "",
    next: "",
  });
  const { date, time, channel, outcome, notes, next } = values;
  const validation = useValidation();
  const refresh = useAppointmentRefresh();
  const mutation = trpc.appointments.contact.useMutation({
    onSuccess: async () => {
      await refresh();
      onClose();
    },
  });
  function submit() {
    const civilDate = parseDateBR(date);
    const validTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
    const values = validation.validate(absenceContactSchema, {
      id,
      studentId: student.id,
      attendanceId: attendanceId ?? null,
      contactedAt:
        civilDate && validTime
          ? sessionEndInstant({ date: civilDate, endTime: time }).toISOString()
          : "",
      channel,
      outcome,
      notes,
      nextContactDate: next ? (parseDateBR(next) ?? "") : null,
    });
    if (values && !mutation.isPending) mutation.mutate(values);
  }
  return (
    <TaskDialog
      title="Registrar contato"
      description={student.name}
      firstField="contact-date"
      formId="absence-contact"
      submitLabel="Registrar contato"
      onClose={onClose}
      pending={mutation.isPending}
      error={mutation.error?.message}
      bodyRef={validation.body}
    >
      <form
        id="absence-contact"
        noValidate
        className="grid gap-4 pt-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <ContactFields
          values={values}
          errors={validation.errors}
          change={(field, value) => {
            setValues((current) => ({ ...current, [field]: value }));
            validation.clear(
              field === "date" || field === "time"
                ? "contactedAt"
                : field === "next"
                  ? "nextContactDate"
                  : field,
            );
          }}
        />
        <p className="text-caption text-muted-foreground">
          Este registro guarda a data e sua autoria no histórico do aluno.
        </p>
      </form>
    </TaskDialog>
  );
}
