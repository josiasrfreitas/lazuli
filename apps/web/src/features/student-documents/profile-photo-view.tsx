"use client";
import type { ReactElement } from "react";
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
import { RegistrationDocumentLoading } from "~/features/students/profile/registration-document-preview";
import styles from "./documents.module.css";

export type ProfilePhotoViewProps = {
  subjectLabel: "aluno" | "professor";
  maxSize: number;
  onPhotoError?: () => void;
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

export function ProfilePhotoView(props: ProfilePhotoViewProps): ReactElement {
  return (
    <>
      <PhotoTrigger {...props} />
      <PhotoDialog {...props} />
    </>
  );
}

function PhotoTrigger({
  name,
  subjectLabel,
  photoUrl,
  setLoaded,
  setOpen,
  onPhotoError,
}: ProfilePhotoViewProps): ReactElement {
  return (
    <button
      type="button"
      className={styles.profilePhotoTrigger}
      data-has-photo={Boolean(photoUrl)}
      aria-label={photoUrl ? `Ver foto de ${name}` : `Adicionar foto de ${name}`}
      title={photoUrl ? `Ver foto do ${subjectLabel}` : `Adicionar foto do ${subjectLabel}`}
      onClick={() => {
        setLoaded(false);
        setOpen(true);
      }}
    >
      <span className={styles.profilePhotoThumb}>
        {photoUrl ? (
          <img src={photoUrl} alt="" onError={onPhotoError} />
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

function PhotoDialog(props: ProfilePhotoViewProps): ReactElement {
  const {
    name,
    subjectLabel,
    photoUrl,
    loaded,
    busy,
    waitingForPhoto,
    loading,
    open,
    setLoaded,
    setOpen,
    onPhotoError,
  } = props;
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
          className="profile-photo-viewer"
          data-empty={!photoUrl}
        >
          <DialogTitle className="sr-only">Foto do {subjectLabel}</DialogTitle>
          <DialogDescription className="sr-only">{name}</DialogDescription>
          {photoUrl ? (
            <img
              className={styles.profilePhotoLarge}
              data-loaded={loaded && !busy && !waitingForPhoto}
              src={photoUrl}
              alt={`Foto de ${name}`}
              onLoad={() => setLoaded(true)}
              onError={onPhotoError}
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
  maxSize,
  photoUrl,
  busy,
  waitingForPhoto,
  onUpload,
}: ProfilePhotoViewProps): ReactElement {
  return (
    <FileUpload
      compact
      className="student-photo-file-upload"
      value={[]}
      accept="image/jpeg,image/png"
      acceptLabel="JPG ou PNG"
      maxSize={maxSize}
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
