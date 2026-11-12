"use client";
import { useState, type ReactElement } from "react";
import { ArrowLeft, FileText, Plus, QrCode, X } from "lucide-react";
import { Button, ToastAlert } from "@lazuli/ui";
import { MobileUploadLink } from "~/features/mobile-upload/session-link";
import { MobileFileEditor, type UploadCategory } from "~/features/mobile-upload/file-editor";
import type { TeacherDocuments } from "./use-teacher-documents";
import { TEACHER_UPLOAD_CATEGORIES } from "./upload-categories";
import styles from "./teacher-form.module.css";
export function TeacherDocumentPanel({
  documents,
  onClose,
}: {
  documents: TeacherDocuments;
  onClose?: () => void;
}): ReactElement {
  const [selection, setSelection] = useState<UploadCategory | null>(null);
  const [qr, setQr] = useState(false);
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
    <aside className={styles.documents} aria-label="Anexos do professor">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-h3">{selection?.label ?? (qr ? "Enviar pelo celular" : "Anexos")}</h2>
        <div className="flex gap-1">
          {!qr && !selection && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Enviar pelo celular"
              disabled={documents.busy}
              onClick={() => void openQr()}
            >
              <QrCode />
            </Button>
          )}
          {onClose && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Fechar anexos"
              disabled={documents.busy}
              onClick={onClose}
            >
              <X />
            </Button>
          )}
        </div>
      </div>
      {!qr && !selection && documents.files.some((file) => file.kind === "PHOTO") && (
        <img
          className={styles.photo}
          src={`/api/teacher-files/${documents.files.find((file) => file.kind === "PHOTO")?.id}`}
          alt="Foto do professor"
        />
      )}
      {(qr || selection) && (
        <Button
          variant="ghost"
          size="sm"
          disabled={documents.busy}
          onClick={() => {
            setQr(false);
            setSelection(null);
          }}
        >
          <ArrowLeft /> Voltar aos anexos
        </Button>
      )}
      {qr ? (
        <>
          <p className="text-caption text-muted-foreground">
            Escaneie o código e mantenha este cadastro aberto. O link fica disponível por uma hora.
          </p>
          {preparing ? (
            <p role="status">Preparando QR code…</p>
          ) : documents.query.data?.closed ? (
            <Button variant="secondary" onClick={() => void openQr()}>
              Renovar QR code
            </Button>
          ) : documents.session ? (
            <MobileUploadLink
              url={`${location.origin}/documentos/professor#${documents.session.token}`}
            />
          ) : (
            <Button variant="secondary" onClick={() => void openQr()}>
              Tentar novamente
            </Button>
          )}
          <p className="text-caption text-muted-foreground" role="status">
            {documents.files.length
              ? `${documents.files.length} arquivo(s) no cadastro`
              : "Aguardando os arquivos…"}
          </p>
        </>
      ) : selection ? (
        <MobileFileEditor
          key={selection.id}
          category={selection}
          onBack={() => setSelection(null)}
          onBusyChange={documents.setBusy}
          onSend={async (input) => {
            await documents.send(input);
            setSelection(null);
          }}
        />
      ) : (
        <>
          <p className="text-caption text-muted-foreground">
            Envie pelo computador ou use a câmera do celular.
          </p>
          <ul className="divide-y">
            {TEACHER_UPLOAD_CATEGORIES.map((category) => (
              <li className={styles.documentRow} key={category.id}>
                <div>
                  <strong className="text-control">{category.label}</strong>
                  <small className="block text-caption text-muted-foreground">
                    {documents.files.filter((file) => file.kind === category.id).length
                      ? "Arquivo recebido"
                      : category.customLabel
                        ? "Nome livre para novos anexos"
                        : "Opcional"}
                  </small>
                </div>
                <Button
                  variant="secondary"
                  size="icon-sm"
                  aria-label={`Anexar ${category.label}`}
                  onClick={() => setSelection(category)}
                >
                  <Plus />
                </Button>
              </li>
            ))}
          </ul>
          {documents.files.length > 0 && (
            <ul className="divide-y">
              {documents.files.map((file) => (
                <li className={styles.documentRow} key={file.id}>
                  <a
                    className="min-w-0 break-words text-caption underline"
                    href={`/api/teacher-files/${file.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <FileText className="inline size-3" /> {file.label}
                  </a>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remover ${file.label}`}
                    onClick={() => setRemoving(file.id)}
                  >
                    <X />
                  </Button>
                </li>
              ))}
            </ul>
          )}
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
    </aside>
  );
}
