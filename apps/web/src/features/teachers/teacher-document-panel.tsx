"use client";
import { useState, type ReactElement } from "react";
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

export function TeacherDocumentPanel({
  documents,
  onClose,
  showGuidance = false,
}: {
  documents: TeacherDocuments;
  onClose?: () => void;
  showGuidance?: boolean;
}): ReactElement {
  const [qr, setQr] = useState(false);
  const [extras, setExtras] = useState<UploadCategory[]>([]);
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState<string | null>(null);
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
        <>
          <p className="text-caption text-muted-foreground">
            Escaneie o código e mantenha este cadastro aberto. O link fica disponível por uma hora.
          </p>
          {documents.query.data?.closed && !preparing ? (
            <Button variant="secondary" onClick={() => void openQr()}>
              Renovar QR code
            </Button>
          ) : error && !preparing ? (
            <Button variant="secondary" onClick={() => void openQr()}>
              Tentar novamente
            </Button>
          ) : (
            <MobileUploadLink
              url={
                !preparing && documents.session
                  ? `${location.origin}/documentos/professor#${documents.session.token}`
                  : undefined
              }
            />
          )}
          <p className="text-caption text-muted-foreground" role="status">
            {documents.files.length
              ? `${documents.files.length} arquivo(s) no cadastro`
              : "Aguardando os arquivos…"}
          </p>
        </>
      ) : (
        <>
          {showGuidance && (
            <p className="text-caption text-muted-foreground">
              Envie os arquivos abaixo ou use o QR code para enviar pelo celular. Para outros
              documentos, escolha “Adicionar anexo”.
            </p>
          )}
          <TeacherAttachmentList
            extras={extras}
            setExtras={setExtras}
            documents={documents}
            onRemove={setRemoving}
          />
        </>
      )}
      {removing && (
        <div className="grid gap-2" role="alert">
          <p className="text-caption">Remover este arquivo?</p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={documents.busy}
              onClick={() => setRemoving(null)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={documents.busy}
              onClick={async () => {
                documents.setBusy(true);
                try {
                  const response = await fetch(`/api/teacher-files/${removing}`, {
                    method: "DELETE",
                  });
                  if (!response.ok) throw new Error("Não foi possível remover. Tente novamente.");
                  await documents.refresh();
                  setRemoving(null);
                } catch (failure) {
                  setError(
                    failure instanceof Error ? failure.message : "Não foi possível remover.",
                  );
                } finally {
                  documents.setBusy(false);
                }
              }}
            >
              Remover
            </Button>
          </div>
        </div>
      )}
      {(error || documents.error) && (
        <ToastAlert variant="destructive">{error || documents.error}</ToastAlert>
      )}
    </AttachmentPanel>
  );
}

function TeacherAttachmentList({
  documents,
  onRemove,
  extras,
  setExtras,
}: {
  extras: UploadCategory[];
  setExtras: import("react").Dispatch<import("react").SetStateAction<UploadCategory[]>>;
  documents: TeacherDocuments;
  onRemove: (id: string) => void;
}) {
  const [error, setError] = useState("");
  const categories = TEACHER_UPLOAD_CATEGORIES.filter((category) => category.id !== "OTHER");
  async function send(category: UploadCategory, file: File) {
    documents.setBusy(true);
    setError("");
    try {
      await documents.send({
        kind: category.id,
        label: category.label,
        ...(category.subtitle ? { subtitle: category.subtitle } : {}),
        file,
      });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Não foi possível enviar.");
    } finally {
      documents.setBusy(false);
    }
  }
  const row = (category: UploadCategory, key: string) => (
    <AttachmentUploadRow
      key={key}
      title={category.label}
      subtitle={category.subtitle}
      disabled={documents.busy}
      accept={category.photo ? "image/jpeg,image/png" : "image/jpeg,image/png,application/pdf"}
      acceptLabel={category.photo ? "JPG ou PNG" : "JPG, PNG ou PDF"}
      maxSize={5242880}
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
              subtitle: category.photo
                ? "Uma foto de rosto, nítida e bem iluminada"
                : category.id === "ID"
                  ? "RG ou CIN · frente e verso"
                  : "Documento do vínculo com a escola",
            },
            category.id,
          ),
        )}
        {documents.files.map((file) => (
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
