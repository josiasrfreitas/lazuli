import { toastManager } from "@lazuli/ui";
import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";
import { captureRequest, type CapturedDocument, type DocumentDefinition } from "./model";
import { loadImage, combinePages } from "./images";
const PDF_MIME = "application/pdf";
const MAX_DOCUMENT_BYTES = 5_242_880;
const PDF_HEADER_LENGTH = 5;

type CaptureSetters = {
  setPdf: Dispatch<SetStateAction<File | null>>;
  setSource: Dispatch<SetStateAction<HTMLCanvasElement | null>>;
  setPages: Dispatch<SetStateAction<HTMLCanvasElement[]>>;
  setBusy: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string>>;
};

async function choosePdf({
  file,
  document,
  setters,
}: {
  file: File;
  document: DocumentDefinition;
  setters: CaptureSetters;
}): Promise<void> {
  if (document.id === "photo") {
    setters.setError("Escolha uma foto JPG ou PNG para o aluno.");
    return;
  }
  if (file.size > MAX_DOCUMENT_BYTES) {
    setters.setError("O PDF deve ter no máximo 5 MB.");
    return;
  }
  if ((await file.slice(0, PDF_HEADER_LENGTH).text()) !== "%PDF-") {
    setters.setError("Este arquivo não é um PDF válido.");
    return;
  }
  setters.setPdf(new File([file], file.name, { type: PDF_MIME, lastModified: file.lastModified }));
  setters.setPages([]);
  setters.setSource(null);
}

function createChooseCapture(
  document: DocumentDefinition,
  setters: CaptureSetters,
): CaptureState["choose"] {
  return async (files) => {
    const file = files[0];
    if (!file) return;
    setters.setBusy(true);
    setters.setError("");
    try {
      if (file.type === PDF_MIME || file.name.toLowerCase().endsWith(".pdf")) {
        await choosePdf({ file, document, setters });
        return;
      }
      const image = await loadImage(file);
      setters.setPdf(null);
      if (document.id === "photo") setters.setPages([image]);
      else setters.setSource(image);
    } catch {
      setters.setError("Não foi possível abrir o arquivo. Escolha JPG, PNG ou PDF.");
    } finally {
      setters.setBusy(false);
    }
  };
}

function captureDescription(options: CaptureOptions, pdf: File | null): string {
  if (pdf) return "PDF salvo. Confira os dados cadastrais manualmente.";
  if (options.document.extracts) return "Você pode continuar enviando os outros documentos.";
  return "O arquivo foi salvo no cadastro.";
}

