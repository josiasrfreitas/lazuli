"use client";
import { useState, type ReactElement, type Dispatch, type SetStateAction } from "react";
import { ChevronDown, Download, FileText, Plus, X } from "lucide-react";
import {
  AttachmentPanel,
  FileUpload,
  AttachmentUploadRow,
  AttachmentAdd,
  Button,
  ToastAlert,
} from "@lazuli/ui";
import { AttachmentEmpty } from "~/features/mobile-upload/attachment-empty";
import { MobileUploadLink } from "~/features/mobile-upload/session-link";
import { type UploadCategory } from "~/features/mobile-upload/file-editor";
import type { TeacherDocuments } from "./use-teacher-documents";
import { TEACHER_UPLOAD_CATEGORIES } from "./upload-categories";
import { TeacherAttachmentsLoading } from "./teacher-section-loading";

export function TeacherDocumentPanel({
  documents,
  onClose,
  inRecord = false,
}: {
  documents: TeacherDocuments;
  onClose?: () => void;
  inRecord?: boolean;
}): ReactElement {
  const { qr, setQr, error, setError, preparing, openQr } = useCapturePreparation(documents);
  const [extras, setExtras] = useState<UploadCategory[]>([]);
  const [removing, setRemoving] = useState<string | null>(null);
  const visibleError = error || documents.error;
  if (documents.loading) return <TeacherAttachmentsLoading />;
  if (documents.loadError) return <AttachmentLoadError documents={documents} />;
  return (
    <AttachmentPanel
      variant="card"
      title={qr ? "Enviar pelo celular" : "Anexos"}
      busy={documents.busy}
      onClose={onClose}
      onBack={qr ? () => setQr(false) : undefined}
      onMobile={() => void openQr()}
    >
      {qr ? (
        <TeacherCaptureStatus
          documents={documents}
          preparing={preparing}
          error={error}
          hidePhoto={inRecord}
          onRetry={() => void openQr()}
        />
      ) : (
        <>
          <AttachmentGuidance show={inRecord} />
          <TeacherAttachmentList
            inRecord={inRecord}
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

function AttachmentLoadError({ documents }: { documents: TeacherDocuments }): ReactElement {
  return (
    <ToastAlert variant="destructive">
      Não foi possível carregar os anexos.{" "}
      <Button variant="secondary" onClick={() => void documents.refresh()}>
        Tentar novamente
      </Button>
    </ToastAlert>
  );
}

function TeacherAttachmentList({
  inRecord,
  documents,
  onRemove,
  extras,
  setExtras,
}: {
  inRecord: boolean;
  extras: UploadCategory[];
  setExtras: import("react").Dispatch<import("react").SetStateAction<UploadCategory[]>>;
  documents: TeacherDocuments;
  onRemove: (id: string) => void;
}): ReactElement {
  const { error, send } = useAttachmentSend(documents);
  const row = (category: UploadCategory, key: string): ReactElement => (
    <AttachmentUploadRow
      key={key}
      title={category.label}
      subtitle={category.subtitle}
      disabled={documents.busy}
      accept={category.photo ? "image/jpeg,image/png" : "image/jpeg,image/png,application/pdf"}
      acceptLabel={category.photo ? "JPG ou PNG" : "JPG, PNG ou PDF"}
      maxSize={5_242_880}
      onFile={(file) =>
        void send(category, file).then((saved) => {
          if (saved) setExtras((previous) => previous.filter((item) => item !== category));
        })
      }
    />
  );
  return (
    <>
      <ul className="max-h-80 overflow-y-auto overscroll-contain scrollbar-subtle empty:hidden">
        {inRecord &&
          TEACHER_UPLOAD_CATEGORIES.filter(
            (category) =>
              (category.id === "ID" || category.id === "CONTRACT") &&
              !documents.files.some((file) => file.kind === category.id),
          ).map((category) => row(category, category.id))}
        <SavedAttachments documents={documents} hidePhoto={inRecord} onRemove={onRemove} />
        {extras.map((item, index) => row(item, `extra-${index}`))}
      </ul>
      {!inRecord && !documents.files.length && !extras.length ? (
        <AttachmentEmpty>
          <FileUpload
            compact
            accept="image/jpeg,image/png,application/pdf"
            acceptLabel="JPG, PNG ou PDF"
            maxSize={5_242_880}
            value={[]}
            disabled={documents.busy}
            onValueChange={(files) => {
              const file = files[0];
              if (file) void send({ id: "OTHER", label: file.name.slice(0, 100) }, file);
            }}
            renderTrigger={({ open, disabled }) => (
              <Button type="button" size="sm" disabled={disabled} onClick={open}>
                <Plus />
                Adicionar primeiro anexo
              </Button>
            )}
          />
        </AttachmentEmpty>
      ) : (
        <AttachmentAdd
          disabled={documents.busy}
          onAdd={({ title, subtitle }) =>
            setExtras((previous) => [...previous, { id: "OTHER", label: title, subtitle }])
          }
        />
      )}
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
  send: (category: UploadCategory, file: File) => Promise<boolean>;
} {
  const [error, setError] = useState("");
  async function send(category: UploadCategory, file: File): Promise<boolean> {
    documents.setBusy(true);
    setError("");
    try {
      await documents.send({
        kind: category.id,
        label: category.label,
        ...(category.subtitle ? { subtitle: category.subtitle } : {}),
        file,
      });
      return true;
    } catch (error_) {
      setError(error_ instanceof Error ? error_.message : "Não foi possível enviar.");
      return false;
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
      {documents.files
        .filter((file) => !hidePhoto || file.kind !== "PHOTO")
        .map((file) => {
          const url = `/api/teacher-files/${file.id}`;
          const image = file.contentType.startsWith("image/");
          return (
            <li key={file.id} className="border-b border-border py-2">
              <details>
                <summary className="flex cursor-pointer items-center gap-3 rounded-sm p-1 hover:bg-accent">
                  {image ? (
                    <img
                      src={url}
                      alt=""
                      loading="lazy"
                      className="size-10 rounded-sm object-cover"
                    />
                  ) : (
                    <FileText aria-hidden="true" className="size-10 p-2" />
                  )}
                  <span className="min-w-0 flex-1">
                    <strong className="block break-words">{file.label}</strong>
                    <small className="text-muted-foreground">
                      {image ? file.contentType.split("/")[1]?.toUpperCase() : "PDF"} ·{" "}
                      {new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(
                        new Date(file.createdAt),
                      )}
                    </small>
                  </span>
                  <ChevronDown aria-hidden="true" className="size-4" />
                </summary>
                <div className="grid gap-2 p-2 text-caption">
                  {image && (
                    <img
                      src={url}
                      alt={file.label}
                      loading="lazy"
                      className="max-h-56 max-w-full rounded-sm object-contain"
                    />
                  )}
                  <p className="break-all">{file.fileName}</p>
                  {file.subtitle && <p>{file.subtitle}</p>}
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      nativeButton={false}
                      render={<a href={url} download={file.fileName} />}
                      size="sm"
                      variant="secondary"
                    >
                      <Download />
                      Baixar arquivo
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      disabled={documents.busy}
                      aria-label={`Remover ${file.label}`}
                      onClick={() => onRemove(file.id)}
                    >
                      <X />
                    </Button>
                  </div>
                </div>
              </details>
            </li>
          );
        })}
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
    documents.setBusy(true);
    setError("");
    try {
      await documents.ensureSession();
    } catch {
      setError("Não foi possível gerar o QR code. Tente novamente.");
    } finally {
      setPreparing(false);
      documents.setBusy(false);
    }
  }
  return { qr, setQr, error, setError, preparing, openQr };
}

function AttachmentGuidance({ show }: { show: boolean }): ReactElement | null {
  if (!show) return null;
  return (
    <p className="text-caption text-muted-foreground">
      Adicione um documento ou envie pelo celular usando o QR code.
    </p>
  );
}
