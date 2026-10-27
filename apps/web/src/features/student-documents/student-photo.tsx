"use client";
import { useState, type Dispatch, type ReactElement, type SetStateAction } from "react";
import { Camera, LoaderCircle, Plus, UserRound } from "lucide-react";
import {
  Button,
  Dialog,
  DialogPortal,
  DialogBackdrop,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Alert,
} from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { DocumentCapture } from "./capture";
import { DOCUMENTS } from "./model";
import styles from "./documents.module.css";

type PhotoSession = { id: string; token: string };
type StudentPhotoProps = { studentId: string; name: string };
type PhotoActionsArgs = {
  studentId: string;
  session: PhotoSession | null;
  busy: boolean;
  createSession: (input: { studentId: string }) => Promise<PhotoSession>;
  closeSession: (input: { id: string }) => void;
  refetchPhoto: () => Promise<void>;
  setSession: Dispatch<SetStateAction<PhotoSession | null>>;
  setEditing: Dispatch<SetStateAction<boolean>>;
  setOpen: Dispatch<SetStateAction<boolean>>;
  setViewerLoaded: Dispatch<SetStateAction<boolean>>;
};

function createPhotoActions(args: PhotoActionsArgs): {
  startUpload: () => Promise<void>;
  returnToPhoto: () => Promise<void>;
  finish: () => void;
} {
  async function startUpload(): Promise<void> {
    args.setEditing(true);
    try {
      args.setSession(await args.createSession({ studentId: args.studentId }));
    } catch {
      /* The upload view offers a retry. */
    }
  }
  async function returnToPhoto(): Promise<void> {
    if (args.session) args.closeSession({ id: args.session.id });
    args.setSession(null);
    await args.refetchPhoto();
    args.setViewerLoaded(false);
    args.setEditing(false);
  }
  function finish(): void {
    if (args.busy) return;
    if (args.session) args.closeSession({ id: args.session.id });
    args.setSession(null);
    args.setEditing(false);
    args.setOpen(false);
    void args.refetchPhoto();
  }
  return { startUpload, returnToPhoto, finish };
}

export function StudentPhoto({ studentId, name }: StudentPhotoProps): ReactElement {
  const photo = trpc.studentDocuments.photo.useQuery({ studentId });
  const create = trpc.studentDocuments.create.useMutation();
  const close = trpc.studentDocuments.close.useMutation();
  const [session, setSession] = useState<PhotoSession | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [viewerLoaded, setViewerLoaded] = useState(false);
  const photoUrl = photo.data
    ? `/api/student-document-files/${photo.data.id}?v=${photo.data.updatedAt.getTime()}`
    : undefined;

  const { startUpload, returnToPhoto, finish } = createPhotoActions({
    studentId,
    session,
    busy,
    createSession: create.mutateAsync,
    closeSession: close.mutate,
    refetchPhoto: async () => {
      await photo.refetch();
    },
    setSession,
    setEditing,
    setOpen,
    setViewerLoaded,
  });

  return (
    <PhotoDialog
      name={name}
      open={open}
      editing={editing}
      session={session}
      createError={create.isError}
      photoUrl={photoUrl}
      viewerLoaded={viewerLoaded}
      onFinish={finish}
      onRetry={startUpload}
      onBack={returnToPhoto}
      onBusyChange={setBusy}
      onSent={() => void photo.refetch()}
      onLoad={() => setViewerLoaded(true)}
      onOpen={() => {
        setViewerLoaded(false);
        setOpen(true);
      }}
    />
  );
}

type PhotoDialogProps = {
  name: string;
  open: boolean;
  editing: boolean;
  session: PhotoSession | null;
  createError: boolean;
  photoUrl: string | undefined;
  viewerLoaded: boolean;
  onFinish: () => void;
  onRetry: () => Promise<void>;
  onBack: () => Promise<void>;
  onBusyChange: (busy: boolean) => void;
  onSent: () => void;
  onLoad: () => void;
  onOpen: () => void;
};

