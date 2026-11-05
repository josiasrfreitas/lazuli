"use client";

import { useRef, useState, type ReactElement, type RefObject } from "react";
import { Trash2 } from "lucide-react";
import {
  ToastAlert,
  Button,
  Dialog,
  DialogBackdrop,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPortal,
  DialogTitle,
} from "@lazuli/ui";
import { trpc } from "~/lib/trpc";

type DeleteProps = {
  title: string;
  onDeleted?: (() => void) | undefined;
  onBusyChange?: ((busy: boolean) => void) | undefined;
};

export function DeleteDocumentButton({
  title,
  onDelete,
  onDeleted,
  onBusyChange,
}: DeleteProps & {
  onDelete: () => Promise<void>;
}): ReactElement {
  const action = useDeleteAction({ onDelete, onDeleted, onBusyChange });
  const cancel = useRef<HTMLButtonElement>(null);
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-compact-responsive"
        aria-label={`Excluir ${title.toLocaleLowerCase("pt-BR")}`}
        title="Excluir anexo"
        onClick={action.openDialog}
      >
        <Trash2 aria-hidden="true" />
      </Button>
      <DeleteConfirmation
        title={title}
        open={action.open}
        busy={action.busy}
        error={action.error}
        cancel={cancel}
        onOpenChange={action.setOpen}
        onRemove={() => void action.remove()}
      />
    </>
  );
}
function useDeleteAction({
  onDelete,
  onDeleted,
  onBusyChange,
}: {
  onDelete: () => Promise<void>;
  onDeleted?: (() => void) | undefined;
  onBusyChange?: ((busy: boolean) => void) | undefined;
}): {
  open: boolean;
  busy: boolean;
  error: string;
  setOpen: (open: boolean) => void;
  openDialog: () => void;
  remove: () => Promise<void>;
} {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function remove(): Promise<void> {
    if (busy) return;
    setBusy(true);
    onBusyChange?.(true);
    setError("");
    try {
      await onDelete();
      setOpen(false);
      onDeleted?.();
    } catch {
      setError("Não foi possível excluir o anexo. Tente novamente.");
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  }
  return {
    open,
    busy,
    error,
    setOpen: (value) => {
      if (!busy) setOpen(value);
    },
    openDialog: () => {
      setError("");
      setOpen(true);
    },
    remove,
  };
}
function DeleteConfirmation({
  title,
  open,
  busy,
  error,
  cancel,
  onOpenChange,
  onRemove,
}: {
  title: string;
  open: boolean;
  busy: boolean;
  error: string;
  cancel: RefObject<HTMLButtonElement | null>;
  onOpenChange: (open: boolean) => void;
  onRemove: () => void;
}): ReactElement {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent initialFocus={cancel} showCloseButton={!busy} className="gap-4">
          <DialogHeader>
            <DialogTitle>Excluir anexo?</DialogTitle>
            <DialogDescription>
              “{title}” será removido permanentemente. As outras versões e os dados cadastrais serão
              mantidos.
            </DialogDescription>
          </DialogHeader>
          {error && <ToastAlert variant="destructive">{error}</ToastAlert>}
          <DialogFooter>
            <Button
              ref={cancel}
              variant="secondary"
              disabled={busy}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button variant="destructive" loading={busy} onClick={onRemove}>
              Excluir anexo
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}

export function StudentDocumentDeleteButton({
  fileId,
  ...props
}: DeleteProps & { fileId: string }): ReactElement {
  const mutation = trpc.studentDocuments.remove.useMutation();
  const utils = trpc.useUtils();
  return (
    <DeleteDocumentButton
      {...props}
      onDelete={async () => {
        await mutation.mutateAsync({ id: fileId });
        await Promise.all([
          utils.studentDocuments.list.invalidate(),
          utils.studentDocuments.photo.invalidate(),
          utils.studentDocuments.status.invalidate(),
          utils.dashboard.invalidate(),
        ]);
      }}
    />
  );
}
