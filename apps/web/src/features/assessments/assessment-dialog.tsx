"use client";
import type { JSX as ReactJSX } from "react";
import { useState } from "react";
import { DiscardRegistrationDialog } from "~/features/shared/discard-registration-dialog";
import {
  Dialog,
  DialogBackdrop,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogPortal,
  DialogTitle,
} from "@lazuli/ui";
import { AssessmentWorkspace } from "./assessment-workspace";
import type { Assessment } from "./shared";

export function AssessmentDialog({
  data,
  onClose,
}: {
  data: Assessment;
  onClose: () => void;
}): ReactJSX.Element {
  const [editorState, setEditorState] = useState({ dirty: false, pending: false });
  const [discard, setDiscard] = useState(false);
  function requestClose() {
    if (editorState.pending) return;
    if (editorState.dirty) setDiscard(true);
    else onClose();
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) requestClose();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent className="p-4 md:max-w-2xl" showCloseButton={!editorState.pending}>
          <DialogHeader>
            <DialogTitle className="text-base">Notas e provas</DialogTitle>
            <DialogDescription>
              {data.student.fullName} · {data.stage.name}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="-mx-4 px-4">
            <div className="pt-3">
              <AssessmentWorkspace data={data} onStateChange={setEditorState} />
            </div>
          </DialogBody>
        </DialogContent>
        {discard && (
          <DiscardRegistrationDialog onKeep={() => setDiscard(false)} onDiscard={onClose} />
        )}
      </DialogPortal>
    </Dialog>
  );
}
