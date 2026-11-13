import { useState, type ReactElement } from "react";
import {
  AttachmentPanel,
  AttachmentUploadRow,
  AttachmentAdd,
  ToastAlert,
  Button,
} from "@lazuli/ui";
import { FileCheck2, Paperclip, LoaderCircle } from "lucide-react";
import { ENROLLMENT_DOCUMENTS, statusLabel, type DocumentDefinition } from "./model";
import { SessionLink } from "./qr-dialog";
import { DocumentCapture } from "./capture";
import { DocumentReviewNotice } from "./review-notice";
import type { DocumentSelection, EnrollmentDocuments } from "./use-enrollment-documents";
import { DocumentProcessing, ExtractedDocumentData } from "./result";
import styles from "./documents.module.css";
import {
  DOCUMENT_ACCEPT,
  DOCUMENT_ACCEPT_LABEL,
  DOCUMENT_SIZE_LABEL,
  DOCUMENT_SIZE_LIMITS,
} from "./model";
import { PdfPreview } from "./pdf-preview";
import { StudentDocumentDeleteButton } from "./delete-document-button";

type DocumentFileRow = NonNullable<EnrollmentDocuments["query"]["data"]>["files"][number];
type Selection = DocumentSelection;
type PanelProps = {
  documents: EnrollmentDocuments;
  selection: Selection | null;
  qr: boolean;
  busy: boolean;
  setSelection: (selection: Selection | null) => void;
  setQr: (qr: boolean) => void;
  setBusy: (busy: boolean) => void;
  prepare: () => void;
};

export function StudentDocumentButton({
  documents,
}: {
  documents: EnrollmentDocuments;
}): ReactElement {
  const processing = documents.query.data?.files.some(
    (file) => file.status === "RECEIVED" || file.status === "PROCESSING",
  );
  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      aria-expanded={documents.open}
      aria-controls="student-document-panel"
      onClick={() => {
        documents.setOpen(true);
        void documents.ensureSession().catch(() => {});
      }}
    >
      {processing ? (
        <LoaderCircle className={styles.processingSpinner} aria-hidden="true" />
      ) : (
        <Paperclip aria-hidden="true" />
      )}{" "}
      Anexos
    </Button>
  );
}

