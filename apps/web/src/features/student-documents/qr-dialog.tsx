import { useState, type ReactElement } from "react";
import { QrCode } from "lucide-react";
import {
  ToastAlert,
  Button,
  Dialog,
  DialogPortal,
  DialogBackdrop,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@lazuli/ui";
import type { EnrollmentDocuments } from "./use-enrollment-documents";
import { DocumentReviewNotice } from "./review-notice";
import { MobileUploadLink } from "~/features/mobile-upload/session-link";

export function DocumentQrButton({
  documents,
  disabled = false,
}: {
  documents: EnrollmentDocuments;
  disabled?: boolean;
}): ReactElement {
  const [open, setOpen] = useState(false);
  function prepare(): void {
    setOpen(true);
    void documents.ensureSession().catch(() => {
      /* Dialog owns retry. */
    });
  }
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={disabled}
        onClick={prepare}
        aria-label="Gerar QR code para enviar documentos pelo celular"
        title="Enviar documentos pelo celular"
      >
        <QrCode aria-hidden="true" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogPortal>
          <DialogBackdrop />
          <QrDialogContent documents={documents} onRetry={prepare} />
        </DialogPortal>
      </Dialog>
    </>
  );
}
function QrDialogContent({
  documents,
  onRetry,
}: {
  documents: EnrollmentDocuments;
  onRetry: () => void;
}): ReactElement {
  return (
    <DialogContent className="gap-4">
      <DialogHeader>
        <DialogTitle>Enviar pelo celular</DialogTitle>
        <DialogDescription>
          Escaneie este QR code para enviar os documentos. Mantenha o cadastro aberto no computador.
        </DialogDescription>
      </DialogHeader>
      <QrDialogState documents={documents} onRetry={onRetry} />
      <DocumentReviewNotice />
    </DialogContent>
  );
}
function QrDialogState({
  documents,
  onRetry,
}: {
  documents: EnrollmentDocuments;
  onRetry: () => void;
}): ReactElement {
  if (documents.session) return <SessionLink token={documents.session.token} />;
  if (!documents.create.isError) return <p role="status">Preparando QR code…</p>;
  return (
    <ToastAlert variant="destructive">
      Não foi possível gerar o QR code.
      <Button type="button" variant="ghost" onClick={onRetry}>
        Tentar novamente
      </Button>
    </ToastAlert>
  );
}
export function SessionLink({ token }: { token: string }): ReactElement {
  return <MobileUploadLink url={`${location.origin}/documentos#${token}`} />;
}
