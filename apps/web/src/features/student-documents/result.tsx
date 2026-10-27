import { useEffect, useState, type ReactElement } from "react";
import { LoaderCircle, Check, AlertCircle } from "lucide-react";
import type { CapturedDocument, DocumentDefinition, DocumentJson } from "./model";
import { extractionSchema } from "./prefill";
import styles from "./documents.module.css";
import { PdfPreview } from "./pdf-preview";

export function isDocumentProcessing(result?: CapturedDocument): boolean {
  return (
    result?.status === "working" || result?.status === "RECEIVED" || result?.status === "PROCESSING"
  );
}
export function DocumentProcessing({
  result,
  extracts,
}: {
  result?: CapturedDocument | undefined;
  extracts: boolean;
}): ReactElement {
  if (result?.format === "pdf")
    return (
      <p className={styles.processing} role="status">
        <Check aria-hidden="true" />
        <span>PDF enviado. Confira os dados cadastrais manualmente.</span>
      </p>
    );
  const working = !result || isDocumentProcessing(result);
  const failed = result?.status === "error" || result?.status === "FAILED";
  return (
    <p className={styles.processing} role="status" aria-live="polite">
      <ProcessingIcon working={working} failed={failed} />
      <span>{processingMessage({ working, failed, extracts })}</span>
    </p>
  );
}
function ProcessingIcon({ working, failed }: { working: boolean; failed: boolean }): ReactElement {
  if (working) return <LoaderCircle className={styles.processingSpinner} aria-hidden="true" />;
  return failed ? <AlertCircle aria-hidden="true" /> : <Check aria-hidden="true" />;
}
function processingMessage({
  working,
  failed,
  extracts,
}: {
  working: boolean;
  failed: boolean;
  extracts: boolean;
}): string {
  if (working)
    return extracts
      ? "Lendo os dados… Você pode enviar os outros documentos."
      : "Salvando arquivo…";
  if (failed) return "Não foi possível ler os dados. O arquivo foi salvo.";
  return extracts ? "Leitura concluída. Confira os dados abaixo." : "Arquivo enviado.";
}
function usePreview({
  token,
  document,
  result,
  enabled,
}: {
  token: string;
  document: DocumentDefinition;
  result: CapturedDocument | undefined;
  enabled: boolean;
}): string | undefined {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!enabled || !result || !token) return;
    const controller = new AbortController();
    let objectUrl: string | undefined;
    setUrl(undefined);
    async function load(): Promise<void> {
      const response = await fetch(`/api/student-documents/${document.id}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) return;
      const blob = await response.blob();
      if (controller.signal.aborted) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    }
    void load().catch(() => {});
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [token, document.id, result?.revision, enabled]);
  return url;
}
export function DocumentResult({
  token,
  document,
  result,
  previews = [],
}: {
  token: string;
  document: DocumentDefinition;
  result?: CapturedDocument | undefined;
  previews?: string[];
}): ReactElement {
  const storedPreview = usePreview({ token, document, result, enabled: previews.length === 0 });
  const images = previewImages(previews, storedPreview);
  return (
    <section className={styles.stack}>
      <DocumentProcessing result={result} extracts={document.extracts} />
      {result?.format === "pdf" ? (
        <PdfResultPreview src={storedPreview} title={document.title} />
      ) : (
        <ImageResultPreview images={images} document={document} extraction={result?.extraction} />
      )}
    </section>
  );
}
function previewImages(previews: string[], storedPreview: string | undefined): string[] {
  if (previews.length > 0) return previews;
  return storedPreview ? [storedPreview] : [];
}
function PdfResultPreview({
  src,
  title,
}: {
  src: string | undefined;
  title: string;
}): ReactElement {
  return src ? <PdfPreview src={src} title={title} /> : <p role="status">Carregando PDF…</p>;
}
function ImageResultPreview({
  images,
  document,
  extraction,
}: {
  images: string[];
  document: DocumentDefinition;
  extraction: DocumentJson | undefined;
}): ReactElement {
  return (
    <div className={styles.resultGrid}>
      <div className={styles.resultImages}>
        {images.map((src, index) => (
          <img
            key={src}
            src={src}
            alt={imageDescription(document, { count: images.length, index })}
          />
        ))}
        {images.length === 0 && <p>Carregando prévia…</p>}
      </div>
      {document.extracts && <ExtractedDocumentData extraction={extraction} />}
    </div>
  );
}
function imageDescription(
  document: DocumentDefinition,
  { count, index }: { count: number; index: number },
): string {
  if (count <= 1) return `${document.title} — foto enviada`;
  return `${document.title} — ${index === 0 ? "frente" : "verso"}`;
}
const NOT_IDENTIFIED = "Não identificado";
export function ExtractedDocumentData({
  extraction,
}: {
  extraction: DocumentJson | undefined;
}): ReactElement | null {
  const parsed = extractionSchema.safeParse(extraction);
  if (!parsed.success) return null;
  const fields = parsed.data.fields;
  return (
    <div>
      <dl className={styles.extracted}>
        <div className={styles.extractedFullWidth}>
          <dt>Nome</dt>
          <dd>{fields.name ?? NOT_IDENTIFIED}</dd>
        </div>
        <div>
          <dt>CPF</dt>
          <dd>{fields.cpf ?? NOT_IDENTIFIED}</dd>
        </div>
        <div>
          <dt>RG</dt>
          <dd>{fields.rg ?? "Não identificado / CIN"}</dd>
        </div>
        <div className={styles.extractedFullWidth}>
          <dt>Nascimento</dt>
          <dd>{fields.birthDate ?? NOT_IDENTIFIED}</dd>
        </div>
      </dl>
    </div>
  );
}
