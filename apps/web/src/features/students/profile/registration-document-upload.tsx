"use client";
import { useEffect, useState, type Dispatch, type ReactElement, type SetStateAction } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { DocumentCapture } from "~/features/student-documents/capture";
import type { DocumentDefinition } from "~/features/student-documents/model";
import { RegistrationDocumentLoading } from "./registration-document-preview";
import styles from "./student-registration.module.css";

type UploadProps = {
  studentId: string;
  document: DocumentDefinition;
  onBack: () => void;
  onSent: () => void;
  onBusyChange: (busy: boolean) => void;
};
type UploadSession = { id: string; token: string };

function useUploadSession(studentId: string): {
  session: UploadSession | null;
  failed: boolean;
  busy: boolean;
  setBusy: Dispatch<SetStateAction<boolean>>;
  retry: () => void;
} {
  const create = trpc.studentDocuments.create.useMutation();
  const close = trpc.studentDocuments.close.useMutation();
  const [session, setSession] = useState<UploadSession | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const createSession = create.mutateAsync;
  const closeSession = close.mutate;
  useEffect(() => {
    let cancelled = false;
    let sessionId: string | undefined;
    setFailed(false);
    void createSession({ studentId })
      .then((created) => {
        sessionId = created.id;
        if (cancelled) closeSession({ id: created.id });
        else setSession(created);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (sessionId) closeSession({ id: sessionId });
    };
  }, [studentId, attempt, createSession, closeSession]);
  return { session, failed, busy, setBusy, retry: () => setAttempt((value) => value + 1) };
}

export function RegistrationDocumentUpload({
  studentId,
  document,
  onBack,
  onSent,
  onBusyChange,
}: UploadProps): ReactElement {
  const upload = useUploadSession(studentId);
  return (
    <div className={styles.upload}>
      <div className={styles.uploadHeader}>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Voltar aos documentos"
          disabled={upload.busy}
          onClick={onBack}
        >
          <ArrowLeft aria-hidden="true" />
        </Button>
        <h3>{document.title}</h3>
      </div>
      <UploadBody
        upload={upload}
        document={document}
        onBack={onBack}
        onSent={onSent}
        onBusyChange={onBusyChange}
      />
    </div>
  );
}

function UploadBody({
  upload,
  document,
  onBack,
  onSent,
  onBusyChange,
}: Omit<UploadProps, "studentId"> & { upload: ReturnType<typeof useUploadSession> }): ReactElement {
  if (upload.failed)
    return (
      <div role="alert">
        <p>Não foi possível iniciar o envio.</p>
        <Button variant="secondary" size="sm" onClick={upload.retry}>
          Tentar novamente
        </Button>
      </div>
    );
  if (!upload.session)
    return (
      <div className={styles.preview}>
        <RegistrationDocumentLoading label="Preparando envio…" />
      </div>
    );
  return (
    <DocumentCapture
      embedded
      document={document}
      token={upload.session.token}
      doneLabel="Ver documentos"
      onBack={onBack}
      onBusyChange={(value) => {
        upload.setBusy(value);
        onBusyChange(value);
      }}
      onSent={onSent}
    />
  );
}
