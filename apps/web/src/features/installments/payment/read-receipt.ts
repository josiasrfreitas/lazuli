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
  const stop = () => {
    void worker.terminate();
  };
  try {
    signal.throwIfAborted();
    signal.addEventListener("abort", stop, { once: true });
    return (await worker.recognize(image)).data.text;
  } finally {
    signal.removeEventListener("abort", stop);
    if (!signal.aborted) await worker.terminate();
    else stop();
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
    if (pdf.numPages > 3) return {};
    const pages: string[] = [];
    for (let number = 1; number <= pdf.numPages; number++) {
      signal.throwIfAborted();
      const page = await pdf.getPage(number);
      const content = await page.getTextContent();
      let text = content.items
        .map((item) => ("str" in item ? item.str + (item.hasEOL ? "\n" : " ") : ""))
        .join("");
      if (text.trim().length < 20) {
        const natural = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({
          scale: Math.min(3, 2200 / Math.max(natural.width, natural.height)),
        });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        await page.render({ canvas, viewport }).promise;
        text += "\n" + (await recognize(canvas, signal));
      }
      pages.push(text);
    }
    return parseReceipt(pages.join("\n"));
  } finally {
    await task.destroy();
  }
}
