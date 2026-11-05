import { useState, type ReactElement, type ReactNode } from "react";
import {
  ToastAlert,
  Button,
  FileUpload,
  Dialog,
  DialogPortal,
  DialogBackdrop,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
} from "@lazuli/ui";
import { Upload } from "lucide-react";
import { DocumentCapture } from "./capture";
import type { DocumentDefinition } from "./model";
import type { EnrollmentDocuments } from "./use-enrollment-documents";
import {
  DOCUMENT_ACCEPT,
  DOCUMENT_ACCEPT_LABEL,
  DOCUMENT_SIZE_LABEL,
  DOCUMENT_SIZE_LIMITS,
} from "./model";

export function DocumentUploadPicker({
  documents,
  document,
  renderTrigger,
  disabled = false,
}: {
  documents: EnrollmentDocuments;
  document: DocumentDefinition;
  disabled?: boolean;
  renderTrigger?: (picker: { open: () => void; disabled: boolean }) => ReactNode;
}): ReactElement {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  function prepare(): void {
    void documents.ensureSession().catch(() => {
      /* Retry stays beside the selected file. */
    });
  }
  function finish(): void {
    if (!busy) setFile(null);
  }
  return (
    <>
      <UploadFileInput
        document={document}
        disabled={disabled || Boolean(file)}
        renderTrigger={renderTrigger}
        onChoose={(chosen) => {
          setFile(chosen);
          prepare();
        }}
      />
      <UploadPreviewDialog
        documents={documents}
        document={document}
        file={file}
        busy={busy}
        onFinish={finish}
        onRetry={prepare}
        onBusyChange={setBusy}
      />
    </>
  );
}
function UploadFileInput({
  document,
  disabled,
  renderTrigger,
  onChoose,
}: {
  document: DocumentDefinition;
  disabled: boolean;
  renderTrigger: ((picker: { open: () => void; disabled: boolean }) => ReactNode) | undefined;
  onChoose: (file: File) => void;
}): ReactElement {
  return (
    <FileUpload
      compact
      value={[]}
      accept={document.id === "photo" ? "image/jpeg,image/png" : DOCUMENT_ACCEPT}
      acceptLabel={document.id === "photo" ? "JPG ou PNG" : DOCUMENT_ACCEPT_LABEL}
      maxSize={26_214_400}
      maxSizeByType={DOCUMENT_SIZE_LIMITS}
      sizeLabel={document.id === "photo" ? undefined : DOCUMENT_SIZE_LABEL}
      disabled={disabled}
      onValueChange={(files) => {
        if (files[0]) onChoose(files[0]);
      }}
      renderTrigger={
        renderTrigger ??
        ((picker) => (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={picker.disabled}
            onClick={picker.open}
          >
            <Upload /> Anexar
          </Button>
        ))
      }
    />
  );
}
type PreviewDialogProps = {
  documents: EnrollmentDocuments;
  document: DocumentDefinition;
  file: File | null;
  busy: boolean;
  onFinish: () => void;
  onRetry: () => void;
  onBusyChange: (busy: boolean) => void;
};
function UploadPreviewDialog({
  documents,
  document,
  file,
  busy,
  onFinish,
  onRetry,
  onBusyChange,
}: PreviewDialogProps): ReactElement {
  return (
    <Dialog
      open={Boolean(file)}
      onOpenChange={(open) => {
        if (!open) onFinish();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent className="gap-4 md:max-w-2xl" showCloseButton={!busy}>
          <DialogHeader>
            <DialogTitle>{document.title}</DialogTitle>
            <DialogDescription>
              {document.detail}. Confira o arquivo antes de enviar.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <UploadPreviewBody
              documents={documents}
              document={document}
              file={file}
              onFinish={onFinish}
              onRetry={onRetry}
              onBusyChange={onBusyChange}
            />
          </DialogBody>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
function UploadPreviewBody({
  documents,
  document,
  file,
  onFinish,
  onRetry,
  onBusyChange,
}: Omit<PreviewDialogProps, "busy">): ReactElement {
  if (documents.session && file)
    return (
      <DocumentCapture
        embedded
        document={document}
        token={documents.session.token}
        initialFile={file}
        onBack={onFinish}
        onBusyChange={onBusyChange}
        onSent={() => {
          void documents.query.refetch();
        }}
      />
    );
  if (!documents.create.isError) return <p role="status">Preparando envio…</p>;
  return (
    <ToastAlert variant="destructive">
      Não foi possível preparar o envio. Seu arquivo continua selecionado.
      <Button type="button" variant="ghost" onClick={onRetry}>
        Tentar novamente
      </Button>
    </ToastAlert>
  );
}
