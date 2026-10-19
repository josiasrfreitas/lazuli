"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Button } from "@lazuli/ui";
import { UploadCloud } from "lucide-react";
import { trpc } from "~/lib/trpc";
import {
  readPendingFiles,
  storePendingFile,
  removePendingFile,
  transferFile,
  type PendingFile,
} from "./local-queue";

type QueueStatus =
  | "QUEUED"
  | "UPLOADING"
  | "INTERRUPTED"
  | "RECEIVED"
  | "PROCESSING"
  | "READY"
  | "FAILED"
  | "REJECTED";
type QueueItem = {
  id: string;
  name: string;
  status: QueueStatus;
  progress: number;
  pending?: PendingFile;
  message?: string;
  received?: boolean;
};
const labels: Record<QueueStatus, string> = {
  QUEUED: "Na fila",
  UPLOADING: "Enviando",
  INTERRUPTED: "Envio interrompido",
  RECEIVED: "Recebido · aguardando processamento",
  PROCESSING: "Recebido · processando",
  READY: "Pronto para consulta",
  FAILED: "Não foi possível concluir",
  REJECTED: "Arquivo inválido · selecione outro",
};
const UploadContext = createContext<{
  add: (files: File[], target: Omit<PendingFile, "id" | "file" | "createdAt">) => Promise<void>;
} | null>(null);
export function useAssessmentUploads() {
  const value = useContext(UploadContext);
  if (!value) throw new Error("Uploads require the authenticated app shell.");
  return value;
}

