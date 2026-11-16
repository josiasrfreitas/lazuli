"use client";
import { useState, type ReactElement, type Dispatch, type SetStateAction } from "react";
import { ExternalLink, X } from "lucide-react";
import {
  AttachmentPanel,
  AttachmentRow,
  AttachmentUploadRow,
  AttachmentAdd,
  Button,
  ToastAlert,
} from "@lazuli/ui";
import { MobileUploadLink } from "~/features/mobile-upload/session-link";
import { type UploadCategory } from "~/features/mobile-upload/file-editor";
import type { TeacherDocuments } from "./use-teacher-documents";
import { TEACHER_UPLOAD_CATEGORIES } from "./upload-categories";
import { TeacherAttachmentsLoading } from "./teacher-section-loading";

export function TeacherDocumentPanel({
  documents,
  onClose,
  showGuidance = false,
  hidePhoto = false,
}: {
  documents: TeacherDocuments;
  onClose?: () => void;
  showGuidance?: boolean;
  hidePhoto?: boolean;
}): ReactElement {
  const { qr, setQr, error, setError, preparing, openQr } = useCapturePreparation(documents);
  const [extras, setExtras] = useState<UploadCategory[]>([]);
  const [removing, setRemoving] = useState<string | null>(null);
  const visibleError = error || documents.error;
  if (documents.loading) return <TeacherAttachmentsLoading />;
  return (
    <AttachmentPanel
      title={qr ? "Enviar pelo celular" : "Anexos do professor"}
      busy={documents.busy}
      onClose={onClose}
      onBack={
        qr
          ? () => {
              setQr(false);
            }
          : undefined
      }
      onMobile={() => void openQr()}
    >
      {qr ? (
        <TeacherCaptureStatus
          documents={documents}
          preparing={preparing}
          error={error}
          hidePhoto={hidePhoto}
          onRetry={() => void openQr()}
        />
      ) : (
        <>
          <AttachmentGuidance show={showGuidance} />
          <TeacherAttachmentList
            hidePhoto={hidePhoto}
            extras={extras}
            setExtras={setExtras}
            documents={documents}
            onRemove={setRemoving}
          />
        </>
      )}
      {removing && (
        <RemoveAttachmentConfirmation
          busy={documents.busy}
          onCancel={() => setRemoving(null)}
          onConfirm={() =>
            void removeAttachment(documents, {
              id: removing,
              onRemoved: () => setRemoving(null),
              onError: setError,
            })
          }
        />
      )}
      {visibleError && <ToastAlert variant="destructive">{visibleError}</ToastAlert>}
    </AttachmentPanel>
  );
}

function TeacherAttachmentList({
  hidePhoto,
  documents,
  onRemove,
  extras,
  setExtras,
}: {
  hidePhoto: boolean;
  extras: UploadCategory[];
  setExtras: import("react").Dispatch<import("react").SetStateAction<UploadCategory[]>>;
  documents: TeacherDocuments;
  onRemove: (id: string) => void;
}): ReactElement {
  const { error, send } = useAttachmentSend(documents);
  const categories = TEACHER_UPLOAD_CATEGORIES.filter(
    (category) => category.id !== "OTHER" && (!hidePhoto || category.id !== "PHOTO"),
  );
  const row = (category: UploadCategory, key: string): ReactElement => (
    <AttachmentUploadRow
      key={key}
      title={category.label}
      subtitle={category.subtitle}
      disabled={documents.busy}
      accept={category.photo ? "image/jpeg,image/png" : "image/jpeg,image/png,application/pdf"}
      acceptLabel={category.photo ? "JPG ou PNG" : "JPG, PNG ou PDF"}
      maxSize={5_242_880}
      onFile={(file) => void send(category, file)}
    />
  );
  return (
    <>
      <ul>
        {categories.map((category) =>
          row(
            {
              ...category,
              subtitle: categorySubtitle(category),
            },
            category.id,
          ),
        )}
        <SavedAttachments documents={documents} hidePhoto={hidePhoto} onRemove={onRemove} />
        {extras
          .filter(
            (item) =>
              !documents.files.some(
                (file) =>
                  file.label === item.label && (file.subtitle ?? "") === (item.subtitle ?? ""),
              ),
          )
          .map((item, index) => row(item, `extra-${index}`))}
      </ul>
      <AttachmentAdd
        disabled={documents.busy}
        onAdd={({ title, subtitle }) =>
          setExtras((previous) => [...previous, { id: "OTHER", label: title, subtitle }])
        }
      />
      {error && <ToastAlert variant="destructive">{error}</ToastAlert>}
    </>
  );
}

