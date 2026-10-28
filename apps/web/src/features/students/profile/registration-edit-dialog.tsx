"use client";

import { useEffect, useRef, useState, type ReactElement } from "react";
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
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) close();
      }}
      onOpenChangeComplete={(value) => {
        if (!value) onClose();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent
          ref={content}
          className="md:max-w-2xl"
          showCloseButton={!busy}
          initialFocus={() => content.current?.querySelector<HTMLElement>("input, textarea")}
          data-student-dialog-motion
        >
          <DialogHeader>
            <DialogTitle>{REGISTRATION_EDIT_TITLES[target]}</DialogTitle>
            <DialogDescription>{profile.contact.fullName}</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className={styles.editorBody}>
              <RegistrationEditor
                profile={profile}
                target={target}
                onDirtyChange={setDirty}
                onBusyChange={setBusy}
                onCancel={close}
                onSaved={() => {
                  setDirty(false);
                  setOpen(false);
                }}
              />
            </div>
          </DialogBody>
          {discard && (
            <DiscardRegistrationDialog
              onKeep={() => setDiscard(false)}
              onDiscard={() => {
                setDiscard(false);
                setDirty(false);
                setOpen(false);
              }}
            />
          )}
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
