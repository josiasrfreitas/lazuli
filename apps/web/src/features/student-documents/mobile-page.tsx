"use client";
import { useEffect, useState, type ReactElement } from "react";
import { ArrowLeft, ArrowRight, Check, FileText, LoaderCircle } from "lucide-react";
import { Alert, Button } from "@lazuli/ui";
import { BrandSignature } from "~/components/app-shell/brand-signature";
import {
  ENROLLMENT_DOCUMENTS,
  captureRequest,
  statusLabel,
  type CaptureSession,
  type CapturedDocument,
  type DocumentDefinition,
} from "./model";
import { DeleteDocumentButton } from "./delete-document-button";
import { DocumentCapture } from "./capture";
import { DocumentReviewNotice } from "./review-notice";
import { DocumentResult, isDocumentProcessing } from "./result";
import { useCaptureSession } from "./use-capture-session";
import styles from "./documents.module.css";

export function DocumentMobilePage(): ReactElement {
  const [token, setToken] = useState("");
  useEffect(() => {
    setToken(location.hash.slice(1));
  }, []);
  const state = useCaptureSession(token);
  const [selected, setSelected] = useState<DocumentDefinition | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const result = selected ? state.session?.documents[selected.id] : undefined;
  function select(document: DocumentDefinition): void {
    setSelected(document);
    setEditing(!state.session?.documents[document.id]);
  }
  return (
    <main className={styles.mobile}>
      <div className={styles.actions}>
        {selected && state.error !== "closed" && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={busy}
            aria-label="Voltar aos anexos"
            title="Voltar aos anexos"
            onClick={() => setSelected(null)}
          >
            <ArrowLeft aria-hidden="true" />
          </Button>
        )}
        <BrandSignature expanded />
      </div>
      <MobilePageContent
        token={token}
        state={state}
        selected={selected}
        result={result}
        editing={editing}
        busy={busy}
        onSelect={select}
        setSelected={setSelected}
        setEditing={setEditing}
        setBusy={setBusy}
      />
    </main>
  );
}
type MobilePageProps = {
  token: string;
  state: ReturnType<typeof useCaptureSession>;
  selected: DocumentDefinition | null;
  result: CapturedDocument | undefined;
  editing: boolean;
  busy: boolean;
  onSelect: (document: DocumentDefinition) => void;
  setSelected: (document: DocumentDefinition | null) => void;
  setEditing: (editing: boolean) => void;
  setBusy: (busy: boolean) => void;
};
type MobileSelectedProps = Omit<MobilePageProps, "onSelect" | "selected"> & {
  selected: DocumentDefinition;
};
function MobilePageContent({
  token,
  state,
  selected,
  result,
  editing,
  busy,
  onSelect,
  setSelected,
  setEditing,
  setBusy,
}: MobilePageProps): ReactElement {
  if (state.error === "closed")
    return (
      <>
        <h1>Sessão encerrada</h1>
        <p>
          Abra um novo QR code no cadastro para continuar. Os arquivos enviados continuam no
          sistema.
        </p>
      </>
    );
  return (
    <>
      {state.error && <Alert variant="warning">Sem conexão. Tentando novamente…</Alert>}
      {selected ? (
        <MobileSelectedDocument
          token={token}
          state={state}
          selected={selected}
          result={result}
          editing={editing}
          busy={busy}
          setSelected={setSelected}
          setEditing={setEditing}
          setBusy={setBusy}
        />
      ) : (
        <MobileDocumentList token={token} session={state.session} onSelect={onSelect} />
      )}
    </>
  );
}
function MobileSelectedDocument({
  token,
  state,
  selected,
  result,
  editing,
  busy,
  setSelected,
  setEditing,
  setBusy,
}: MobileSelectedProps): ReactElement {
  if (!result || editing)
    return (
      <MobileDocumentEditor
        token={token}
        state={state}
        selected={selected}
        result={result}
        setSelected={setSelected}
        setEditing={setEditing}
        setBusy={setBusy}
      />
    );
  return (
    <>
      <header>
        <h1>{selected.title}</h1>
      </header>
      <DocumentResult token={token} document={selected} result={result} />
      <MobileDocumentActions
        token={token}
        state={state}
        selected={selected}
        result={result}
        busy={busy}
        setSelected={setSelected}
        setEditing={setEditing}
        setBusy={setBusy}
      />
    </>
  );
}
function MobileDocumentActions({
  token,
  state,
  selected,
  result,
  busy,
  setSelected,
  setEditing,
  setBusy,
}: Omit<MobileSelectedProps, "editing">): ReactElement {
  return (
    <div className={styles.actions}>
      <Button type="button" variant="secondary" onClick={() => setSelected(null)}>
        Continuar com os anexos
      </Button>
      {!isDocumentProcessing(result) && (
        <Button type="button" variant="ghost" disabled={busy} onClick={() => setEditing(true)}>
          Trocar arquivo
        </Button>
      )}
      <DeleteDocumentButton
        title={selected.title}
        onBusyChange={setBusy}
        onDelete={async () => {
          await captureRequest(token, { path: `/${selected.id}`, options: { method: "DELETE" } });
        }}
        onDeleted={() => {
          setSelected(null);
          void state.refresh();
        }}
      />
    </div>
  );
}
function MobileDocumentEditor({
  token,
  state,
  selected,
  result,
  setSelected,
  setEditing,
  setBusy,
}: Omit<MobileSelectedProps, "editing" | "busy">): ReactElement {
  return (
    <DocumentCapture
      key={selected.id}
      camera
      hideBack
      onBusyChange={setBusy}
      document={selected}
      token={token}
      result={result}
      pollResult={false}
      onBack={() => setSelected(null)}
      onSent={() => {
        void state.refresh().then(() => setEditing(false));
      }}
    />
  );
}
function MobileDocumentList({
  token,
  session,
  onSelect,
}: {
  token: string;
  session: CaptureSession | null;
  onSelect: (document: DocumentDefinition) => void;
}): ReactElement {
  return (
    <>
      <header>
        <h1>Documentos do cadastro</h1>
        <p>
          Envie fotos ou PDFs por aqui. Os arquivos aparecerão no cadastro aberto no computador.
        </p>
      </header>
      {session ? (
        <div>
          {ENROLLMENT_DOCUMENTS.map((document) => (
            <MobileDocumentAction
              key={document.id}
              document={document}
              result={session.documents[document.id]}
              onSelect={onSelect}
            />
          ))}
        </div>
      ) : (
        <p role="status">
          {token ? "Abrindo sessão…" : "Abra esta página pelo QR code do cadastro."}
        </p>
      )}
      <p>
        JPG, PNG ou PDF. PDFs de até 5 MB são enviados inteiros; confira os dados manualmente. Fotos
        de identidades (RG ou CIN) passam pela leitura automática.
      </p>
      <DocumentReviewNotice />
    </>
  );
}
function MobileDocumentAction({
  document,
  result,
  onSelect,
}: {
  document: DocumentDefinition;
  result: CapturedDocument | undefined;
  onSelect: (document: DocumentDefinition) => void;
}): ReactElement {
  let icon = <FileText aria-hidden="true" />;
  if (isDocumentProcessing(result))
    icon = <LoaderCircle className={styles.processingSpinner} aria-hidden="true" />;
  else if (result?.status === "done") icon = <Check aria-hidden="true" />;
  return (
    <button type="button" className={styles.documentAction} onClick={() => onSelect(document)}>
      {icon}
      <span>
        <strong>{document.title}</strong>
        <small>{document.detail}</small>
        <small>{statusLabel(result?.status)}</small>
      </span>
      <ArrowRight aria-hidden="true" />
    </button>
  );
}
