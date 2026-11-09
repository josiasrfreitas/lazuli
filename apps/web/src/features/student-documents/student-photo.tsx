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

  usePhotoWait({ waitingForPhoto, photoId, beforeUploadId, setWaitingForPhoto, setLoaded });

  const upload = (file: File): Promise<void> =>
    uploadPhoto({
      file,
      photoId,
      beforeUploadId,
      setBusy,
      setWaitingForPhoto,
      createSession: () => create.mutateAsync({ studentId }),
      closeSession: (id) => {
        close.mutate({ id });
      },
      refresh: () => {
        void Promise.allSettled([
          photo.refetch(),
          utils.studentDocuments.list.invalidate({ studentId }),
          utils.students.pendingActions.invalidate({ id: studentId }),
          utils.dashboard.invalidate(),
        ]);
      },
    });

  const loading = busy || waitingForPhoto || Boolean(photoUrl && !loaded);
  return (
    <StudentPhotoView
      name={name}
      photoUrl={photoUrl}
      loaded={loaded}
      busy={busy}
      waitingForPhoto={waitingForPhoto}
      loading={loading}
      open={open}
      setLoaded={setLoaded}
      setOpen={setOpen}
      onUpload={upload}
    />
  );
}

const PHOTO_PROCESSING_TIMEOUT_MS = 45_000;

type PhotoWaitInput = {
  waitingForPhoto: boolean;
  photoId: string | undefined;
  beforeUploadId: { current: string | undefined };
  setWaitingForPhoto: (waiting: boolean) => void;
  setLoaded: (loaded: boolean) => void;
};

function usePhotoWait(input: PhotoWaitInput): void {
  const { waitingForPhoto, photoId, beforeUploadId, setWaitingForPhoto, setLoaded } = input;
  useEffect(() => {
    if (!waitingForPhoto) return;
    if (photoId && photoId !== beforeUploadId.current) {
      setWaitingForPhoto(false);
      setLoaded(false);
      return;
    }
    const timer = globalThis.setTimeout(
      () => setWaitingForPhoto(false),
      PHOTO_PROCESSING_TIMEOUT_MS,
    );
    return () => globalThis.clearTimeout(timer);
  }, [photoId, waitingForPhoto, beforeUploadId, setWaitingForPhoto, setLoaded]);
}

type PhotoUploadInput = {
  file: File;
  photoId: string | undefined;
  beforeUploadId: { current: string | undefined };
  setBusy: (busy: boolean) => void;
  setWaitingForPhoto: (waiting: boolean) => void;
  createSession: () => Promise<PhotoSession>;
  closeSession: (id: string) => void;
  refresh: () => void;
};

async function uploadPhoto(input: PhotoUploadInput): Promise<void> {
  const { file } = input;
  if (!["image/jpeg", "image/png"].includes(file.type) || file.size > MAX_PHOTO_BYTES) {
    toastManager.add({ title: "Escolha uma foto JPG ou PNG de até 25 MB.", type: "error" });
    return;
  }
  input.setBusy(true);
  let session: PhotoSession | undefined;
  try {
    const image = await loadImage(file);
    const body = await combinePages([image]);
    session = await input.createSession();
    await captureRequest(session.token, {
      path: "/photo",
      options: { method: "POST", headers: { "Content-Type": "image/jpeg" }, body },
    });
    input.beforeUploadId.current = input.photoId;
    input.setWaitingForPhoto(true);
    input.refresh();
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
    if (session) input.closeSession(session.id);
    input.setBusy(false);
  }
}

type PhotoViewProps = {
  name: string;
  photoUrl: string | undefined;
  loaded: boolean;
  busy: boolean;
  waitingForPhoto: boolean;
  loading: boolean;
  open: boolean;
  setLoaded: (loaded: boolean) => void;
  setOpen: (open: boolean) => void;
  onUpload: (file: File) => Promise<void>;
};

function StudentPhotoView(props: PhotoViewProps): ReactElement {
  return (
    <>
      <PhotoTrigger {...props} />
      <PhotoDialog {...props} />
    </>
  );
}

function PhotoTrigger({ name, photoUrl, setLoaded, setOpen }: PhotoViewProps): ReactElement {
  return (
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
  );
}

function photoLoadingLabel(busy: boolean, waitingForPhoto: boolean): string {
  if (busy) return "Enviando foto…";
  return waitingForPhoto ? "Processando foto…" : "Carregando foto…";
}

function PhotoDialog(props: PhotoViewProps): ReactElement {
  const { name, photoUrl, loaded, busy, waitingForPhoto, loading, open, setLoaded, setOpen } =
    props;
  return (
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
              <RegistrationDocumentLoading label={photoLoadingLabel(busy, waitingForPhoto)} />
            </div>
          )}
          <PhotoFileUpload {...props} />
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}

function PhotoFileUpload({
  photoUrl,
  busy,
  waitingForPhoto,
  onUpload,
}: PhotoViewProps): ReactElement {
  return (
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
        if (file) void onUpload(file);
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
  );
}
