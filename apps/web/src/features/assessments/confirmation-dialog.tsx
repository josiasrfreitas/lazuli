"use client";
import { Check, X } from "lucide-react";
import { useState, type FormEvent, type ReactElement } from "react";
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

function focusReason(): HTMLElement | null {
  return document.querySelector<HTMLElement>("#assessment-reason");
}

function useConfirmationMutation(
  onClose: () => void,
): ReturnType<typeof trpc.assessments.confirm.useMutation> {
  const utils = trpc.useUtils();
  return trpc.assessments.confirm.useMutation({
    onSuccess: async () => {
      await utils.assessments.invalidate();
      onClose();
    },
  });
}

export function ConfirmationDialog({
  data,
  onClose,
}: {
  data: Assessment;
  onClose: () => void;
}): ReactElement {
  const initialDecision = data.status === "SUFFICIENT" ? "APPROVED" : "REPEAT";
  const [decision, setDecision] = useState<"APPROVED" | "REPEAT">(initialDecision);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const confirm = useConfirmationMutation(onClose);
  function submit(event: FormEvent): void {
    event.preventDefault();
    if (confirm.isPending) return;
    if (!reason.trim()) {
      setError("Informe a justificativa pedagógica.");
      document.querySelector<HTMLElement>("#assessment-reason")?.focus();
      return;
    }
    confirm.mutate({ progressId: data.progressId, version: data.version, decision, reason });
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !confirm.isPending) onClose();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent initialFocus={focusReason}>
          <ConfirmationHeader data={data} />
          <ConfirmationFields
            status={data.status}
            decision={decision}
            setDecision={setDecision}
            reason={reason}
            setReason={setReason}
            error={error}
            clearError={() => setError("")}
            mutationError={confirm.error?.message}
            submit={submit}
          />
          <ConfirmationActions pending={confirm.isPending} decision={decision} onClose={onClose} />
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}

function ConfirmationHeader({ data }: { data: Assessment }): ReactElement {
  return (
    <DialogHeader>
      <DialogTitle>Concluir avaliação do estágio</DialogTitle>
      <DialogDescription>
        {data.student.fullName} · {data.stage.name}. Registre o parecer da coordenação sobre a
        aprovação ou a repetição do estágio.
      </DialogDescription>
    </DialogHeader>
  );
}

function ConfirmationFields({
  status,
  decision,
  setDecision,
  reason,
  setReason,
  error,
  clearError,
  mutationError,
  submit,
}: {
  status: Assessment["status"];
  decision: "APPROVED" | "REPEAT";
  setDecision: (decision: "APPROVED" | "REPEAT") => void;
  reason: string;
  setReason: (reason: string) => void;
  error: string;
  clearError: () => void;
  mutationError: string | undefined;
  submit: (event: FormEvent) => void;
}): ReactElement {
  return (
    <DialogBody>
      <form id="assessment-confirm" noValidate onSubmit={submit} className="grid gap-5 pt-4">
        <SegmentedControl
          aria-label="Decisão pedagógica"
          value={decision}
          onValueChange={(value) => {
            if (value === "APPROVED" || value === "REPEAT") setDecision(value);
          }}
        >
          <SegmentedControlItem value="APPROVED" disabled={status !== "SUFFICIENT"}>
            Aprovar
          </SegmentedControlItem>
          <SegmentedControlItem value="REPEAT">Repetir estágio</SegmentedControlItem>
        </SegmentedControl>
        <ConfirmationReason
          reason={reason}
          setReason={setReason}
          error={error}
          clearError={clearError}
        />
        <p className="text-caption text-muted-foreground">
          A matrícula e o estágio atual continuam até a movimentação ser realizada.
        </p>
        {mutationError && <Alert variant="destructive">{mutationError}</Alert>}
      </form>
    </DialogBody>
  );
}

function ConfirmationReason({
  reason,
  setReason,
  error,
  clearError,
}: {
  reason: string;
  setReason: (reason: string) => void;
  error: string;
  clearError: () => void;
}): ReactElement {
  return (
    <TextControl
      name="assessment-reason"
      label="Justificativa pedagógica"
      placeholder="Registre as evidências que sustentam esta decisão"
      value={reason}
      onChange={(value) => {
        setReason(value);
        clearError();
      }}
      error={error}
    />
  );
}

function ConfirmationActions({
  pending,
  decision,
  onClose,
}: {
  pending: boolean;
  decision: "APPROVED" | "REPEAT";
  onClose: () => void;
}): ReactElement {
  let label = "Registrar repetência";
  if (pending) label = "Registrando…";
  else if (decision === "APPROVED") label = "Registrar aprovação";
  return (
    <DialogFooter>
      <Button variant="secondary" disabled={pending} onClick={onClose}>
        <X aria-hidden="true" />
        Cancelar
      </Button>
      <Button type="submit" form="assessment-confirm" disabled={pending}>
        <Check aria-hidden="true" />
        {label}
      </Button>
    </DialogFooter>
  );
}
