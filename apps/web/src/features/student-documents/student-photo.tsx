"use client";

import { useEffect, useRef, useState, type ReactElement } from "react";
import { Plus, Upload, UserRound } from "lucide-react";
import {
  Button,
  Dialog,
  DialogBackdrop,
  DialogContent,
  DialogDescription,
  DialogPortal,
  DialogTitle,
  FileUpload,
  toastManager,
} from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { RegistrationDocumentLoading } from "~/features/students/profile/registration-document-preview";
import { combinePages, loadImage } from "./images";
import { captureRequest } from "./model";
import styles from "./documents.module.css";

const MAX_PHOTO_BYTES = 26_214_400;
const PHOTO_REFRESH_MS = 3000;
type PhotoSession = { id: string; token: string };
type StudentPhotoProps = { studentId: string; name: string };

export function StudentPhoto({ studentId, name }: StudentPhotoProps): ReactElement {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [waitingForPhoto, setWaitingForPhoto] = useState(false);
  const beforeUploadId = useRef<string | undefined>(undefined);
  const photo = trpc.studentDocuments.photo.useQuery(
    { studentId },
    { refetchInterval: waitingForPhoto ? PHOTO_REFRESH_MS : false },
  );
  const create = trpc.studentDocuments.create.useMutation();
  const close = trpc.studentDocuments.close.useMutation();
  const utils = trpc.useUtils();
  const photoId = photo.data?.id;
  const photoUrl = photo.data
    ? `/api/student-document-files/${photo.data.id}?v=${photo.data.updatedAt.getTime()}`
    : undefined;

  useEffect(() => {
    if (!waitingForPhoto) return;
    if (photoId && photoId !== beforeUploadId.current) {
      setWaitingForPhoto(false);
      setLoaded(false);
      return;
    }
    const timer = globalThis.setTimeout(() => setWaitingForPhoto(false), 45_000);
    return () => globalThis.clearTimeout(timer);
  }, [photoId, waitingForPhoto]);

  async function upload(file: File): Promise<void> {
    if (!["image/jpeg", "image/png"].includes(file.type) || file.size > MAX_PHOTO_BYTES) {
      toastManager.add({
        title: "Escolha uma foto JPG ou PNG de até 25 MB.",
        type: "error",
      });
      return;
    }
    setBusy(true);
    let session: PhotoSession | undefined;
    try {
      const image = await loadImage(file);
      const body = await combinePages([image]);
      session = await create.mutateAsync({ studentId });
      await captureRequest(session.token, {
        path: "/photo",
        options: { method: "POST", headers: { "Content-Type": "image/jpeg" }, body },
      });
      beforeUploadId.current = photoId;
      setWaitingForPhoto(true);
      void Promise.allSettled([
        photo.refetch(),
        utils.studentDocuments.list.invalidate({ studentId }),
        utils.students.pendingActions.invalidate({ id: studentId }),
        utils.dashboard.invalidate(),
      ]);
      toastManager.add({
        title: "Foto enviada",
        description: "O processamento foi iniciado.",
        type: "success",
      });
    } catch {
      toastManager.add({
        title: "Não foi possível enviar a foto.",
        description: "Escolha o arquivo novamente.",
        type: "error",
      });
    } finally {
      if (session) close.mutate({ id: session.id });
      setBusy(false);
    }
  }

  const loading = busy || waitingForPhoto || Boolean(photoUrl && !loaded);
  return (
    <>
      <button
        type="button"
        className={styles.profilePhotoTrigger}
        data-has-photo={Boolean(photoUrl)}
        aria-label={photoUrl ? `Ver foto de ${name}` : `Adicionar foto de ${name}`}
        title={photoUrl ? "Ver foto do aluno" : "Adicionar foto do aluno"}
        onClick={() => {
          setLoaded(false);
          setOpen(true);
        }}
      >
        <span className={styles.profilePhotoThumb}>
          {photoUrl ? (
            <img src={photoUrl} alt="" />
          ) : (
            <>
              <UserRound aria-hidden="true" />
              <span className={styles.profilePhotoAdd}>
                <Plus aria-hidden="true" />
              </span>
            </>
          )}
        </span>
      </button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!value && !busy) setOpen(false);
        }}
      >
        <DialogPortal>
          <DialogBackdrop />
          <DialogContent
            showCloseButton={false}
            className="student-photo-viewer"
            data-empty={!photoUrl}
          >
            <DialogTitle className="sr-only">Foto do aluno</DialogTitle>
            <DialogDescription className="sr-only">{name}</DialogDescription>
            {photoUrl ? (
              <img
                className={styles.profilePhotoLarge}
                data-loaded={loaded && !busy && !waitingForPhoto}
                src={photoUrl}
                alt={`Foto de ${name}`}
                onLoad={() => setLoaded(true)}
              />
            ) : (
              <span className={styles.profilePhotoEmpty}>
                <UserRound aria-hidden="true" />
              </span>
            )}
            {loading && (
              <div className={styles.profilePhotoUploadLoading}>
                <RegistrationDocumentLoading
                  label={
                    busy
                      ? "Enviando foto…"
                      : waitingForPhoto
                        ? "Processando foto…"
                        : "Carregando foto…"
                  }
                />
              </div>
            )}
            <FileUpload
              compact
              className="student-photo-file-upload"
              value={[]}
              accept="image/jpeg,image/png"
              acceptLabel="JPG ou PNG"
              maxSize={MAX_PHOTO_BYTES}
              disabled={busy || waitingForPhoto}
              onValidationError={(message) => toastManager.add({ title: message, type: "error" })}
              onValueChange={(files) => {
                const file = files[0];
                if (file) void upload(file);
              }}
              renderTrigger={(picker) =>
                !busy && !waitingForPhoto ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon-sm"
                    className="student-photo-upload-button"
                    disabled={picker.disabled}
                    aria-label={photoUrl ? "Atualizar foto" : "Enviar foto"}
                    title={photoUrl ? "Atualizar foto" : "Enviar foto"}
                    onClick={picker.open}
                  >
                    <Upload aria-hidden="true" />
                  </Button>
                ) : null
              }
            />
          </DialogContent>
        </DialogPortal>
      </Dialog>
    </>
  );
}
