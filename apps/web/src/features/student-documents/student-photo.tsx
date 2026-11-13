"use client";
import { useEffect, useRef, useState, type ReactElement } from "react";
import { toastManager } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { combinePages, loadImage } from "./images";
import { captureRequest } from "./model";
import { ProfilePhotoView } from "./profile-photo-view";

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
          utils.studentDocuments.photos.invalidate(),
          utils.studentDocuments.list.invalidate({ studentId }),
          utils.students.pendingActions.invalidate({ id: studentId }),
          utils.dashboard.invalidate(),
        ]);
      },
    });

  const loading = busy || waitingForPhoto || Boolean(photoUrl && !loaded);
  return (
    <ProfilePhotoView
      subjectLabel="aluno"
      maxSize={MAX_PHOTO_BYTES}
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
      title: "Foto atualizada",
      description: "A nova foto foi salva no cadastro do aluno.",
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
