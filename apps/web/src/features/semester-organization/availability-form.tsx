"use client";

import type { JSX as ReactJSX } from "react";
import { Alert, Button } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { formatDateOnlyBR } from "~/lib/format";
import { RecordState } from "~/features/class-records/shared";
import { TaskDialog, NarrativeField } from "~/features/shared/task-form";
import { TextControl } from "~/features/classes/form-controls";
import { Choices, dateOnly, type SemesterBoard, type StudentContext } from "./shared";
import { SlotFields } from "./slot-fields";
import { useAvailabilityState, type AvailabilityState } from "./availability-state";

type Props = {
  studentId: string;
  board: SemesterBoard;
  onClose: () => void;
  onInvalidate: (previousId: string) => void;
};

export function AvailabilityForm({
  studentId,
  board,
  onClose,
  onInvalidate,
}: Props): ReactJSX.Element {
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
  const state = useAvailabilityState({ data, board, onClose });
  const current = state.current;
  return (
    <TaskDialog
      compactHeader
      actionSize="sm"
      title="Confirmar disponibilidade"
      description={`${data.student.fullName} · semestre ${board.semester.name}`}
      formId="semester-availability"
      firstField="availability-until"
      submitLabel="Confirmar disponibilidade"
      pending={state.pending}
      onClose={onClose}
      error={state.error}
      bodyRef={state.validation.body}
    >
      <AvailabilityFormBody data={data} state={state} />
      {current?.confirmed && (
        <div className="mt-4 border-t border-border pt-3">
          <Button
            size="sm"
            variant="ghost"
            disabled={state.pending}
            onClick={() => onInvalidate(current.id)}
          >
            Invalidar disponibilidade
          </Button>
        </div>
      )}
    </TaskDialog>
  );
}

function AvailabilityFormBody({
  data,
  state,
}: {
  data: StudentContext;
  state: AvailabilityState;
}): ReactJSX.Element {
  return (
    <form id="semester-availability" noValidate className="grid gap-4 pt-4" onSubmit={state.submit}>
      <AvailabilityNotice state={state} />
      <AvailabilityCoreFields state={state} />
      <SlotFields
        slots={state.slots}
        onChange={state.changeSlots}
        error={state.validation.errors.slots}
      />
      <NarrativeField
        name="availability-notes"
        label="Combinados · opcional"
        placeholder="Preferência de horário e o que foi confirmado com o aluno"
        value={state.notes}
        onChange={state.changeNotes}
        error={state.validation.errors.notes}
      />
      {data.availability.length > 0 && <AvailabilityHistory data={data} />}
    </form>
  );
}

function AvailabilityNotice({ state }: { state: AvailabilityState }): ReactJSX.Element {
  return (
    <>
      {!state.current && state.hasPrevious && (
        <Alert>
          Horários anteriores foram preenchidos como referência. Confirme com o aluno para este
          semestre.
        </Alert>
      )}
      {state.current && (
        <p className="text-caption text-muted-foreground">
          {state.current.confirmed ? "Última confirmação" : "Invalidada"}:{" "}
          {formatDateOnlyBR(dateOnly(state.current.createdAt))} · {state.current.recordedBy.name}
        </p>
      )}
    </>
  );
}

function AvailabilityCoreFields({ state }: { state: AvailabilityState }): ReactJSX.Element {
  return (
    <div className="flex flex-wrap items-start gap-4">
      <div className="w-40">
        <TextControl
          name="availability-until"
          label="Válida até"
          placeholder="dd/mm/aaaa"
          inputMode="numeric"
          value={state.until}
          onChange={state.changeUntil}
          error={state.validation.errors.validUntil}
        />
      </div>
      <div className="min-w-56 flex-1">
        <Choices
          name="availability-format"
          label="Pode estudar"
          value={state.format}
          options={{ IN_PERSON: "Presencial", ONLINE: "Online", BOTH: "Ambos" }}
          onChange={state.setFormat}
        />
      </div>
    </div>
  );
}

function AvailabilityHistory({ data }: { data: StudentContext }): ReactJSX.Element {
  return (
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
  );
}
