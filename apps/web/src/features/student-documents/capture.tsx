"use client";
import { useMemo, type ReactElement } from "react";
import { Button, FileUpload, ToastAlert } from "@lazuli/ui";
import { ArrowLeft } from "lucide-react";
import type { CapturedDocument, DocumentDefinition } from "./model";
import { useCapture, type CaptureOptions, type CaptureState } from "./use-capture";
import { DocumentResult } from "./result";
import { useCaptureSession } from "./use-capture-session";
import styles from "./documents.module.css";
import {
  DOCUMENT_ACCEPT,
  DOCUMENT_ACCEPT_LABEL,
  DOCUMENT_SIZE_LABEL,
  DOCUMENT_SIZE_LIMITS,
} from "./model";
import { PdfPreview, useFileUrl } from "./pdf-preview";
const PREVIEW_QUALITY = 0.85;
const MAX_SOURCE_BYTES = 26_214_400;
export function DocumentCapture(
  props: CaptureOptions & {
    onBack: () => void;
    camera?: boolean;
    embedded?: boolean;
    hideBack?: boolean;
    doneLabel?: string;
    result?: CapturedDocument | undefined;
    pollResult?: boolean;
  },
): ReactElement {
  const state = useCapture(props);
  const tracking = useCaptureSession(props.token, state.sent && props.pollResult !== false);
  const previews = useMemo(
    () => state.pages.map((page) => page.toDataURL("image/jpeg", PREVIEW_QUALITY)),
    [state.pages],
  );
  return (
    <section className={styles.capture}>
      <CaptureHeading props={props} busy={state.busy} />
      {state.error && <ToastAlert variant="destructive">{state.error}</ToastAlert>}
      <CaptureStateView props={props} state={state} tracking={tracking} previews={previews} />
    </section>
  );
}
type CaptureProps = Parameters<typeof DocumentCapture>[0];
function CaptureHeading({ props, busy }: { props: CaptureProps; busy: boolean }): ReactElement {
  if (props.embedded) return <></>;
  return (
    <>
      {!props.hideBack && (
        <div className={styles.backAction}>
          <Button variant="ghost" disabled={busy} onClick={props.onBack}>
            <ArrowLeft /> Voltar aos anexos
          </Button>
        </div>
      )}
      <header>
        <h2>{props.document.title}</h2>
        <p>{props.document.detail}</p>
      </header>
    </>
  );
}
function CaptureStateView({
  props,
  state,
  tracking,
  previews,
}: {
  props: CaptureProps;
  state: CaptureState;
  tracking: ReturnType<typeof useCaptureSession>;
  previews: string[];
}): ReactElement {
  if (!state.sent)
    return <CaptureBody state={state} document={props.document} camera={props.camera ?? false} />;
  const result = currentCaptureResult(
    props.result ?? tracking.session?.documents[props.document.id],
    state.receipt,
  );
  return (
    <>
      <DocumentResult
        token={props.token}
        document={props.document}
        result={result}
        previews={previews}
      />
      {tracking.error && (
        <p role="status">Não foi possível atualizar a leitura. A foto enviada foi preservada.</p>
      )}
      <div className={styles.backAction}>
        <Button type="button" variant="secondary" onClick={props.onBack}>
          {props.doneLabel ?? "Continuar com os anexos"}
        </Button>
      </div>
    </>
  );
}
function currentCaptureResult(
  latest: CapturedDocument | undefined,
  receipt: CapturedDocument | null,
): CapturedDocument | undefined {
  if (latest && (!receipt || latest.revision >= receipt.revision)) return latest;
  return receipt ?? undefined;
}
function CaptureBody({
  state,
  document,
  camera,
}: {
  state: CaptureState;
  document: DocumentDefinition;
  camera: boolean;
}): ReactElement {
  const pdfUrl = useFileUrl(state.pdf);
  if (state.source)
    return (
      <div className={styles.stack}>
        <h3>Ajuste o recorte</h3>
        <p>Arraste os quatro cantos até as bordas do documento.</p>
        <div className={styles.editor} ref={state.host} />
      </div>
    );
  return (
    <>
      {pdfUrl ? (
        <>
          <PdfPreview src={pdfUrl} title={state.pdf?.name ?? document.title} />
          <p>O PDF será enviado inteiro. Confira os dados cadastrais manualmente.</p>
        </>
      ) : (
        <CapturePreviews pages={state.pages} document={document} />
      )}
      <CaptureFilePicker state={state} document={document} camera={camera} />
      {state.error && <p role="alert">{state.error}</p>}
      <CaptureActions state={state} document={document} />
    </>
  );
}
function CaptureFilePicker({
  state,
  document,
  camera,
}: {
  state: CaptureState;
  document: DocumentDefinition;
  camera: boolean;
}): ReactElement | null {
  if (state.pdf || state.pages.length >= (document.extracts ? 2 : 1)) return null;
  const isPhoto = document.id === "photo";
  const reverse = state.pages.length > 0;
  return (
    <FileUpload
      compact
      camera={camera && !isPhoto}
      value={[]}
      onValueChange={(files) => void state.choose(files)}
      accept={isPhoto || reverse ? "image/jpeg,image/png" : DOCUMENT_ACCEPT}
      acceptLabel={captureAcceptLabel(isPhoto, reverse)}
      maxSize={MAX_SOURCE_BYTES}
      maxSizeByType={DOCUMENT_SIZE_LIMITS}
      sizeLabel={!isPhoto && !reverse ? DOCUMENT_SIZE_LABEL : undefined}
      disabled={state.busy}
    />
  );
}
function captureAcceptLabel(isPhoto: boolean, reverse: boolean): string {
  if (reverse) return "Foto do verso · JPG ou PNG";
  return isPhoto ? "Foto · JPG ou PNG" : DOCUMENT_ACCEPT_LABEL;
}
function CapturePreviews({
  pages,
  document,
}: {
  pages: HTMLCanvasElement[];
  document: DocumentDefinition;
}): ReactElement {
  return (
    <div className={styles.pages}>
      {pages.map((page, index) => (
        <figure key={index}>
          <img
            src={page.toDataURL("image/jpeg", PREVIEW_QUALITY)}
            alt={index ? "Verso recortado" : document.title}
          />
          <figcaption>{document.extracts ? (index ? "Verso" : "Frente") : "Prévia"}</figcaption>
        </figure>
      ))}
    </div>
  );
}
function CaptureActions({
  state,
  document,
}: {
  state: CaptureState;
  document: DocumentDefinition;
}): ReactElement {
  return (
    <>
      <div className={styles.actions}>
        {(state.pdf || state.pages.length > 0) && (
          <>
            <Button loading={state.busy} onClick={() => void state.send()}>
              {!state.pdf && document.extracts && state.pages.length === 1
                ? "Enviar somente frente"
                : "Enviar arquivo"}
            </Button>
            <Button variant="ghost" disabled={state.busy} onClick={state.reset}>
              Refazer seleção
            </Button>
          </>
        )}
      </div>
      {document.extracts && state.pages.length === 1 && (
        <p>
          Adicione o verso acima para uma leitura completa. Frente e verso serão processados juntos.
        </p>
      )}
    </>
  );
}
