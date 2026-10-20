"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Check, Paperclip, RotateCcw, UploadCloud, X } from "lucide-react";

import { Button } from "./button";
import {
  Dialog,
  DialogBackdrop,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPortal,
  DialogTitle,
} from "./dialog";
import { FileUpload, type FileUploadProps } from "./file-upload";

export type FileAttachmentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  /** Names the event/person the files will belong to before the user submits. */
  target: { name: string; description: string; detail?: string };
  accept?: string;
  acceptLabel?: string;
  maxSize: number;
  multiple?: boolean;
  camera?: boolean;
  /** Keeps focused operational forms compact, including their file picker. */
  compact?: boolean;
  children?: ReactNode;
  submitLabel?: string;
  pendingLabel?: string;
  successTitle?: string;
  successDescription?: string;
  doneLabel?: string;
  onComplete?: () => void;
  /** Resolve only at the milestone described by successTitle/successDescription. */
  onAttach: (files: File[], reportProgress: (percent: number) => void) => Promise<void>;
};

/** A domain-neutral attachment flow; callers supply the destination and upload adapter. */
export function FileAttachmentDialog(props: FileAttachmentDialogProps) {
  return props.open ? <AttachmentSession {...props} /> : null;
}

function AttachmentSession({
  onOpenChange,
  title = "Anexar arquivo",
  description = "Confira o destino e escolha o arquivo que deseja anexar.",
  target,
  accept,
  acceptLabel,
  maxSize,
  multiple,
  camera,
  compact = false,
  children,
  submitLabel = "Anexar arquivo",
  pendingLabel = "Enviando arquivo…",
  successTitle = "Arquivo anexado",
  successDescription = "O arquivo já está disponível neste registro.",
  doneLabel = "Concluir",
  onComplete,
  onAttach,
}: FileAttachmentDialogProps) {
  const formId = useId();
  const body = useRef<HTMLDivElement>(null);
  const submitting = useRef(false);
  const done = useRef<HTMLButtonElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [state, setState] = useState<NonNullable<FileUploadProps["status"]>>("idle");
  const [progress, setProgress] = useState<number>();
  const [error, setError] = useState("");
  const [validationError, setValidationError] = useState("");
  const pending = state === "uploading";
  const success = state === "success";
  useEffect(() => {
    if (success) done.current?.focus();
  }, [success]);

  async function attach() {
    if (!files.length || validationError || submitting.current || success) return;
    submitting.current = true;
    setError("");
    setProgress(undefined);
    setState("uploading");
    try {
      await onAttach(files, setProgress);
      setState("success");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "O envio não foi concluído. Tente novamente.",
      );
      setState("idle");
    } finally {
      submitting.current = false;
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !submitting.current) onOpenChange(false);
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent
          className={`file-attachment-dialog md:max-w-xl${compact ? " p-4" : ""}`}
          data-compact={compact || undefined}
          showCloseButton={!pending}
          initialFocus={() =>
            body.current?.querySelector<HTMLElement>("[data-file-upload-picker]") ?? false
          }
        >
          <DialogHeader>
            <DialogTitle className={compact ? "text-base" : undefined}>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <DialogBody
            ref={body}
            className={`file-attachment-dialog__body${compact ? " -mx-4 px-4" : ""}`}
          >
            <div className="file-attachment-dialog__target">
              <Paperclip aria-hidden="true" />
              <div>
                <p className="file-attachment-dialog__target-name">{target.name}</p>
                <p>{target.description}</p>
                {target.detail && (
                  <p className="file-attachment-dialog__target-detail">{target.detail}</p>
                )}
              </div>
            </div>
            {success && (
              <div className="file-attachment-dialog__success" role="status">
                <span className="file-attachment-dialog__success-icon">
                  <Check aria-hidden="true" />
                </span>
                <h3>{successTitle}</h3>
                <p>{successDescription}</p>
              </div>
            )}
            <form
              id={formId}
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                event.stopPropagation();
                void attach();
              }}
            >
              {children && !success && (
                <fieldset disabled={pending} className="file-attachment-dialog__fields">
                  {children}
                </fieldset>
              )}
              <FileUpload
                compact={compact}
                value={files}
                onValueChange={(next) => {
                  setFiles(next);
                  setError("");
                }}
                accept={accept}
                acceptLabel={acceptLabel}
                maxSize={maxSize}
                multiple={multiple}
                camera={camera}
                status={state}
                statusLabel={success ? "Concluído" : pendingLabel}
                progress={progress}
                error={error}
                onValidationError={setValidationError}
              />
            </form>
            {pending && (
              <p className="file-attachment-dialog__notice">
                Mantenha esta janela aberta até concluir.
              </p>
            )}
          </DialogBody>
          <DialogFooter className="file-attachment-dialog__footer">
            {success ? (
              <Button
                ref={done}
                size={compact ? "sm" : "md"}
                onClick={() => {
                  if (onComplete) onComplete();
                  else onOpenChange(false);
                }}
              >
                <Check />
                {doneLabel}
              </Button>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size={compact ? "sm" : "md"}
                  disabled={pending}
                  onClick={() => onOpenChange(false)}
                >
                  <X />
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  size={compact ? "sm" : "md"}
                  form={formId}
                  disabled={!files.length || Boolean(validationError)}
                  loading={pending}
                >
                  {error ? <RotateCcw /> : <UploadCloud />}
                  {error ? "Tentar novamente" : submitLabel}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