export function AssessmentUploadProvider({
  userId,
  children,
}: {
  userId: string;
  children: ReactNode;
}) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [storageError, setStorageError] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const running = useRef<XMLHttpRequest | null>(null);
  const utils = trpc.useUtils();
  const recent = trpc.assessmentFiles.recent.useQuery(undefined, {
    refetchInterval: items.some(
      (item) => !["READY", "REJECTED", "INTERRUPTED", "FAILED"].includes(item.status),
    )
      ? 3_000
      : 15_000,
  });
  const retry = trpc.assessmentFiles.retry.useMutation({
    onSuccess: () => utils.assessmentFiles.invalidate(),
  });
  const refresh = useCallback(() => {
    void Promise.all([utils.assessmentFiles.invalidate(), utils.assessments.invalidate()]);
  }, [utils]);
  useEffect(() => {
    let active = true;
    void readPendingFiles(userId)
      .then((files) => {
        if (active)
          setItems(
            files.map((pending) => ({
              id: pending.id,
              name: pending.file.name,
              status: "INTERRUPTED",
              progress: 0,
              pending,
            })),
          );
      })
      .catch((error: unknown) => {
        if (active)
          setStorageError(
            error instanceof Error ? error.message : "Não foi possível recuperar a fila de envios.",
          );
      })
      .finally(() => {
        if (active) setHydrated(true);
      });
    return () => {
      active = false;
      running.current?.abort();
    };
  }, [userId]);
  useEffect(() => {
    if (!recent.data || !hydrated) return;
    const received = recent.data.filter((row) => row.receivedAt);
    for (const row of received) void removePendingFile(userId, row.id).catch(() => undefined);
    setItems((current) => {
      const next = current.map((item) => {
        const row = received.find((file) => file.id === item.id);
        return row
          ? {
              id: item.id,
              name: item.name,
              status: row.status as QueueStatus,
              progress: 100,
              received: true,
            }
          : item;
      });
      for (const row of received)
        if (row.status !== "READY" && !next.some((item) => item.id === row.id))
          next.push({
            id: row.id,
            name: row.fileName,
            status: row.status as QueueStatus,
            progress: 100,
            received: true,
          });
      return next;
    });
  }, [recent.data, hydrated, userId]);
  useEffect(() => {
    const next = items.find((item) => item.status === "QUEUED" && item.pending);
    if (!next?.pending || running.current) return;
    const change = (patch: Partial<QueueItem>) =>
      setItems((current) =>
        current.map((item) => (item.id === next.id ? { ...item, ...patch } : item)),
      );
    change({ status: "UPLOADING", progress: 0, message: undefined });
    const transfer = transferFile(next.pending, (progress) => change({ progress }));
    running.current = transfer.request;
    void transfer.completed
      .then(async () => {
        await removePendingFile(userId, next.id).catch(() => undefined);
        change({ status: "RECEIVED", progress: 100, pending: undefined, received: true });
      })
      .catch((error: unknown) =>
        change({
          status: "INTERRUPTED",
          message: error instanceof Error ? error.message : "Envio interrompido.",
        }),
      )
      .finally(() => {
        running.current = null;
        refresh();
        setItems((current) => [...current]);
      });
  }, [items, userId, refresh]);
  useEffect(() => {
    const leaving = (event: BeforeUnloadEvent) => {
      if (running.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", leaving);
    return () => window.removeEventListener("beforeunload", leaving);
  }, []);
  async function add(files: File[], target: Omit<PendingFile, "id" | "file" | "createdAt">) {
    if (!hydrated) throw new Error("Aguarde a recuperação dos envios anteriores.");
    for (const file of files) {
      if (
        !file.size ||
        file.size > 20 * 1024 * 1024 ||
        !["application/pdf", "image/jpeg", "image/png"].includes(file.type)
      )
        throw new Error("Escolha fotos JPG/PNG ou PDFs de até 20 MB cada.");
    }
    for (const file of files) {
      const pending: PendingFile = {
        ...target,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        file,
      };
      await storePendingFile(userId, pending);
      setItems((current) => [
        ...current,
        { id: pending.id, name: file.name, status: "QUEUED", progress: 0, pending },
      ]);
    }
  }
  const activeCount = items.filter((item) => item.status !== "READY").length;
  return (
    <UploadContext.Provider value={{ add }}>
      {children}
      {(items.length > 0 || storageError) && (
        <details
          className="shrink-0 border-t border-border bg-card px-4 py-2"
          aria-label="Fila de provas"
        >
          <summary className="flex cursor-pointer items-center gap-2 text-sm">
            <UploadCloud className="size-4" />
            {activeCount ? `${activeCount} envios para acompanhar` : "Provas recebidas"}
          </summary>
          <div className="grid max-h-64 gap-3 overflow-y-auto py-3">
            <p className="text-caption text-muted-foreground">
              Você pode continuar navegando. Se fechar ou bloquear o celular, retome os envios
              interrompidos ao voltar.
            </p>
            {storageError && (
              <p role="alert" className="text-sm text-destructive">
                {storageError}
              </p>
            )}
            {recent.error && (
              <p role="alert" className="text-caption">
                Não foi possível atualizar o processamento.{" "}
                <Button size="sm" variant="ghost" onClick={() => void recent.refetch()}>
                  Atualizar
                </Button>
              </p>
            )}
            {items.map((item) => (
              <div key={item.id} className="grid gap-1 border-t border-border pt-2">
                <p className="break-all text-sm font-medium">{item.name}</p>
                <p className="text-caption text-muted-foreground" role="status">
                  {item.status === "UPLOADING"
                    ? item.progress === 100
                      ? "Concluindo recebimento…"
                      : `Enviando · ${item.progress}%`
                    : labels[item.status]}
                </p>
                {item.status === "UPLOADING" && (
                  <progress
                    className="w-full"
                    max={100}
                    value={item.progress}
                    aria-label={`Envio de ${item.name}`}
                  />
                )}
                {item.message && <p className="text-caption text-destructive">{item.message}</p>}
                {item.status === "INTERRUPTED" && item.pending && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        setItems((current) =>
                          current.map((row) =>
                            row.id === item.id ? { ...row, status: "QUEUED" } : row,
                          ),
                        )
                      }
                    >
                      Retomar envio
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        void removePendingFile(userId, item.id).then(() =>
                          setItems((current) => current.filter((row) => row.id !== item.id)),
                        );
                      }}
                    >
                      Descartar cópia local
                    </Button>
                  </div>
                )}
                {item.status === "FAILED" && item.received && (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={retry.isPending}
                    onClick={() => retry.mutate({ id: item.id })}
                  >
                    Tentar processar novamente
                  </Button>
                )}
                {item.status === "READY" && (
                  <a
                    className="text-caption text-interactive underline"
                    href={`/api/assessment-files/${item.id}`}
                  >
                    Baixar prova
                  </a>
                )}
              </div>
            ))}
            {retry.error && (
              <p role="alert" className="text-sm text-destructive">
                {retry.error.message}
              </p>
            )}
            {items.length > 0 && !activeCount && (
              <Button variant="ghost" size="sm" onClick={() => setItems([])}>
                Limpar concluídos da fila
              </Button>
            )}
          </div>
        </details>
      )}
    </UploadContext.Provider>
  );
}
