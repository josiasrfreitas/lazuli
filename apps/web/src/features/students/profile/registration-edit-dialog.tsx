"use client";

import { useEffect, useRef, useState, type ReactElement, type RefObject } from "react";
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
import { DiscardRegistrationDialog } from "~/features/shared/discard-registration-dialog";
import type { StudentProfile } from "./logic";
import {
  RegistrationEditor,
  REGISTRATION_EDIT_TITLES,
  type RegistrationEditTarget,
} from "./registration-editor";
import styles from "./student-overview.module.css";

export function RegistrationEditDialog({
  profile,
  target,
  onClose,
}: {
  profile: StudentProfile;
  target: RegistrationEditTarget;
  onClose: () => void;
}): ReactElement {
  const state = useRegistrationEditState();
  return (
    <Dialog
      open={state.open}
      onOpenChange={(value) => {
        if (!value) state.close();
      }}
      onOpenChangeComplete={(value) => {
        if (!value) onClose();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <RegistrationEditPanel
          content={state.content}
          profile={profile}
          target={target}
          busy={state.busy}
          discard={state.discard}
          onBusyChange={state.setBusy}
          onDirtyChange={state.setDirty}
          onCancel={state.close}
          onSaved={state.saved}
          onKeep={() => state.setDiscard(false)}
          onDiscard={state.discardChanges}
        />
      </DialogPortal>
    </Dialog>
  );
}

type RegistrationEditState = {
  open: boolean;
  busy: boolean;
  discard: boolean;
  content: RefObject<HTMLDivElement | null>;
  close: () => void;
  saved: () => void;
  discardChanges: () => void;
  setBusy: (busy: boolean) => void;
  setDirty: (dirty: boolean) => void;
  setDiscard: (discard: boolean) => void;
};

function useRegistrationEditState(): RegistrationEditState {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [discard, setDiscard] = useState(false);
  const content = useRef<HTMLDivElement>(null);
  useEffect(() => setOpen(true), []);
  const close = (): void => {
    if (busy) return;
    if (dirty) setDiscard(true);
    else setOpen(false);
  };
  const saved = (): void => {
    setDirty(false);
    setOpen(false);
  };
  const discardChanges = (): void => {
    setDiscard(false);
    setDirty(false);
    setOpen(false);
  };
  return {
    open,
    busy,
    discard,
    content,
    close,
    saved,
    discardChanges,
    setBusy,
    setDirty,
    setDiscard,
  };
}

function RegistrationEditPanel({
  content,
  profile,
  target,
  busy,
  discard,
  onBusyChange,
  onDirtyChange,
  onCancel,
  onSaved,
  onKeep,
  onDiscard,
}: {
  content: RefObject<HTMLDivElement | null>;
  profile: StudentProfile;
  target: RegistrationEditTarget;
  busy: boolean;
  discard: boolean;
  onBusyChange: (busy: boolean) => void;
  onDirtyChange: (dirty: boolean) => void;
  onCancel: () => void;
  onSaved: () => void;
  onKeep: () => void;
  onDiscard: () => void;
}): ReactElement {
  return (
    <DialogContent
      ref={content}
      className="md:max-w-2xl"
      showCloseButton={!busy}
      initialFocus={() => content.current?.querySelector<HTMLElement>("input, textarea")}
      data-student-dialog-motion
    >
      <RegistrationEditContent
        profile={profile}
        target={target}
        onDirtyChange={onDirtyChange}
        onBusyChange={onBusyChange}
        onCancel={onCancel}
        onSaved={onSaved}
      />
      {discard && <DiscardRegistrationDialog onKeep={onKeep} onDiscard={onDiscard} />}
    </DialogContent>
  );
}

function RegistrationEditContent({
  profile,
  target,
  onDirtyChange,
  onBusyChange,
  onCancel,
  onSaved,
}: {
  profile: StudentProfile;
  target: RegistrationEditTarget;
  onDirtyChange: (dirty: boolean) => void;
  onBusyChange: (busy: boolean) => void;
  onCancel: () => void;
  onSaved: () => void;
}): ReactElement {
  return (
    <>
      <DialogHeader>
        <DialogTitle>{REGISTRATION_EDIT_TITLES[target]}</DialogTitle>
        <DialogDescription>{profile.contact.fullName}</DialogDescription>
      </DialogHeader>
      <DialogBody>
        <div className={styles.editorBody}>
          <RegistrationEditor
            profile={profile}
            target={target}
            onDirtyChange={onDirtyChange}
            onBusyChange={onBusyChange}
            onCancel={onCancel}
            onSaved={onSaved}
          />
        </div>
      </DialogBody>
    </>
  );
}