function PhotoDialog(props: PhotoDialogProps): ReactElement {
  return (
    <>
      <PhotoTrigger
        name={props.name}
        photoUrl={props.photoUrl}
        onOpen={props.onOpen}
        onUpload={props.onRetry}
      />
      <Dialog
        open={props.open}
        onOpenChange={(value) => {
          if (!value) props.onFinish();
        }}
      >
        <DialogPortal>
          <DialogBackdrop />
          {props.editing ? (
            <PhotoUpload
              name={props.name}
              session={props.session}
              createError={props.createError}
              onRetry={props.onRetry}
              onBack={props.onBack}
              onBusyChange={props.onBusyChange}
              onSent={props.onSent}
            />
          ) : (
            <PhotoViewer
              name={props.name}
              photoUrl={props.photoUrl}
              loaded={props.viewerLoaded}
              onLoad={props.onLoad}
              onUpload={props.onRetry}
            />
          )}
        </DialogPortal>
      </Dialog>
    </>
  );
}

function PhotoTrigger({
  name,
  photoUrl,
  onOpen,
  onUpload,
}: {
  name: string;
  photoUrl: string | undefined;
  onOpen: () => void;
  onUpload: () => Promise<void>;
}): ReactElement {
  return (
    <button
      type="button"
      className={styles.profilePhotoTrigger}
      data-has-photo={Boolean(photoUrl)}
      aria-label={photoUrl ? `Ver foto de ${name}` : `Adicionar foto de ${name}`}
      title={photoUrl ? "Ver foto do aluno" : "Adicionar foto do aluno"}
      onClick={() => {
        onOpen();
        if (!photoUrl) void onUpload();
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

function PhotoUpload({
  name,
  session,
  createError,
  onRetry,
  onBack,
  onBusyChange,
  onSent,
}: {
  name: string;
  session: { id: string; token: string } | null;
  createError: boolean;
  onRetry: () => Promise<void>;
  onBack: () => Promise<void>;
  onBusyChange: (busy: boolean) => void;
  onSent: () => void;
}): ReactElement {
  return (
    <DialogContent className="student-photo-upload-dialog">
      <DialogHeader>
        <DialogTitle>Foto do aluno</DialogTitle>
        <DialogDescription>{name}</DialogDescription>
      </DialogHeader>
      <PhotoUploadBody
        createError={createError}
        session={session}
        onRetry={onRetry}
        onBack={onBack}
        onBusyChange={onBusyChange}
        onSent={onSent}
      />
    </DialogContent>
  );
}

function PhotoUploadBody({
  createError,
  session,
  onRetry,
  onBack,
  onBusyChange,
  onSent,
}: Omit<Parameters<typeof PhotoUpload>[0], "name">): ReactElement {
  if (createError && !session)
    return (
      <Alert variant="destructive">
        Não foi possível iniciar o envio.
        <Button onClick={() => void onRetry()}>Tentar novamente</Button>
      </Alert>
    );
  if (!session) return <p role="status">Preparando envio…</p>;
  return (
    <DocumentCapture
      key={session.id}
      embedded
      document={DOCUMENTS.find((document) => document.id === "photo")!}
      token={session.token}
      onBack={() => {
        void onBack();
      }}
      doneLabel="Ver foto"
      onBusyChange={onBusyChange}
      onSent={onSent}
    />
  );
}

function PhotoViewer({
  name,
  photoUrl,
  loaded,
  onLoad,
  onUpload,
}: {
  name: string;
  photoUrl: string | undefined;
  loaded: boolean;
  onLoad: () => void;
  onUpload: () => Promise<void>;
}): ReactElement {
  return (
    <DialogContent showCloseButton={false} className="student-photo-viewer">
      <DialogTitle className="sr-only">Foto do aluno</DialogTitle>
      <DialogDescription className="sr-only">{name}</DialogDescription>
      {photoUrl && (
        <>
          {!loaded && (
            <span className={styles.profilePhotoLoading} role="status" aria-label="Carregando foto">
              <LoaderCircle aria-hidden="true" />
            </span>
          )}
          <img
            className={styles.profilePhotoLarge}
            data-loaded={loaded}
            src={photoUrl}
            alt={`Foto de ${name}`}
            onLoad={onLoad}
          />
        </>
      )}
      <Button
        type="button"
        variant="secondary"
        size="icon-sm"
        className="student-photo-upload-button"
        aria-label="Atualizar foto"
        title="Atualizar foto"
        onClick={() => void onUpload()}
      >
        <Camera aria-hidden="true" />
      </Button>
    </DialogContent>
  );
}
