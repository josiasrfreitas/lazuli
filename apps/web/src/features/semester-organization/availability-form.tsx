"use client";
import type { JSX as ReactJSX } from "react";
import { useState } from "react";
import { Alert, Button } from "@lazuli/ui";
import { z, classScheduleSlotInputSchema, studentAvailabilitySchema } from "@lazuli/validators";
import { trpc } from "~/lib/trpc";
import { formatDateOnlyBR } from "~/lib/format";
import { maskDateBR, parseDateBR } from "~/lib/masks";
import { RecordState } from "~/features/class-records/shared";
import { TaskDialog, NarrativeField, useValidation } from "~/features/shared/task-form";
import { TextControl } from "~/features/classes/form-controls";
import {
  Choices,
  dateOnly,
  useOrganizationRefresh,
  type SemesterBoard,
  type StudentContext,
} from "./shared";
import { SlotFields, type SlotDraft } from "./slot-fields";

const ISO_TIME_START_INDEX = 11;
const ISO_MINUTE_END_INDEX = 16;

export function AvailabilityForm({
  studentId,
  board,
  onClose,
  onInvalidate,
}: {
  studentId: string;
  board: SemesterBoard;
  onClose: () => void;
  onInvalidate: (previousId: string) => void;
}): ReactJSX.Element {
  const query = trpc.semesterOrganization.student.useQuery({
    studentId,
    semesterId: board.semester.id,
  });
  return query.data ? (
    <AvailabilityFields
      data={query.data}
      board={board}
      onClose={onClose}
      onInvalidate={onInvalidate}
    />
  ) : (
    <TaskDialog
      compactHeader
      actionSize="sm"
      title="Disponibilidade do aluno"
      description="Carregando confirmações anteriores…"
      submitDisabled
      formId="availability-loading"
      firstField=""
      submitLabel="Carregando…"
      pending={false}
      onClose={onClose}
    >
      <RecordState
        pending={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
    </TaskDialog>
  );
}
function AvailabilityFields({
  data,
  board,
  onClose,
  onInvalidate,
}: {
  data: StudentContext;
  board: SemesterBoard;
  onClose: () => void;
  onInvalidate: (previousId: string) => void;
}): ReactJSX.Element {
  const current = data.availability[0];
  const previous = current ?? data.previousAvailability;
  const prefilled = z.array(classScheduleSlotInputSchema).safeParse(previous?.slots);
  const leadSlots = data.lead?.availability.map((slot) => ({
    weekday: slot.weekday,
    startTime: slot.startTime.toISOString().slice(ISO_TIME_START_INDEX, ISO_MINUTE_END_INDEX),
    endTime: slot.endTime.toISOString().slice(ISO_TIME_START_INDEX, ISO_MINUTE_END_INDEX),
  }));
  const [slots, setSlots] = useState<SlotDraft[]>(
    prefilled.success
      ? prefilled.data
      : leadSlots?.length
        ? leadSlots
        : [{ weekday: "MONDAY", startTime: "", endTime: "" }],
  );
  const [until, setUntil] = useState(
    formatDateOnlyBR(dateOnly(current?.validUntil ?? board.semester.endDate)),
  );
  const formats = previous?.formats ?? (data.lead?.format ? [data.lead.format] : ["IN_PERSON"]);
  const [format, setFormat] = useState(formats.length === 2 ? "BOTH" : (formats[0] ?? "IN_PERSON"));
  const [notes, setNotes] = useState(previous?.notes ?? "");
  const validation = useValidation();
  const refresh = useOrganizationRefresh();
  const mutation = trpc.semesterOrganization.confirmAvailability.useMutation({
    onSuccess: async () => {
      await refresh();
      onClose();
    },
  });
  return (
    <TaskDialog
      compactHeader
      actionSize="sm"
      title="Confirmar disponibilidade"
      description={`${data.student.fullName} · semestre ${board.semester.name}`}
      formId="semester-availability"
      firstField="availability-until"
      submitLabel="Confirmar disponibilidade"
      pending={mutation.isPending}
      onClose={onClose}
      error={mutation.error?.message}
      bodyRef={validation.body}
    >
      <form
        id="semester-availability"
        noValidate
        className="grid gap-4 pt-4"
        onSubmit={(event) => {
          event.preventDefault();
          const values = validation.validate(studentAvailabilitySchema, {
            semesterId: board.semester.id,
            studentId: data.student.id,
            previousId: current?.id ?? null,
            validUntil: parseDateBR(until) ?? "",
            formats: format === "BOTH" ? ["IN_PERSON", "ONLINE"] : [format],
            slots,
            notes,
          });
          if (values && !mutation.isPending) mutation.mutate(values);
        }}
      >
        {!current && (previous || data.lead?.availability.length) ? (
          <Alert>
            Horários anteriores foram preenchidos como referência. Confirme com o aluno para este
            semestre.
          </Alert>
        ) : null}
        {current && (
          <p className="text-caption text-muted-foreground">
            {current.confirmed ? "Última confirmação" : "Invalidada"}:{" "}
            {formatDateOnlyBR(dateOnly(current.createdAt))} · {current.recordedBy.name}
          </p>
        )}
        <div className="flex flex-wrap items-start gap-4">
          <div className="w-40">
            <TextControl
              name="availability-until"
              label="Válida até"
              placeholder="dd/mm/aaaa"
              inputMode="numeric"
              value={until}
              onChange={(value) => {
                setUntil(maskDateBR(value));
                validation.clear("validUntil");
              }}
              error={validation.errors.validUntil}
            />
          </div>
          <div className="min-w-56 flex-1">
            <Choices
              name="availability-format"
              label="Pode estudar"
              value={format}
              options={{ IN_PERSON: "Presencial", ONLINE: "Online", BOTH: "Ambos" }}
              onChange={setFormat}
            />
          </div>
        </div>
        <SlotFields
          slots={slots}
          onChange={(value) => {
            setSlots(value);
            validation.clear("slots");
          }}
          error={validation.errors.slots}
        />
        <NarrativeField
          name="availability-notes"
          label="Combinados · opcional"
          placeholder="Preferência de horário e o que foi confirmado com o aluno"
          value={notes}
          onChange={(value) => {
            setNotes(value);
            validation.clear("notes");
          }}
          error={validation.errors.notes}
        />
        {data.availability.length > 0 && (
          <details className="border-t border-border pt-3">
            <summary className="cursor-pointer text-caption text-muted-foreground">
              Confirmações anteriores ({data.availability.length})
            </summary>
            <ol className="mt-3 grid gap-3">
              {data.availability.map((item) => (
                <li key={item.id} className="border-l border-border pl-3 text-caption">
                  <p className="font-medium">
                    {item.confirmed
                      ? `Válida até ${formatDateOnlyBR(dateOnly(item.validUntil))}`
                      : "Disponibilidade invalidada"}
                  </p>
                  <p className="text-muted-foreground">
                    {formatDateOnlyBR(dateOnly(item.createdAt))} · {item.recordedBy.name}
                  </p>
                  {item.notes && <p className="mt-1">{item.notes}</p>}
                </li>
              ))}
            </ol>
          </details>
        )}
      </form>
      {current?.confirmed && (
        <div className="mt-4 border-t border-border pt-3">
          <Button
            size="sm"
            variant="ghost"
            disabled={mutation.isPending}
            onClick={() => onInvalidate(current.id)}
          >
            Invalidar disponibilidade
          </Button>
        </div>
      )}
    </TaskDialog>
  );
}
