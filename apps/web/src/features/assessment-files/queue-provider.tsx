"use client";
import type { Dispatch, JSX as ReactJSX, ReactNode, RefObject, SetStateAction } from "react";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Button } from "@lazuli/ui";
import { MAX_UPLOAD_FILE_BYTES, MAX_UPLOAD_FILE_MB } from "@lazuli/validators";
import type { RouterOutputs } from "@lazuli/api";
import { ListChecks, RefreshCw, Trash2, UploadCloud } from "lucide-react";
import { trpc } from "~/lib/trpc";
import {
  readPendingFiles,
  storePendingFile,
  removePendingFile,
  transferFile,
  type PendingFile,
} from "./local-queue";

const ACTIVE_QUEUE_REFRESH_INTERVAL_MS = 3000;
const IDLE_QUEUE_REFRESH_INTERVAL_MS = 15_000;
const COMPLETE_UPLOAD_PERCENT = 100;
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
  pending?: PendingFile | undefined;
  message?: string | undefined;
  received?: boolean;
};
type QueueTarget = Omit<PendingFile, "id" | "file" | "createdAt">;
type QueueSetter = Dispatch<SetStateAction<QueueItem[]>>;
type RecentFiles = RouterOutputs["assessmentFiles"]["recent"];
type RunningRequest = RefObject<XMLHttpRequest | null>;
type QueueController = {
  items: QueueItem[];
  storageError: string;
  recentError: string | undefined;
  retryError: string | undefined;
  retryPending: boolean;
  add: (files: File[], target: QueueTarget) => Promise<void>;
  refreshRecent: () => void;
  retryItem: (id: string) => void;
  resume: (id: string) => void;
  discard: (id: string) => void;
  clearFinished: () => void;
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
const UploadContext = createContext<{ add: QueueController["add"] } | null>(null);
export function useAssessmentUploads(): { add: QueueController["add"] } {
  const value = useContext(UploadContext);
  if (!value) throw new Error("Uploads require the authenticated app shell.");
  return value;
}

function pendingQueueItem(pending: PendingFile): QueueItem {
  return { id: pending.id, name: pending.file.name, status: "INTERRUPTED", progress: 0, pending };
}

function usePendingHydration({
  userId,
  setItems,
  setStorageError,
  setHydrated,
  running,
}: {
  userId: string;
  setItems: QueueSetter;
  setStorageError: (message: string) => void;
  setHydrated: (value: boolean) => void;
  running: RunningRequest;
}): void {
  useEffect(() => {
    let active = true;
    void readPendingFiles(userId)
      .then((files) => {
        if (active) setItems(files.map((pending) => pendingQueueItem(pending)));
      })
      .catch((error) => {
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
  }, [userId, setItems, setStorageError, setHydrated, running]);
}

function mergeRecentItems(
  current: QueueItem[],
  { received, dismissed }: { received: RecentFiles; dismissed: Set<string> },
): QueueItem[] {
  const next = current.map((item) => {
    const row = received.find((file) => file.id === item.id);
    return row
      ? {
          id: item.id,
          name: item.name,
          status: row.status as QueueStatus,
          progress: COMPLETE_UPLOAD_PERCENT,
          received: true,
        }
      : item;
  });
  for (const row of received) {
    if (
      row.status !== "READY" &&
      !dismissed.has(row.id) &&
      !next.some((item) => item.id === row.id)
    )
      next.push({
        id: row.id,
        name: row.fileName,
        status: row.status as QueueStatus,
        progress: COMPLETE_UPLOAD_PERCENT,
        received: true,
      });
  }
  return next;
}

function useRecentSync({
  userId,
  recent,
  hydrated,
  setItems,
  dismissed,
}: {
  userId: string;
  recent: RecentFiles | undefined;
  hydrated: boolean;
  setItems: QueueSetter;
  dismissed: RefObject<Set<string>>;
}): void {
  useEffect(() => {
    if (!recent || !hydrated) return;
    const received = recent.filter((row) => row.receivedAt);
    for (const row of received) void removePendingFile(userId, row.id).catch(() => {});
    setItems((current) => mergeRecentItems(current, { received, dismissed: dismissed.current }));
  }, [recent, hydrated, userId, setItems, dismissed]);
}

function patchQueueItem(
  setItems: QueueSetter,
  { id, patch }: { id: string; patch: Partial<QueueItem> },
): void {
  setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
}

function useUploadRunner({
  items,
  setItems,
  userId,
  running,
  refresh,
}: {
  items: QueueItem[];
  setItems: QueueSetter;
  userId: string;
  running: RunningRequest;
  refresh: () => void;
}): void {
  useEffect(() => {
    const next = items.find((item) => item.status === "QUEUED" && item.pending);
    if (!next?.pending || running.current) return;
    const change = (patch: Partial<QueueItem>): void =>
      patchQueueItem(setItems, { id: next.id, patch });
    change({ status: "UPLOADING", progress: 0, message: undefined });
    const transfer = transferFile(next.pending, (progress) => change({ progress }));
    running.current = transfer.request;
    void transfer.completed
      .then(async () => {
        await removePendingFile(userId, next.id).catch(() => {});
        change({
          status: "RECEIVED",
          progress: COMPLETE_UPLOAD_PERCENT,
          pending: undefined,
          received: true,
        });
      })
      .catch((error) =>
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
  }, [items, setItems, userId, running, refresh]);
}

function useUnloadProtection(running: RunningRequest): void {
  useEffect(() => {
    const leaving = (event: BeforeUnloadEvent): void => {
      if (running.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", leaving);
    return () => window.removeEventListener("beforeunload", leaving);
  }, [running]);
}

function useAddQueueFiles(
  userId: string,
  { hydrated, setItems }: { hydrated: boolean; setItems: QueueSetter },
): QueueController["add"] {
  return async (files, target) => {
    if (!hydrated) throw new Error("Aguarde a recuperação dos envios anteriores.");
    for (const file of files) {
      if (
        file.size === 0 ||
        file.size > MAX_UPLOAD_FILE_BYTES ||
        !["application/pdf", "image/jpeg", "image/png"].includes(file.type)
      )
        throw new Error("Escolha fotos JPG/PNG ou PDFs de até " + MAX_UPLOAD_FILE_MB + " MB cada.");
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
  };
}

function queueIsActive(items: QueueItem[]): boolean {
  return items.some(
    (item) => !["READY", "REJECTED", "INTERRUPTED", "FAILED"].includes(item.status),
  );
}

function useQueueController(userId: string): QueueController {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [storageError, setStorageError] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const running = useRef<XMLHttpRequest | null>(null);
  const dismissed = useRef(new Set<string>());
  const utils = trpc.useUtils();
  const active = queueIsActive(items);
  const recent = trpc.assessmentFiles.recent.useQuery(undefined, {
    refetchInterval: active ? ACTIVE_QUEUE_REFRESH_INTERVAL_MS : IDLE_QUEUE_REFRESH_INTERVAL_MS,
  });
  const retry = trpc.assessmentFiles.retry.useMutation({
    onSuccess: () => utils.assessmentFiles.invalidate(),
  });
  const refresh = useCallback(() => {
    void Promise.all([utils.assessmentFiles.invalidate(), utils.assessments.invalidate()]);
  }, [utils]);
  usePendingHydration({ userId, setItems, setStorageError, setHydrated, running });
  useRecentSync({ userId, recent: recent.data, hydrated, setItems, dismissed });
  useUploadRunner({ items, setItems, userId, running, refresh });
  useUnloadProtection(running);
  const add = useAddQueueFiles(userId, { hydrated, setItems });
  function resume(id: string): void {
    patchQueueItem(setItems, { id, patch: { status: "QUEUED" } });
  }
  function discard(id: string): void {
    void removePendingFile(userId, id).then(() =>
      setItems((current) => current.filter((item) => item.id !== id)),
    );
  }
  function clearFinished(): void {
    clearFinishedItems({ items, setItems, dismissed: dismissed.current });
  }
  return {
    items,
    storageError,
    add,
    resume,
    discard,
    clearFinished,
    recentError: recent.error?.message,
    retryError: retry.error?.message,
    retryPending: retry.isPending,
    refreshRecent: () => {
      void recent.refetch();
    },
    retryItem: (id) => retry.mutate({ id }),
  };
}

function clearFinishedItems({
  items,
  setItems,
  dismissed,
}: {
  items: QueueItem[];
  setItems: QueueSetter;
  dismissed: Set<string>;
}): void {
  const finished = items.filter((item) => item.status === "READY" || item.status === "REJECTED");
  for (const item of finished) dismissed.add(item.id);
  setItems((current) => current.filter((item) => !dismissed.has(item.id)));
}

function QueueStatusLine({ item }: { item: QueueItem }): ReactJSX.Element {
  let label = labels[item.status];
  if (item.status === "UPLOADING")
    label =
      item.progress === COMPLETE_UPLOAD_PERCENT
        ? "Concluindo recebimento…"
        : "Enviando · " + item.progress + "%";
  return (
    <p className="text-sm text-muted-foreground" role="status">
      {label}
    </p>
  );
}

function QueueItemActions({
  item,
  retryPending,
  resume,
  discard,
  retryItem,
}: Pick<QueueController, "retryPending" | "resume" | "discard" | "retryItem"> & {
  item: QueueItem;
}): ReactJSX.Element | null {
  if (item.status === "INTERRUPTED" && item.pending)
    return (
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={() => resume(item.id)}>
          <UploadCloud aria-hidden="true" />
          Retomar envio
        </Button>
        <Button size="sm" variant="ghost" onClick={() => discard(item.id)}>
          <Trash2 aria-hidden="true" />
          Descartar cópia local
        </Button>
      </div>
    );
  if (item.status === "FAILED" && item.received)
    return (
      <Button
        size="sm"
        variant="secondary"
        disabled={retryPending}
        onClick={() => retryItem(item.id)}
      >
        <RefreshCw aria-hidden="true" />
        Tentar processar novamente
      </Button>
    );
  return null;
}

function QueueItemRow({
  item,
  ...actions
}: Pick<QueueController, "retryPending" | "resume" | "discard" | "retryItem"> & {
  item: QueueItem;
}): ReactJSX.Element {
  return (
    <div className="grid gap-1 border-t border-border pt-2">
      <p className="break-all text-sm font-medium">{item.name}</p>
      <QueueStatusLine item={item} />
      {item.status === "UPLOADING" && (
        <progress
          className="w-full"
          max={100}
          value={item.progress}
          aria-label={"Envio de " + item.name}
        />
      )}
      {item.message && <p className="text-sm text-destructive">{item.message}</p>}
      <QueueItemActions item={item} {...actions} />
      {item.status === "READY" && (
        <a className="text-sm text-interactive underline" href={"/api/assessment-files/" + item.id}>
          Baixar prova
        </a>
      )}
    </div>
  );
}

function QueueRecentError({
  error,
  refresh,
}: {
  error: string | undefined;
  refresh: () => void;
}): ReactJSX.Element | null {
  if (!error) return null;
  return (
    <p role="alert" className="text-sm">
      Não foi possível atualizar o processamento.{" "}
      <Button size="sm" variant="ghost" onClick={refresh}>
        <RefreshCw aria-hidden="true" />
        Atualizar
      </Button>
    </p>
  );
}

function QueuePanel(queue: QueueController): ReactJSX.Element | null {
  const activeCount = queue.items.filter((item) => item.status !== "READY").length;
  if (queue.items.length === 0 && !queue.storageError) return null;
  return (
    <details
      className="shrink-0 border-t border-border bg-card px-4 py-2"
      aria-label="Fila de provas"
    >
      <summary className="flex cursor-pointer items-center gap-2 text-sm">
        <UploadCloud className="size-4" />
        {activeCount
          ? activeCount + " " + (activeCount === 1 ? "envio" : "envios") + " para acompanhar"
          : "Provas recebidas"}
      </summary>
      <div className="grid max-h-64 gap-3 overflow-y-auto py-3">
        <p className="text-sm text-muted-foreground">
          Você pode continuar navegando. Se fechar ou bloquear o celular, retome os envios
          interrompidos ao voltar.
        </p>
        {queue.storageError && (
          <p role="alert" className="text-sm text-destructive">
            {queue.storageError}
          </p>
        )}
        <QueueRecentError error={queue.recentError} refresh={queue.refreshRecent} />
        {queue.items.map((item) => (
          <QueueItemRow key={item.id} item={item} {...queue} />
        ))}
        {queue.retryError && (
          <p role="alert" className="text-sm text-destructive">
            {queue.retryError}
          </p>
        )}
        {queue.items.some((item) => item.status === "READY" || item.status === "REJECTED") && (
          <Button variant="ghost" size="sm" onClick={queue.clearFinished}>
            <ListChecks aria-hidden="true" />
            Limpar concluídos da fila
          </Button>
        )}
      </div>
    </details>
  );
}

export function AssessmentUploadProvider({
  userId,
  children,
}: {
  userId: string;
  children: ReactNode;
}): ReactJSX.Element {
  const queue = useQueueController(userId);
  return (
    <UploadContext.Provider value={{ add: queue.add }}>
      {children}
      <QueuePanel {...queue} />
    </UploadContext.Provider>
  );
}
