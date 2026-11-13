"use client";
import { useEffect, useState, type ReactElement } from "react";
import { ArrowLeft, Check, FileText } from "lucide-react";
import { Button, ToastAlert } from "@lazuli/ui";
import { BrandSignature } from "~/components/app-shell/brand-signature";
import { MobileFileEditor, type UploadCategory, type MobileFileInput } from "./file-editor";
import styles from "./mobile-upload.module.css";
export type MobileUploadReceipt = { id: string; label: string; fileName: string };
export async function captureFetch(
  endpoint: string,
  token: string,
  options?: RequestInit,
): Promise<Response> {
  const response = await fetch(endpoint, {
    ...options,
    headers: { ...options?.headers, Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    if (response.status === 410)
      throw new Error("Sessão encerrada. Abra um novo QR code no cadastro.");
    const error = (await response.json()) as { message?: string };
    throw new Error(error.message ?? "Não foi possível enviar. Tente novamente.");
  }
  return response;
}
export async function sendCapture(
  endpoint: string,
  token: string,
  input: MobileFileInput,
): Promise<void> {
  await captureFetch(endpoint, token, {
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
        const response = await captureFetch(endpoint, token);
        const data = (await response.json()) as { files: MobileUploadReceipt[] };
        if (active) {
          setFiles(data.files);
          setError("");
        }
      } catch (failure) {
        if (active)
          setError(failure instanceof Error ? failure.message : "Sem conexão. Tente novamente.");
      }
    }
    void refresh();
    const timer = setInterval(() => void refresh(), 3000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [endpoint, token]);
  return (
    <main className={styles.mobile}>
      <BrandSignature expanded />
      <header className="grid gap-2">
        <h1>{selected?.label ?? "Enviar documentos"}</h1>
        <p>Os arquivos aparecem no cadastro aberto no computador.</p>
      </header>
      {error && <ToastAlert variant="warning">{error}</ToastAlert>}
      {!token ? (
        <p>Abra esta página pelo QR code do cadastro.</p>
      ) : !files ? (
        <p role="status">{error ? "Confira o link ou gere um novo QR code." : "Abrindo sessão…"}</p>
      ) : selected ? (
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
              await sendCapture(endpoint, token, input);
              setReceived(true);
              setSelected(null);
              const response = await captureFetch(endpoint, token);
              const data = (await response.json()) as { files: MobileUploadReceipt[] };
              setFiles(data.files);
            }}
          />
        </>
      ) : (
        <>
          {received && (
            <p role="status" className="flex items-center gap-2 text-body">
              <Check /> Arquivo recebido no cadastro.
            </p>
          )}
          <div className="grid gap-2">
            {categories.map((category) => (
              <Button
                key={category.id}
                variant="secondary"
                onClick={() => {
                  setSelected(category);
                  setReceived(false);
                }}
              >
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
                    <span className="block text-caption text-muted-foreground">
                      {file.fileName}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </main>
  );
}