export function StudentDocumentPanel({
  documents,
}: {
  documents: EnrollmentDocuments;
}): ReactElement {
  const { selection, setSelection, captureBusy: busy, setCaptureBusy: setBusy } = documents;
  const [qr, setQr] = useState(false);
  const selectedFile = documents.query.data?.files.findLast(
    (file) => file.kind === selection?.document.id,
  );
  function prepare(): void {
    void documents.ensureSession().catch(() => {});
  }
  const props = { documents, selection, qr, busy, setSelection, setQr, setBusy, prepare };
  return (
    <AttachmentPanel
      id="student-document-panel"
      className={styles.sidePanel}
      open={documents.open}
      title={qr ? "Enviar pelo celular" : "Anexos do aluno"}
      busy={busy}
      onBack={
        qr || selection
          ? () => {
              setSelection(null);
              setQr(false);
            }
          : undefined
      }
      onMobile={() => {
        setQr(!qr);
        setSelection(null);
        prepare();
      }}
      onClose={() => documents.setOpen(false)}
    >
      {documents.create.isError && !documents.session && (
        <ToastAlert variant="destructive">
          Não foi possível preparar o envio.
          <Button type="button" variant="ghost" onClick={prepare}>
            Tentar novamente
          </Button>
        </ToastAlert>
      )}
      <div className={styles.panelView} key={panelViewKey(qr, selection)}>
        <PanelContent {...props} selectedFile={selectedFile} />
      </div>
      <DocumentReviewNotice />
    </AttachmentPanel>
  );
}
function panelViewKey(qr: boolean, selection: Selection | null): string {
  if (qr) return "qr";
  if (!selection) return "list";
  return `${selection.document.id}:${selection.file ? "capture" : "review"}`;
}
function PanelContent({
  documents,
  selection,
  qr,
  selectedFile,
  setSelection,
  setBusy,
  prepare,
}: PanelProps & {
  selectedFile: DocumentFileRow | undefined;
}): ReactElement {
  if (qr)
    return documents.session ? (
      <>
        <p>Escaneie para enviar os documentos pelo celular.</p>
        <SessionLink token={documents.session.token} />
      </>
    ) : (
      <p role="status">Preparando QR code…</p>
    );
  if (selection?.file)
    return documents.session ? (
      <DocumentCapture
        key={`${selection.document.id}:${selection.file.lastModified}`}
        embedded
        document={selection.document}
        token={documents.session.token}
        initialFile={selection.file}
        onBack={() => setSelection(null)}
        onBusyChange={setBusy}
        onSent={() => {
          void documents.query.refetch();
          documents.setCaptureBusy(false);
          setSelection({ document: selection.document });
        }}
      />
    ) : (
      <p role="status">Preparando envio…</p>
    );
  if (selection && selectedFile)
    return (
      <PanelReview
        selection={selection}
        file={selectedFile}
        setBusy={setBusy}
        onDeleted={() => setSelection(null)}
      />
    );
  return <PanelList documents={documents} setSelection={setSelection} prepare={prepare} />;
}
function PanelReview({
  selection,
  file,
  setBusy,
  onDeleted,
}: {
  selection: Selection;
  file: DocumentFileRow;
  setBusy: (busy: boolean) => void;
  onDeleted: () => void;
}): ReactElement {
  const url = `/api/student-document-files/${file.id}?v=${file.updatedAt.getTime()}`;
  return (
    <div className={styles.stack}>
      <h3>{selection.document.title}</h3>
      <DocumentProcessing
        result={{
          status: file.status,
          revision: file.updatedAt.toISOString(),
          format: file.format,
        }}
        extracts={selection.document.extracts}
      />
      <div className={styles.resultGrid}>
        <div className={styles.resultImages}>
          {file.format === "pdf" ? (
            <PdfPreview src={url} title={selection.document.title} />
          ) : (
            <img src={url} alt={selection.document.title} />
          )}
        </div>
        <ExtractedDocumentData extraction={file.extraction} />
      </div>
      <StudentDocumentDeleteButton
        fileId={file.id}
        title={selection.document.title}
        onBusyChange={setBusy}
        onDeleted={onDeleted}
      />
    </div>
  );
}
function PanelList({
  documents,
  setSelection,
  prepare,
}: {
  documents: EnrollmentDocuments;
  setSelection: (selection: Selection | null) => void;
  prepare: () => void;
}): ReactElement {
  const { extras, setExtras } = documents;
  const saved = (documents.query.data?.files ?? [])
    .filter((file) => file.kind.startsWith("custom_"))
    .map((file) => ({
      id: file.kind as `custom_${string}`,
      title: file.title ?? "Documento",
      detail: file.subtitle ?? "",
      extracts: false,
    }));
  const definitions = [
    ...ENROLLMENT_DOCUMENTS,
    ...saved,
    ...extras.filter((item) => !saved.some((file) => file.id === item.id)),
  ];
  return (
    <>
      <ul>
        {definitions.map((document) => (
          <PanelRow
            key={document.id}
            document={document}
            file={documents.query.data?.files.findLast((row) => row.kind === document.id)}
            setSelection={setSelection}
            prepare={prepare}
          />
        ))}
      </ul>
      <AttachmentAdd
        disabled={documents.captureBusy}
        onAdd={({ title, subtitle }) =>
          setExtras((previous) => [
            ...previous,
            { id: `custom_${crypto.randomUUID()}`, title, detail: subtitle, extracts: false },
          ])
        }
      />
    </>
  );
}
function PanelRow({
  document,
  file,
  setSelection,
  prepare,
}: {
  document: DocumentDefinition;
  file: DocumentFileRow | undefined;
  setSelection: (selection: Selection | null) => void;
  prepare: () => void;
}): ReactElement {
  const processing = file?.status === "RECEIVED" || file?.status === "PROCESSING";
  return (
    <AttachmentUploadRow
      title={document.title}
      subtitle={document.detail}
      uploaded={Boolean(file)}
      disabled={processing}
      accept={DOCUMENT_ACCEPT}
      acceptLabel={DOCUMENT_ACCEPT_LABEL}
      maxSize={26_214_400}
      maxSizeByType={DOCUMENT_SIZE_LIMITS}
      sizeLabel={DOCUMENT_SIZE_LABEL}
      onFile={(file) => {
        setSelection({ document, file });
        prepare();
      }}
    >
      {file && (
        <Button type="button" size="sm" variant="ghost" onClick={() => setSelection({ document })}>
          {processing ? <LoaderCircle className={styles.processingSpinner} /> : <FileCheck2 />}
          {file.status === "READY" ? "Conferir" : statusLabel(file.status)}
        </Button>
      )}
    </AttachmentUploadRow>
  );
}
