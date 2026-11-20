"use client";
import { useEffect, useState, type ReactElement, type Dispatch, type SetStateAction } from "react";
import { ArrowLeft, Check, FileText } from "lucide-react";
import { Button, ToastAlert } from "@lazuli/ui";
import { CapturePageFrame } from "~/features/mobile-upload/capture-page-frame";
import { MobileFileEditor, type UploadCategory, type MobileFileInput } from "./file-editor";
export type MobileUploadReceipt = { id: string; label: string; fileName: string };
type CaptureSession = { endpoint: string; token: string };
const SESSION_GONE = 410;
const REFRESH_INTERVAL = 3000;
export async function captureFetch(
  { endpoint, token }: CaptureSession,
  options?: RequestInit,
): Promise<Response> {
  const response = await fetch(endpoint, {
    ...options,
    headers: { ...options?.headers, Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    if (response.status === SESSION_GONE)
      throw new Error("Sessão encerrada. Abra um novo QR code no cadastro.");
    const error = (await response.json()) as { message?: string };
    throw new Error(error.message ?? "Não foi possível enviar. Tente novamente.");
  }
  return response;
}
export async function sendCapture(session: CaptureSession, input: MobileFileInput): Promise<void> {
  await captureFetch(session, {
    method: "POST",
    headers: {
      "Content-Type": input.file.type,
      "X-Upload-Metadata": encodeURIComponent(
        JSON.stringify({
          kind: input.kind,
          label: input.label,
          subtitle: input.subtitle,
          fileName: input.file.name,
          contentType: input.file.type,
          byteLength: input.file.size,
        }),
      ),
    },
    body: input.file,
  });
}
export function MobileUploadPage({
  endpoint,
  categories,
}: {
  endpoint: string;
  categories: UploadCategory[];
}): ReactElement {
  const model = useMobileUpload(endpoint);
  const { selected, error } = model;
  return (
    <CapturePageFrame>
      <header className="grid gap-2">
        <h1>{selected?.label ?? "Enviar documentos"}</h1>
        <p>
          {model.token
            ? "Os arquivos aparecem no cadastro aberto no computador."
            : "Abra esta página pelo QR code do cadastro."}
        </p>
      </header>
      {error && <ToastAlert variant="warning">{error}</ToastAlert>}
      {model.token && <MobileUploadContent model={model} categories={categories} />}
    </CapturePageFrame>
  );
}

function useMobileUpload(endpoint: string): MobileUploadModel {
  const [token, setToken] = useState("");
  const [files, setFiles] = useState<MobileUploadReceipt[] | null>(null);
  const [selected, setSelected] = useState<UploadCategory | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [received, setReceived] = useState(false);
  useEffect(() => {
    setToken(location.hash.slice(1));
  }, []);
  useEffect(() => {
    if (!token) return;
    let active = true;
    async function refresh(): Promise<void> {
      try {
        const response = await captureFetch({ endpoint, token });
        const data = (await response.json()) as { files: MobileUploadReceipt[] };
        if (active) {
          setFiles(data.files);
          setError("");
        }
      } catch (error_) {
        if (active)
          setError(error_ instanceof Error ? error_.message : "Sem conexão. Tente novamente.");
      }
    }
    void refresh();
    const timer = setInterval(() => void refresh(), REFRESH_INTERVAL);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [endpoint, token]);
  return {
    endpoint,
    token,
    files,
    selected,
    error,
    busy,
    received,
    setFiles,
    setSelected,
    setBusy,
    setReceived,
  };
}

function MobileUploadContent({
  model,
  categories,
}: {
  model: ReturnType<typeof useMobileUpload>;
  categories: UploadCategory[];
}): ReactElement {
  const {
    endpoint,
    token,
    files,
    selected,
    error,
    busy,
    received,
    setFiles,
    setSelected,
    setBusy,
    setReceived,
  } = model;
  if (!files)
    return (
      <p role="status">{error ? "Confira o link ou gere um novo QR code." : "Abrindo sessão…"}</p>
    );
  if (selected)
    return (
      <>
        <Button variant="ghost" disabled={busy} onClick={() => setSelected(null)}>
          <ArrowLeft /> Todos os documentos
        </Button>
        <MobileFileEditor
          key={selected.id}
          category={selected}
          onBusyChange={setBusy}
          onBack={() => setSelected(null)}
          onSend={async (input) => {
            await sendCapture({ endpoint, token }, input);
            setReceived(true);
            setSelected(null);
            const response = await captureFetch({ endpoint, token });
            const data = (await response.json()) as { files: MobileUploadReceipt[] };
            setFiles(data.files);
          }}
        />
      </>
    );
  return (
    <MobileUploadList
      files={files}
      received={received}
      categories={categories}
      onSelect={(category) => {
        setSelected(category);
        setReceived(false);
      }}
    />
  );
}

function MobileUploadList({
  files,
  received,
  categories,
  onSelect,
}: {
  files: MobileUploadReceipt[];
  received: boolean;
  categories: UploadCategory[];
  onSelect: (category: UploadCategory) => void;
}): ReactElement {
  return (
    <>
      {received && (
        <p role="status" className="flex items-center gap-2 text-body">
          <Check /> Arquivo recebido no cadastro.
        </p>
      )}
      <div className="grid gap-2">
        {categories.map((category) => (
          <Button key={category.id} variant="secondary" onClick={() => onSelect(category)}>
            <FileText />
            {category.label}
          </Button>
        ))}
      </div>
      {files.length > 0 && (
        <section className="grid gap-2">
          <h2 className="text-h3">Enviados por este celular</h2>
          <ul className="divide-y">
            {files.map((file) => (
              <li key={file.id} className="break-words py-3 text-body">
                <span>{file.label}</span>
                <span className="block text-caption text-muted-foreground">{file.fileName}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

type MobileUploadModel = {
  endpoint: string;
  token: string;
  files: MobileUploadReceipt[] | null;
  selected: UploadCategory | null;
  error: string;
  busy: boolean;
  received: boolean;
  setFiles: Dispatch<SetStateAction<MobileUploadReceipt[] | null>>;
  setSelected: Dispatch<SetStateAction<UploadCategory | null>>;
  setBusy: Dispatch<SetStateAction<boolean>>;
  setReceived: Dispatch<SetStateAction<boolean>>;
};
