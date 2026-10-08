"use client";
import type { ReactElement } from "react";
import {
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
  Field,
  Input,
  Label,
} from "@lazuli/ui";
import type { RouterOutputs } from "@lazuli/api";
import { useCorrectionState, type CorrectionState } from "./correction-state";

type Action = RouterOutputs["classes"]["actions"]["rows"][number];
function PreviewDetails({ state }: { state: CorrectionState }): ReactElement | null {
  if (!state.preview) return null;
  return (
    <div className="rounded-sm border border-border p-3 text-control">
      <p>
        {state.preview.classSessions.length} aulas e {state.preview.attendance.length} presenças no
        período afetado. Esses registros serão preservados.
      </p>
      <ul className="mt-2 list-disc pl-5">
        {state.preview.classSessions.map((session) => (
          <li key={session.id}>
            Aula em {session.date.toLocaleDateString("pt-BR", { timeZone: "UTC" })}
          </li>
        ))}
      </ul>
    </div>
  );
}
function CorrectionDateForm({ state }: { state: CorrectionState }): ReactElement {
  return (
    <form
      id="correction-preview-form"
      onSubmit={state.requestPreview}
      className="flex items-end gap-2"
    >
      <Field>
        <Label htmlFor="correctedDate">Nova data</Label>
        <Input
          id="correctedDate"
          name="correctedDate"
          size="sm"
          inputMode="numeric"
          placeholder="dd/mm/aaaa"
          value={state.date}
          onChange={(event) => state.setDate(event.target.value)}
        />
      </Field>
      <Button type="submit" variant="secondary">
        Ver impactos
      </Button>
    </form>
  );
}
function CorrectionFields({ state }: { state: CorrectionState }): ReactElement {
  return (
    <div className="space-y-4">
      <CorrectionDateForm state={state} />
      {state.previewPending && <p role="status">Verificando registros…</p>}
      {state.previewError && (
        <p role="alert" className="text-destructive">
          {state.previewError}
        </p>
      )}
      <PreviewDetails state={state} />
      {state.preview && (
        <Field>
          <Label htmlFor="correctionReason">Justificativa</Label>
          <Input
            id="correctionReason"
            name="correctionReason"
            size="sm"
            value={state.reason}
            onChange={(event) => state.setReason(event.target.value)}
          />
        </Field>
      )}
      {state.error && (
        <p role="alert" className="text-destructive">
          {state.error}
        </p>
      )}
    </div>
  );
}
function CorrectionForm({
  action,
  classId,
  onClose,
}: {
  action: Action;
  classId: string;
  onClose: () => void;
}): ReactElement {
  const state = useCorrectionState({ actionId: action.id, classId, onClose });
  return (
    <DialogContent className="md:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Corrigir data efetiva</DialogTitle>
        <DialogDescription>
          {action.enrollment.student.fullName} · data registrada:{" "}
          {action.effectiveDate.toLocaleDateString("pt-BR", { timeZone: "UTC" })}. Registros
          existentes serão preservados.
        </DialogDescription>
      </DialogHeader>
      <DialogBody className="mt-4">
        <CorrectionFields state={state} />
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button disabled={!state.preview || state.applyPending} onClick={state.confirm}>
          {state.applyPending ? "Salvando…" : "Salvar correção"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
export function CorrectionDialog({
  action,
  classId,
  onClose,
}: {
  action: Action | null;
  classId: string;
  onClose: () => void;
}): ReactElement {
  return (
    <Dialog
      open={action !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        {action && <CorrectionForm action={action} classId={classId} onClose={onClose} />}
      </DialogPortal>
    </Dialog>
  );
}
