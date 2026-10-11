"use client";
import { useRef, useState, type FormEvent, type ReactElement, type RefObject } from "react";
import { Alert, SegmentedControl, SegmentedControlItem } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { TextControl } from "~/features/classes/form-controls";
import { AdmissionDialog } from "./admission-dialog";
import { dateLabel, type Candidate } from "./labels";

type Visit = Candidate["visits"][number];
type OutcomeFieldsProps = {
  cancel: boolean;
  status: "ATTENDED" | "ABSENT";
  notes: string;
  error: string;
  onStatus: (status: "ATTENDED" | "ABSENT") => void;
  onNotes: (notes: string) => void;
};
export function OutcomeFields(props: OutcomeFieldsProps): ReactElement {
  return (
    <>
      {!props.cancel && (
        <SegmentedControl
          aria-label="Comparecimento"
          size="sm"
          value={props.status}
          onValueChange={(value) => {
            if (value === "ATTENDED" || value === "ABSENT") props.onStatus(value);
          }}
        >
          <SegmentedControlItem value="ATTENDED">Compareceu</SegmentedControlItem>
          <SegmentedControlItem value="ABSENT">Não compareceu</SegmentedControlItem>
        </SegmentedControl>
      )}
      <TextControl
        name="outcome-notes"
        label={props.cancel ? "Motivo" : "Observações"}
        placeholder={props.cancel ? "Por que a aula será cancelada?" : "Como foi a experiência?"}
        value={props.notes}
        onChange={props.onNotes}
        error={props.error}
      />
      {!props.cancel && (
        <p className="text-caption text-muted-foreground">
          O comparecimento não efetiva uma matrícula.
        </p>
      )}
    </>
  );
}
type OutcomeInput = { visit: Visit; cancel: boolean; onClose: () => void };
type OutcomeForm = OutcomeFieldsProps & {
  popup: RefObject<HTMLDivElement | null>;
  pending: boolean;
  serverError: string | null;
  submit: (event: FormEvent) => void;
};
function useOutcomeForm({ visit, cancel, onClose }: OutcomeInput): OutcomeForm {
  const [status, setStatus] = useState<"ATTENDED" | "ABSENT">(
    visit.status === "ABSENT" ? "ABSENT" : "ATTENDED",
  );
  const [notes, setNotes] = useState(cancel ? "" : (visit.notes ?? ""));
  const [error, setError] = useState("");
  const popup = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();
  const mutation = trpc.admissions.outcome.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.admissions.invalidate(), utils.teachers.invalidate()]);
      onClose();
    },
  });
  function submit(event: FormEvent): void {
    event.preventDefault();
    if (mutation.isPending) return;
    if (cancel && !notes.trim()) {
      setError("Informe o motivo do cancelamento.");
      popup.current?.querySelector("input")?.focus();
      return;
    }
    mutation.mutate({ id: visit.id, status: cancel ? "CANCELLED" : status, notes });
  }
  return {
    cancel,
    status,
    onStatus: setStatus,
    notes,
    error,
    popup,
    submit,
    onNotes: (value) => {
      setNotes(value);
      setError("");
    },
    pending: mutation.isPending,
    serverError: mutation.error?.message ?? null,
  };
}
export function OutcomeDialog({ visit, cancel, onClose }: OutcomeInput): ReactElement {
  const form = useOutcomeForm({ visit, cancel, onClose });
  const action = cancel ? "Confirmar cancelamento" : "Salvar comparecimento";
  return (
    <AdmissionDialog
      title={cancel ? "Cancelar aula de entrada" : "Registrar comparecimento"}
      description={`${dateLabel(visit.date)} · ${visit.startTime}–${visit.endTime}`}
      formId="visit-outcome"
      onSubmit={form.submit}
      onClose={onClose}
      popup={form.popup}
      initialFocus={() => form.popup.current?.querySelector("input") ?? false}
      pending={form.pending}
      submitLabel={form.pending ? "Salvando…" : action}
    >
      <OutcomeFields {...form} />
      {form.serverError && <Alert variant="destructive">{form.serverError}</Alert>}
    </AdmissionDialog>
  );
}
