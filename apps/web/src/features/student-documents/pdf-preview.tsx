"use client";

import { useEffect, useRef, useState, type ReactElement, type RefObject } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { ArrowLeft, ArrowRight, ExternalLink, FileText, LoaderCircle } from "lucide-react";
import { Button } from "@lazuli/ui";
import { usePdfDocument, usePdfHostSize, usePdfPage } from "./pdf-preview-hooks";
import styles from "./documents.module.css";

export function useFileUrl(file: File | null): string | undefined {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!file) {
      setUrl(undefined);
      return;
    }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return url;
}

export function PdfPreview({
  src,
  title,
  showOpenLink = true,
}: {
  src: string;
  title: string;
  showOpenLink?: boolean;
}): ReactElement {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState("");
  const [rendering, setRendering] = useState(true);
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const size = usePdfHostSize(host);
  usePdfDocument({ src, attempt, setPdf, setPage, setError, setRendering });
  usePdfPage({ pdf, page, size, canvas, setError, setRendering });
  return (
    <div className={styles.pdfPreview}>
      <PdfPage
        host={host}
        canvas={canvas}
        title={title}
        page={page}
        pages={pdf?.numPages}
        rendering={rendering}
        error={error}
        onRetry={() => setAttempt((value) => value + 1)}
      />
      <PdfControls
        pdf={pdf}
        page={page}
        rendering={rendering}
        showOpenLink={showOpenLink}
        src={src}
        setPage={setPage}
      />
    </div>
  );
}

function PdfPage({
  host,
  canvas,
  title,
  page,
  pages,
  rendering,
  error,
  onRetry,
}: {
  host: RefObject<HTMLDivElement | null>;
  canvas: RefObject<HTMLCanvasElement | null>;
  title: string;
  page: number;
  pages: number | undefined;
  rendering: boolean;
  error: string;
  onRetry: () => void;
}): ReactElement {
  return (
    <div ref={host} className={styles.pdfPage}>
      <canvas
        ref={canvas}
        data-visible={!rendering && !error}
        role="img"
        aria-label={`${title} — página ${page} de ${pages ?? "…"}`}
      />
      {(rendering || error) && (
        <div className={styles.pdfFallback} role={error ? "alert" : "status"}>
          {error ? (
            <>
              <FileText aria-hidden="true" />
              <p>{error}</p>
              <Button variant="secondary" size="sm" onClick={onRetry}>
                Tentar novamente
              </Button>
            </>
          ) : (
            <>
              <LoaderCircle className={styles.processingSpinner} aria-hidden="true" />
              <p>Carregando PDF…</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

type PdfControlsProps = {
  pdf: PDFDocumentProxy | null;
  page: number;
  rendering: boolean;
  showOpenLink: boolean;
  src: string;
  setPage: (update: (page: number) => number) => void;
};
function PdfControls({
  pdf,
  page,
  rendering,
  showOpenLink,
  src,
  setPage,
}: PdfControlsProps): ReactElement {
  return (
    <div className={styles.pdfControls}>
      {pdf && (
        <div className={styles.actions}>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Página anterior do PDF"
            disabled={page <= 1 || rendering}
            onClick={() => setPage((value) => value - 1)}
          >
            <ArrowLeft aria-hidden="true" />
          </Button>
          <span role="status">
            Página {page} de {pdf.numPages}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Próxima página do PDF"
            disabled={page >= pdf.numPages || rendering}
            onClick={() => setPage((value) => value + 1)}
          >
            <ArrowRight aria-hidden="true" />
          </Button>
        </div>
      )}
      {showOpenLink && (
        <a href={src} target="_blank" rel="noreferrer">
          <ExternalLink aria-hidden="true" />
          Abrir PDF
        </a>
      )}
    </div>
  );
}