async function removeAttachment(
  documents: TeacherDocuments,
  {
    id,
    onRemoved,
    onError,
  }: { id: string; onRemoved: () => void; onError: (message: string) => void },
): Promise<void> {
  documents.setBusy(true);
  try {
    const response = await fetch(`/api/teacher-files/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Não foi possível remover. Tente novamente.");
    await documents.refresh();
    onRemoved();
  } catch (error_) {
    onError(error_ instanceof Error ? error_.message : "Não foi possível remover.");
  } finally {
    documents.setBusy(false);
  }
}
function RemoveAttachmentConfirmation({
  busy,
  onCancel,
  onConfirm,
}: {
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}): ReactElement {
  return (
    <div className="grid gap-2" role="alert">
      <p className="text-caption">Remover este arquivo?</p>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" disabled={busy} onClick={onCancel}>
          Cancelar
        </Button>
        <Button variant="destructive" size="sm" disabled={busy} onClick={onConfirm}>
          Remover
        </Button>
      </div>
    </div>
  );
}

type CaptureProps = {
  documents: TeacherDocuments;
  preparing: boolean;
  error: string;
  onRetry: () => void;
};
function TeacherCaptureStatus({
  documents,
  preparing,
  error,
  hidePhoto,
  onRetry,
}: CaptureProps & { hidePhoto: boolean }): ReactElement {
  const count = documents.files.filter((file) => !hidePhoto || file.kind !== "PHOTO").length;
  return (
    <>
      <p className="text-caption text-muted-foreground">
        Escaneie o código e mantenha este cadastro aberto. O link fica disponível por uma hora.
      </p>
      <CaptureLink documents={documents} preparing={preparing} error={error} onRetry={onRetry} />
      <p className="text-caption text-muted-foreground" role="status">
        {count > 0 ? `${count} arquivo(s) no cadastro` : "Aguardando os arquivos…"}
      </p>
    </>
  );
}
function CaptureLink({ documents, preparing, error, onRetry }: CaptureProps): ReactElement {
  if (documents.query.data?.closed && !preparing)
    return (
      <Button variant="secondary" onClick={onRetry}>
        Renovar QR code
      </Button>
    );
  if (error && !preparing)
    return (
      <Button variant="secondary" onClick={onRetry}>
        Tentar novamente
      </Button>
    );
  return (
    <MobileUploadLink
      url={
        !preparing && documents.session
          ? `${location.origin}/documentos/professor#${documents.session.token}`
          : undefined
      }
    />
  );
}

function useAttachmentSend(documents: TeacherDocuments): {
  error: string;
  send: (category: UploadCategory, file: File) => Promise<void>;
} {
  const [error, setError] = useState("");
  async function send(category: UploadCategory, file: File): Promise<void> {
    documents.setBusy(true);
    setError("");
    try {
      await documents.send({
        kind: category.id,
        label: category.label,
        ...(category.subtitle ? { subtitle: category.subtitle } : {}),
        file,
      });
    } catch (error_) {
      setError(error_ instanceof Error ? error_.message : "Não foi possível enviar.");
    } finally {
      documents.setBusy(false);
    }
  }
  return { error, send };
}
function SavedAttachments({
  documents,
  hidePhoto,
  onRemove,
}: {
  documents: TeacherDocuments;
  hidePhoto: boolean;
  onRemove: (id: string) => void;
}): ReactElement {
  return (
    <>
      {" "}
      {documents.files
        .filter((file) => !hidePhoto || file.kind !== "PHOTO")
        .map((file) => (
          <AttachmentRow key={file.id} title={file.label} subtitle={file.subtitle ?? file.fileName}>
            <a
              href={`/api/teacher-files/${file.id}`}
              target="_blank"
              rel="noreferrer"
              aria-label={`Abrir ${file.label}`}
            >
              <ExternalLink className="size-4" />
            </a>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label={`Remover ${file.label}`}
              onClick={() => onRemove(file.id)}
            >
              <X />
            </Button>
          </AttachmentRow>
        ))}
    </>
  );
}

function useCapturePreparation(documents: TeacherDocuments): {
  qr: boolean;
  setQr: Dispatch<SetStateAction<boolean>>;
  error: string;
  setError: Dispatch<SetStateAction<string>>;
  preparing: boolean;
  openQr: () => Promise<void>;
} {
  const [qr, setQr] = useState(false);
  const [error, setError] = useState("");
  const [preparing, setPreparing] = useState(false);
  async function openQr(): Promise<void> {
    setQr(true);
    setPreparing(true);
    setError("");
    try {
      await documents.ensureSession();
    } catch {
      setError("Não foi possível gerar o QR code. Tente novamente.");
    } finally {
      setPreparing(false);
    }
  }
  return { qr, setQr, error, setError, preparing, openQr };
}

function categorySubtitle(category: UploadCategory): string {
  if (category.photo) return "Uma foto de rosto, nítida e bem iluminada";
  return category.id === "ID" ? "RG ou CIN · frente e verso" : "Documento do vínculo com a escola";
}

function AttachmentGuidance({ show }: { show: boolean }): ReactElement | null {
  if (!show) return null;
  return (
    <p className="text-caption text-muted-foreground">
      Envie os arquivos abaixo ou use o QR code para enviar pelo celular. Para outros documentos,
      escolha “Adicionar anexo”.
    </p>
  );
}
