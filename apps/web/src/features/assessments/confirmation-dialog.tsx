"use client";
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

export function ConfirmationDialog({
  data,
  onClose,
}: {
  data: Assessment;
  onClose: () => void;
}): ReactElement {
  const [decision, setDecision] = useState<"APPROVED" | "REPEAT">(
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
  function submit(event: FormEvent): void {
    event.preventDefault();
    if (confirm.isPending) return;
    if (!reason.trim()) {
      setError("Informe a justificativa pedagógica.");
      document.getElementById("assessment-reason")?.focus();
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
        <DialogContent initialFocus={() => document.getElementById("assessment-reason")}>
          <DialogHeader>
            <DialogTitle>Concluir avaliação do estágio</DialogTitle>
            <DialogDescription>
              {data.student.fullName} · {data.stage.name}. Registre o parecer da coordenação sobre a
              aprovação ou a repetição do estágio.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <form id="assessment-confirm" noValidate onSubmit={submit} className="grid gap-5 pt-4">
              <SegmentedControl
                aria-label="Decisão pedagógica"
                value={decision}
                onValueChange={(value) => {
                  if (value === "APPROVED" || value === "REPEAT") setDecision(value);
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
                value={reason}
                onChange={(value) => {
                  setReason(value);
                  setError("");
                }}
                error={error}
              />
              <p className="text-caption text-muted-foreground">
                A matrícula e o estágio atual continuam até a movimentação ser realizada.
              </p>
              {confirm.error && <Alert variant="destructive">{confirm.error.message}</Alert>}
            </form>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" disabled={confirm.isPending} onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" form="assessment-confirm" disabled={confirm.isPending}>
              {confirm.isPending
                ? "Registrando…"
                : decision === "APPROVED"
                  ? "Registrar aprovação"
                  : "Registrar repetência"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
