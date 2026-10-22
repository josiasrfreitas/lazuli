"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type ReactElement,
  type RefObject,
  type Dispatch,
  type SetStateAction,
} from "react";
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
export function FileAttachmentDialog(props: FileAttachmentDialogProps): ReactElement | null {
  return props.open ? <AttachmentSession {...props} /> : null;
}

type Submission = {
  state: NonNullable<FileUploadProps["status"]>;
  progress: number | undefined;
  error: string;
  setError: Dispatch<SetStateAction<string>>;
  submitting: RefObject<boolean>;
  pending: boolean;
  success: boolean;
  attach: () => Promise<void>;
};
type AttachmentController = Submission & {
  formId: string;
  body: RefObject<HTMLDivElement | null>;
  done: RefObject<HTMLButtonElement | null>;
  files: File[];
  validationError: string;
  setValidationError: Dispatch<SetStateAction<string>>;
  changeFiles: (files: File[]) => void;
};
type AttachmentViewProps = { props: FileAttachmentDialogProps; controller: AttachmentController };
function AttachmentSession(props: FileAttachmentDialogProps): ReactElement {
  const controller = useAttachmentSession(props.onAttach);
  return <AttachmentFrame props={props} controller={controller} />;
}
function useAttachmentSession(
  onAttach: FileAttachmentDialogProps["onAttach"],
): AttachmentController {
  const formId = useId();
  const body = useRef<HTMLDivElement>(null);
  const done = useRef<HTMLButtonElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [validationError, setValidationError] = useState("");
  const submission = useAttachmentSubmission({ files, validationError, onAttach });
  const { success, setError } = submission;
  useEffect(() => {
    if (success) done.current?.focus();
  }, [success]);
  return {
    ...submission,
    formId,
    body,
    done,
    files,
    validationError,
    setValidationError,
    changeFiles: (next) => {
      setFiles(next);
      setError("");
    },
  };
}
function useAttachmentSubmission({
  files,
  validationError,
  onAttach,
}: {
  files: File[];
  validationError: string;
  onAttach: FileAttachmentDialogProps["onAttach"];
}): Submission {
  const submitting = useRef(false);
  const [state, setState] = useState<NonNullable<FileUploadProps["status"]>>("idle");
  const [progress, setProgress] = useState<number>();
  const [error, setError] = useState("");
  const pending = state === "uploading";
  const success = state === "success";
  async function attach(): Promise<void> {
    if (files.length === 0 || validationError || submitting.current || success) return;
    submitting.current = true;
    setError("");
    setProgress(undefined);
    setState("uploading");
    try {
      await onAttach(files, setProgress);
      setState("success");
    } catch (error_) {
      setError(
        error_ instanceof Error ? error_.message : "O envio não foi concluído. Tente novamente.",
      );
      setState("idle");
    } finally {
      submitting.current = false;
    }
  }
  return { state, progress, error, setError, submitting, pending, success, attach };
}
function AttachmentFrame({ props, controller }: AttachmentViewProps): ReactElement {
  const {
    onOpenChange,
    title = "Anexar arquivo",
    description = "Confira o destino e escolha o arquivo que deseja anexar.",
    compact = false,
  } = props;
  const { pending, submitting, body } = controller;
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
          <AttachmentBody props={props} controller={controller} />
          <AttachmentFooter props={props} controller={controller} />
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
function AttachmentBody({ props, controller }: AttachmentViewProps): ReactElement {
  const { target, compact = false } = props;
  const { body, success, pending } = controller;
  return (
    <DialogBody
      ref={body}
      className={`file-attachment-dialog__body${compact ? " -mx-4 px-4" : ""}`}
    >
      <AttachmentTarget target={target} />
      {success && <AttachmentSuccess props={props} />}
      <AttachmentForm props={props} controller={controller} />
      {pending && (
        <p className="file-attachment-dialog__notice">Mantenha esta janela aberta até concluir.</p>
      )}
    </DialogBody>
  );
}
function AttachmentTarget({
  target,
}: {
  target: FileAttachmentDialogProps["target"];
}): ReactElement {
  return (
    <div className="file-attachment-dialog__target">
      <Paperclip aria-hidden="true" />
      <div>
        <p className="file-attachment-dialog__target-name">{target.name}</p>
        <p>{target.description}</p>
        {target.detail && <p className="file-attachment-dialog__target-detail">{target.detail}</p>}
      </div>
    </div>
  );
}
function AttachmentSuccess({ props }: { props: FileAttachmentDialogProps }): ReactElement {
  const {
    successTitle = "Arquivo anexado",
    successDescription = "O arquivo já está disponível neste registro.",
  } = props;
  return (
    <div className="file-attachment-dialog__success" role="status">
      <span className="file-attachment-dialog__success-icon">
        <Check aria-hidden="true" />
      </span>
      <h3>{successTitle}</h3>
      <p>{successDescription}</p>
    </div>
  );
}
function AttachmentForm({ props, controller }: AttachmentViewProps): ReactElement {
  const { children } = props;
  const { formId, attach, success, pending } = controller;
  return (
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
      <AttachmentPicker props={props} controller={controller} />
    </form>
  );
}
function AttachmentFooter({ props, controller }: AttachmentViewProps): ReactElement {
  const { compact = false, onOpenChange, submitLabel = "Anexar arquivo" } = props;
  const { success, pending, formId, files, validationError, error } = controller;
  return (
    <DialogFooter className="file-attachment-dialog__footer">
      {success ? (
        <AttachmentDone props={props} controller={controller} />
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
            disabled={files.length === 0 || Boolean(validationError)}
            loading={pending}
          >
            {error ? <RotateCcw /> : <UploadCloud />}
            {error ? "Tentar novamente" : submitLabel}
          </Button>
        </>
      )}
    </DialogFooter>
  );
}
function AttachmentDone({ props, controller }: AttachmentViewProps): ReactElement {
  const { compact = false, onComplete, onOpenChange, doneLabel = "Concluir" } = props;
  const { done } = controller;
  return (
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
  );
}

function AttachmentPicker({ props, controller }: AttachmentViewProps): ReactElement {
  const {
    compact = false,
    accept,
    acceptLabel,
    maxSize,
    multiple,
    camera,
    pendingLabel = "Enviando arquivo…",
  } = props;
  const { files, changeFiles, state, success, progress, error, setValidationError } = controller;
  return (
    <FileUpload
      compact={compact}
      value={files}
      onValueChange={changeFiles}
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
  );
}