function createSendCapture({
  options,
  pdf,
  pages,
  setters,
  setReceipt,
  setSent,
}: {
  options: CaptureOptions;
  pdf: File | null;
  pages: HTMLCanvasElement[];
  setters: CaptureSetters;
  setReceipt: Dispatch<SetStateAction<CapturedDocument | null>>;
  setSent: Dispatch<SetStateAction<boolean>>;
}): CaptureState["send"] {
  return async () => {
    setters.setBusy(true);
    setters.setError("");
    try {
      const body = pdf ?? (await combinePages(pages));
      setReceipt(await sendCapture(options, body));
      setSent(true);
      toastManager.add({
        title: options.document.extracts && !pdf ? "Processamento iniciado" : "Arquivo enviado",
        description: captureDescription(options, pdf),
        priority: "low",
      });
      options.onSent();
    } catch {
      setters.setError(
        "Não foi possível enviar. Verifique a conexão e o limite de 5 MB. Se a sessão foi encerrada, abra um novo link no cadastro.",
      );
    } finally {
      setters.setBusy(false);
    }
  };
}
export type CaptureOptions = {
  document: DocumentDefinition;
  token: string;
  onSent: () => void;
  initialFile?: File | undefined;
  onBusyChange?: ((busy: boolean) => void) | undefined;
};
export type CaptureState = {
  pdf: File | null;
  source: HTMLCanvasElement | null;
  pages: HTMLCanvasElement[];
  busy: boolean;
  error: string;
  sent: boolean;
  receipt: CapturedDocument | null;
  host: RefObject<HTMLDivElement | null>;
  choose: (files: File[]) => Promise<void>;
  send: () => Promise<void>;
  reset: () => void;
};
export function useCapture(options: CaptureOptions): CaptureState {
  const [pdf, setPdf] = useState<File | null>(null);
  const [source, setSource] = useState<HTMLCanvasElement | null>(null);
  const [pages, setPages] = useState<HTMLCanvasElement[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [receipt, setReceipt] = useState<CapturedDocument | null>(null);
  const host = useRef<HTMLDivElement>(null);
  useCornerEditor({
    source,
    host,
    onCancel: () => setSource(null),
    onCrop: (page) => {
      setPages((current) => [...current, page]);
      setSource(null);
    },
    onError: setError,
  });
  const setters = { setPdf, setSource, setPages, setBusy, setError };
  const choose = createChooseCapture(options.document, setters);
  const send = createSendCapture({ options, pdf, pages, setters, setReceipt, setSent });
  const chooseRef = useRef(choose);
  chooseRef.current = choose;
  const initialSelection = useRef<File | undefined>(undefined);
  useEffect(() => {
    if (!options.initialFile || initialSelection.current === options.initialFile) return;
    initialSelection.current = options.initialFile;
    void chooseRef.current([options.initialFile]);
  }, [options.initialFile]);
  useEffect(() => options.onBusyChange?.(busy), [busy, options.onBusyChange]);
  return {
    pdf,
    source,
    pages,
    busy,
    error,
    sent,
    receipt,
    host,
    choose,
    send,
    reset: () => {
      setPages([]);
      setPdf(null);
    },
  };
}
type EditorOptions = {
  source: HTMLCanvasElement | null;
  host: RefObject<HTMLDivElement | null>;
  onCancel: () => void;
  onCrop: (page: HTMLCanvasElement) => void;
  onError: (error: string) => void;
};
function useCornerEditor(options: EditorOptions): void {
  const latest = useRef(options);
  latest.current = options;
  useEffect(() => {
    const source = options.source,
      container = options.host.current;
    if (!source || !container) return;
    let disposed = false;
    let editor: { destroy: () => void } | undefined;
    async function mount(): Promise<void> {
      const scanic = await import("scanic");
      let corners;
      try {
        const detection = await scanic.scanDocument(source!, { mode: "detect" });
        if (detection.success) corners = detection.corners;
      } catch {
        /* Manual crop remains available. */
      }
      if (disposed) return;
      editor = scanic.createCornerEditor({
        container: container!,
        image: source!,
        ...(corners ? { corners } : {}),
        toolbar: { labels: { reset: "Reiniciar", cancel: "Cancelar", apply: "Recortar" } },
        onCancel: () => latest.current.onCancel(),
        onConfirm: (selected) => {
          void scanic
            .extractDocument(source!, selected, { output: "canvas" })
            .then((crop) => {
              if (disposed) return;
              if (!crop.success || !(crop.output instanceof HTMLCanvasElement))
                throw new Error("CROP");
              latest.current.onCrop(crop.output);
            })
            .catch(() =>
              latest.current.onError(
                "Não foi possível recortar. Ajuste os cantos e tente novamente.",
              ),
            );
        },
      });
    }
    void mount().catch(() =>
      latest.current.onError("Não foi possível abrir o recorte. Tente novamente."),
    );
    return () => {
      disposed = true;
      editor?.destroy();
    };
  }, [options.source, options.host]);
}

async function sendCapture(options: CaptureOptions, body: Blob): Promise<CapturedDocument> {
  return captureRequest<CapturedDocument>(options.token, {
    path: `/${options.document.id}`,
    options: {
      method: "POST",
      headers: {
        "Content-Type": body.type === PDF_MIME ? PDF_MIME : "image/jpeg",
        "X-Document-Metadata": encodeURIComponent(
          JSON.stringify({ title: options.document.title, subtitle: options.document.detail }),
        ),
      },
      body,
    },
  });
}
