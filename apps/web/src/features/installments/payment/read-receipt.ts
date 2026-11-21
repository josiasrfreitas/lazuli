import type { PDFPageProxy } from "pdfjs-dist";
import { parseReceipt, type ReceiptFields } from "./receipt-fields";

async function recognize(image: File | HTMLCanvasElement, signal: AbortSignal): Promise<string> {
  const { createWorker, OEM } = await import("tesseract.js");
  signal.throwIfAborted();
  const worker = await createWorker("por", OEM.LSTM_ONLY, {
    workerPath: "/receipt-ocr/worker.min.js",
    corePath: "/receipt-ocr/tesseract-core-lstm.wasm.js",
    langPath: "/receipt-ocr",
    workerBlobURL: false,
    errorHandler: () => {},
  });
  const stop = (): void => {
    void worker.terminate();
  };
  try {
    signal.throwIfAborted();
    signal.addEventListener("abort", stop, { once: true });
    const result = await worker.recognize(image);
    return result.data.text;
  } finally {
    signal.removeEventListener("abort", stop);
    if (signal.aborted) stop();
    else await worker.terminate();
  }
}

export async function readReceipt(file: File, signal: AbortSignal): Promise<ReceiptFields> {
  if (file.type !== "application/pdf") return parseReceipt(await recognize(file, signal));
  const engine = await import("pdfjs-dist");
  engine.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
  const task = engine.getDocument({ data: await file.arrayBuffer() });
  try {
    const pdf = await task.promise;
    if (pdf.numPages > MAX_OCR_PAGES) return {};
    const pages: string[] = [];
    for (let number = 1; number <= pdf.numPages; number++) {
      signal.throwIfAborted();
      const page = await pdf.getPage(number);
      pages.push(await readPageText(page, signal));
    }
    return parseReceipt(pages.join("\n"));
  } finally {
    await task.destroy();
  }
}

const MAX_OCR_PAGES = 3;
const MIN_EMBEDDED_TEXT_LENGTH = 20;
const MAX_RENDER_SCALE = 3;
const MAX_RENDER_EDGE = 2200;
async function readPageText(page: PDFPageProxy, signal: AbortSignal): Promise<string> {
  const content = await page.getTextContent();
  const text = content.items
    .map((item) => ("str" in item ? item.str + (item.hasEOL ? "\n" : " ") : ""))
    .join("");
  if (text.trim().length >= MIN_EMBEDDED_TEXT_LENGTH) return text;
  const natural = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({
    scale: Math.min(MAX_RENDER_SCALE, MAX_RENDER_EDGE / Math.max(natural.width, natural.height)),
  });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  await page.render({ canvas, viewport }).promise;
  return text + "\n" + (await recognize(canvas, signal));
}
