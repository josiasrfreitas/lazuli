"use client";
import {
  Button,
  Dialog,
  DialogPortal,
  DialogBackdrop,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from "@lazuli/ui";
import { formatDateOnlyBR } from "~/lib/format";
import type { ScheduleModel } from "./schedule-dialog-model";

export function AcademicExceptionDialog({ model }: { model: ScheduleModel }) {
  const exception = model.submission.exception;
  if (!exception) return null;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !model.submission.pending) exception.cancel();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atendimento fora do período acadêmico</DialogTitle>
            <DialogDescription>
              Esta data está fora do período acadêmico. Você está agendando um atendimento extra.
              Use esta opção apenas em última instância.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <p>
              {model.draft.values.student?.label} · {model.data.teacher?.label}
            </p>
            <p>
              {formatDateOnlyBR(exception.date)} · {model.draft.values.startTime}–
              {model.draft.values.endTime}
            </p>
            {model.submission.error && <p role="alert">{model.submission.error}</p>}
          </DialogBody>
          <DialogFooter>
            <Button
              variant="secondary"
              disabled={model.submission.pending}
              onClick={exception.cancel}
            >
              Voltar
            </Button>
            <Button disabled={model.submission.pending} onClick={exception.confirm}>
              {model.submission.pending ? "Conferindo…" : "Confirmar atendimento extra"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
