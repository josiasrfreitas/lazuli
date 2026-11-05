import { useState, type ReactElement } from "react";
import { ToastAlert, Button, FileUpload } from "@lazuli/ui";
import { ArrowLeft, FileCheck2, Paperclip, LoaderCircle, QrCode, X } from "lucide-react";
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
    <aside
      id="student-document-panel"
      className={`dark ${styles.sidePanel}`}
      aria-label="Anexos do aluno"
      data-open={documents.open}
      inert={!documents.open}
    >
      <PanelHeading {...props} />
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
    </aside>
  );
}
function panelViewKey(qr: boolean, selection: Selection | null): string {
  if (qr) return "qr";
  if (!selection) return "list";
  return `${selection.document.id}:${selection.file ? "capture" : "review"}`;
}
function PanelHeading({
  documents,
  selection,
  qr,
  busy,
  setSelection,
  setQr,
  prepare,
}: PanelProps): ReactElement {
  return (
    <div className={styles.heading}>
      <div className={styles.actions}>
        {(qr || selection) && (
          <PanelBackButton
            busy={busy}
            onBack={() => {
              setSelection(null);
              setQr(false);
            }}
          />
        )}
        <h2>{qr ? "Enviar pelo celular" : "Anexos do aluno"}</h2>
      </div>
      <PanelHeadingActions
        documents={documents}
        qr={qr}
        busy={busy}
        setQr={setQr}
        setSelection={setSelection}
        prepare={prepare}
      />
    </div>
  );
}
function PanelHeadingActions({
  documents,
  qr,
  busy,
  setQr,
  setSelection,
  prepare,
}: Pick<
  PanelProps,
  "documents" | "qr" | "busy" | "setQr" | "setSelection" | "prepare"
>): ReactElement {
  return (
    <div className={styles.actions}>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        disabled={busy}
        aria-label="Mostrar QR code"
        title="Enviar pelo celular"
        onClick={() => {
          setQr(!qr);
          setSelection(null);
          prepare();
        }}
      >
        <QrCode />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        disabled={busy}
        aria-label="Fechar anexos"
        onClick={() => documents.setOpen(false)}
      >
        <X />
      </Button>
    </div>
  );
}
function PanelBackButton({ busy, onBack }: { busy: boolean; onBack: () => void }): ReactElement {
  return (
    <Button
      type="button"
      size="icon-sm"
      variant="ghost"
      disabled={busy}
      aria-label="Voltar aos anexos"
      title="Voltar aos anexos"
      onClick={onBack}
    >
      <ArrowLeft aria-hidden="true" />
    </Button>
  );
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
  return (
    <>
      <p>Envie os arquivos pelo computador.</p>
      <ul className={styles.list}>
        {ENROLLMENT_DOCUMENTS.map((document) => (
          <PanelRow
            key={document.id}
            document={document}
            file={documents.query.data?.files.findLast((row) => row.kind === document.id)}
            setSelection={setSelection}
            prepare={prepare}
          />
        ))}
      </ul>
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
    <li className={styles.attachmentRow}>
      <div>
        <strong>{document.title}</strong>
        <small>{document.detail}</small>
      </div>
      <div className={styles.actions}>
        <PanelUpload
          document={document}
          file={file}
          processing={processing}
          setSelection={setSelection}
          prepare={prepare}
        />
        {file && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setSelection({ document })}
          >
            {processing ? <LoaderCircle className={styles.processingSpinner} /> : <FileCheck2 />}
            {file.status === "READY" ? "Conferir" : statusLabel(file.status)}
          </Button>
        )}
      </div>
    </li>
  );
}
function PanelUpload({
  document,
  file,
  processing,
  setSelection,
  prepare,
}: {
  document: DocumentDefinition;
  file: DocumentFileRow | undefined;
  processing: boolean;
  setSelection: (selection: Selection | null) => void;
  prepare: () => void;
}): ReactElement {
  return (
    <FileUpload
      compact
      value={[]}
      accept={DOCUMENT_ACCEPT}
      acceptLabel={DOCUMENT_ACCEPT_LABEL}
      maxSize={26_214_400}
      maxSizeByType={DOCUMENT_SIZE_LIMITS}
      sizeLabel={DOCUMENT_SIZE_LABEL}
      disabled={processing}
      onValueChange={(files) => {
        if (files[0]) {
          setSelection({ document, file: files[0] });
          prepare();
        }
      }}
      renderTrigger={(picker) => (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={picker.disabled}
          onClick={picker.open}
        >
          <Paperclip />
          {file ? "Trocar" : "Enviar"}
        </Button>
      )}
    />
  );
}
