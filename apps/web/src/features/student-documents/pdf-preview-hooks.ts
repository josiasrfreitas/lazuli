import { useEffect, useState, type RefObject } from "react";
import type {
  PDFDocumentLoadingTask,
  PDFDocumentProxy,
  PDFPageProxy,
  RenderTask,
} from "pdfjs-dist";

type Size = { width: number; height: number };
type PdfSetter = (value: PDFDocumentProxy | null) => void;
type StringSetter = (value: string) => void;
type BooleanSetter = (value: boolean) => void;

export function usePdfDocument({
  src,
  attempt,
  setPdf,
  setPage,
  setError,
  setRendering,
}: {
  src: string;
  attempt: number;
  setPdf: PdfSetter;
  setPage: (page: number) => void;
  setError: StringSetter;
  setRendering: BooleanSetter;
}): void {
  useEffect(() => {
    let disposed = false;
    let task: PDFDocumentLoadingTask | undefined;
    setPdf(null);
    setPage(1);
    setError("");
    setRendering(true);
    async function load(): Promise<void> {
      const engine = await import("pdfjs-dist");
      if (disposed) return;
      engine.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();
      task = engine.getDocument({ url: src });
      const document = await task.promise;
      if (!disposed) setPdf(document);
    }
    void load().catch((error_) => {
      if (disposed) return;
      setError(
        error_ instanceof Error && error_.name === "PasswordException"
          ? "PDF protegido por senha. Abra o original para visualizar."
          : "Não foi possível carregar a prévia do PDF.",
      );
      setRendering(false);
    });
    return () => {
      disposed = true;
      void task?.destroy().catch(() => {});
    };
  }, [src, attempt, setPdf, setPage, setError, setRendering]);
}

export function usePdfHostSize(host: RefObject<HTMLDivElement | null>): Size {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      const next = {
        width: Math.floor(element.clientWidth),
        height: Math.floor(element.clientHeight),
      };
      setSize((current) =>
        current.width === next.width && current.height === next.height ? current : next,
      );
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [host]);
  return size;
}

export function usePdfPage({
  pdf,
  page,
  size,
  canvas,
  setError,
  setRendering,
}: {
  pdf: PDFDocumentProxy | null;
  page: number;
  size: Size;
  canvas: RefObject<HTMLCanvasElement | null>;
  setError: StringSetter;
  setRendering: BooleanSetter;
}): void {
  useEffect(() => {
    if (!pdf || !size.width || !size.height) return;
    const currentPdf = pdf;
    let disposed = false;
    let task: RenderTask | undefined;
    setRendering(true);
    setError("");
    async function render(): Promise<void> {
      const documentPage = await currentPdf.getPage(page);
      const target = canvas.current;
      if (disposed || !target) return;
      const scale = viewportScale(documentPage, size);
      const viewport = documentPage.getViewport({ scale });
      const buffer = document.createElement("canvas");
      buffer.width = Math.ceil(viewport.width);
      buffer.height = Math.ceil(viewport.height);
      task = documentPage.render({ canvas: buffer, viewport });
      await task.promise;
      if (disposed) return;
      target.width = buffer.width;
      target.height = buffer.height;
      target.getContext("2d")?.drawImage(buffer, 0, 0);
      setRendering(false);
    }
    void render().catch(() => {
      if (disposed) return;
      setError("Não foi possível mostrar esta página. Abra o PDF original.");
      setRendering(false);
    });
    return () => {
      disposed = true;
      task?.cancel();
    };
  }, [pdf, page, size, canvas, setError, setRendering]);
}
function viewportScale(page: PDFPageProxy, size: Size): number {
  const natural = page.getViewport({ scale: 1 });
  return (
    Math.min(size.width / natural.width, size.height / natural.height) *
    Math.min(devicePixelRatio || 1, 2)
  );
}
