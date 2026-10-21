"use client";
import type { ReactElement } from "react";
import { Save, X } from "lucide-react";
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
} from "@lazuli/ui";
import { DiscardRegistrationDialog } from "~/features/shared/discard-registration-dialog";
import { COMPETENCE_LABELS } from "./shared";
import { useAssessmentEntry } from "./assessment-entry-state";
import {
  EntryUnitSelector,
  EntryGradeFields,
  EntryRecoveryField,
  EntryNotesField,
  EntryCorrectionField,
} from "./assessment-entry-fields";
import { EntryProofsField } from "./assessment-entry-proofs";
import type { EntryProps, EntryState } from "./assessment-entry.types";
import styles from "./assessment-workspace.module.css";
export function AssessmentEntryDialog(props: EntryProps): ReactElement {
  const state = useAssessmentEntry(props);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) state.requestClose();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent
          className="p-4 md:max-w-lg"
          showCloseButton={!state.busy}
          finalFocus={() => props.trigger}
          initialFocus={() =>
            state.form.body.current?.querySelector<HTMLInputElement>("input") ?? false
          }
        >
          <DialogHeader className="gap-1">
            <DialogTitle className="text-base">{COMPETENCE_LABELS[props.competence]}</DialogTitle>
            <DialogDescription>
              {props.data.student.fullName} · {props.data.stage.name}
            </DialogDescription>
          </DialogHeader>
          <EntryBody state={state} />
          <EntryFooter state={state} />
        </DialogContent>
        {state.discard && (
          <DiscardRegistrationDialog
            onKeep={() => state.setDiscard(false)}
            onDiscard={props.onClose}
          />
        )}
      </DialogPortal>
    </Dialog>
  );
}
function EntryBody({ state }: { state: EntryState }): ReactElement {
  return (
    <DialogBody className="-mx-4 px-4">
      <div ref={state.form.body}>
        <AssessmentEntryForm state={state} />
      </div>
    </DialogBody>
  );
}

function EntryFooter({ state }: { state: EntryState }): ReactElement {
  return (
    <DialogFooter className="mt-3 flex-row justify-end gap-2">
      <Button size="sm" variant="secondary" disabled={state.busy} onClick={state.requestClose}>
        <X aria-hidden="true" />
        Cancelar
      </Button>
      <Button size="sm" type="submit" form={state.id} loading={state.busy} disabled={!state.dirty}>
        <Save aria-hidden="true" />
        Salvar
      </Button>
    </DialogFooter>
  );
}

export function AssessmentEntryForm({ state }: { state: EntryState }): ReactElement {
  return (
    <form
      id={state.id}
      className={styles.entry}
      noValidate
      onSubmit={(event) => void state.submit(event)}
    >
      <EntryUnitSelector state={state} />
      <EntryGradeFields state={state} />
      {state.phase === "RECOVERY" && <EntryRecoveryField state={state} />}
      <EntryNotesField state={state} />
      {state.proof && <EntryProofsField state={state} />}
      {state.data.confirmedAt && state.gradeChanged && <EntryCorrectionField state={state} />}
      {state.form.save.error && (
        <Alert variant="destructive">{state.form.save.error.message}</Alert>
      )}
      {state.uploadError && <Alert variant="destructive">{state.uploadError}</Alert>}
    </form>
  );
}
