"use client";
import { Check, X } from "lucide-react";
import {
  useState,
  type FormEvent,
  type ReactElement,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogBackdrop,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPortal,
  DialogTitle,
  SegmentedControl,
  SegmentedControlItem,
} from "@lazuli/ui";
import { TextControl } from "~/features/classes/form-controls";
import { trpc } from "~/lib/trpc";
import type { Assessment } from "./shared";
type Decision = "APPROVED" | "REPEAT";
type ConfirmationState = {
  decision: Decision;
  setDecision: Dispatch<SetStateAction<Decision>>;
  reason: string;
  setReason: Dispatch<SetStateAction<string>>;
  error: string;
  setError: Dispatch<SetStateAction<string>>;
  confirm: ReturnType<typeof trpc.assessments.confirm.useMutation>;
  submit: (event: FormEvent) => void;
};
export function ConfirmationDialog({
  data,
  onClose,
}: {
  data: Assessment;
  onClose: () => void;
}): ReactElement {
  const state = useConfirmation(data, onClose);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !state.confirm.isPending) onClose();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent
          initialFocus={() => document.querySelector<HTMLInputElement>("#assessment-reason")}
        >
          <DialogHeader>
            <DialogTitle>Concluir avaliação do estágio</DialogTitle>
            <DialogDescription>
              {data.student.fullName} · {data.stage.name}. Registre o parecer da coordenação sobre a
              aprovação ou a repetição do estágio.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <ConfirmationForm data={data} state={state} />
          </DialogBody>
          <ConfirmationFooter state={state} onClose={onClose} />
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
export function useConfirmation(data: Assessment, onClose: () => void): ConfirmationState {
  const [decision, setDecision] = useState<Decision>(
    data.status === "SUFFICIENT" ? "APPROVED" : "REPEAT",
  );
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const utils = trpc.useUtils();
  const confirm = trpc.assessments.confirm.useMutation({
    onSuccess: async () => {
      await utils.assessments.invalidate();
      onClose();
    },
  });
  const submit = (event: FormEvent): void => {
    event.preventDefault();
    if (confirm.isPending) return;
    if (!reason.trim()) {
      setError("Informe a justificativa pedagógica.");
      document.querySelector<HTMLInputElement>("#assessment-reason")?.focus();
      return;
    }
    confirm.mutate({ progressId: data.progressId, version: data.version, decision, reason });
  };
  return { decision, setDecision, reason, setReason, error, setError, confirm, submit };
}
export function ConfirmationForm({
  data,
  state,
}: {
  data: Assessment;
  state: ConfirmationState;
}): ReactElement {
  return (
    <form id="assessment-confirm" noValidate onSubmit={state.submit} className="grid gap-5 pt-4">
      <SegmentedControl
        aria-label="Decisão pedagógica"
        disabled={state.confirm.isPending}
        value={state.decision}
        onValueChange={(value) => {
          if (value === "APPROVED" || value === "REPEAT") state.setDecision(value);
        }}
      >
        <SegmentedControlItem value="APPROVED" disabled={data.status !== "SUFFICIENT"}>
          Aprovar
        </SegmentedControlItem>
        <SegmentedControlItem value="REPEAT">Repetir estágio</SegmentedControlItem>
      </SegmentedControl>
      <TextControl
        name="assessment-reason"
        label="Justificativa pedagógica"
        placeholder="Registre as evidências que sustentam esta decisão"
        value={state.reason}
        onChange={(value) => {
          state.setReason(value);
          state.setError("");
        }}
        error={state.error}
        disabled={state.confirm.isPending}
      />
      <p className="text-caption text-muted-foreground">
        A matrícula e o estágio atual continuam até a movimentação ser realizada.
      </p>
      {state.confirm.error && <Alert variant="destructive">{state.confirm.error.message}</Alert>}
    </form>
  );
}
function ConfirmationFooter({
  state,
  onClose,
}: {
  state: ConfirmationState;
  onClose: () => void;
}): ReactElement {
  return (
    <DialogFooter>
      <Button variant="secondary" disabled={state.confirm.isPending} onClick={onClose}>
        <X aria-hidden="true" />
        Cancelar
      </Button>
      <Button type="submit" form="assessment-confirm" disabled={state.confirm.isPending}>
        <Check aria-hidden="true" />
        {confirmationLabel(state)}
      </Button>
    </DialogFooter>
  );
}
function confirmationLabel(state: ConfirmationState): string {
  if (state.confirm.isPending) return "Registrando…";
  return state.decision === "APPROVED" ? "Registrar aprovação" : "Registrar repetência";
}
