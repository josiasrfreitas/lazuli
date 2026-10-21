import type { Dispatch, RefObject, SetStateAction } from "react";
import type { RouterOutputs } from "@lazuli/api";
import type { PendingFile } from "./local-queue";
export type QueueStatus =
  | "QUEUED"
  | "UPLOADING"
  | "INTERRUPTED"
  | "RECEIVED"
  | "PROCESSING"
  | "READY"
  | "FAILED"
  | "REJECTED";
export type QueueItem = {
  id: string;
  name: string;
  status: QueueStatus;
  progress: number;
  pending?: PendingFile | undefined;
  message?: string | undefined;
  received?: boolean;
};
export type QueueItemsSetter = Dispatch<SetStateAction<QueueItem[]>>;
export type RecentFiles = RouterOutputs["assessmentFiles"]["recent"];
export type RetryState = {
  isPending: boolean;
  error: { message: string } | null;
  mutate: (input: { id: string }) => void;
};
export type QueueViewState = {
  items: QueueItem[];
  storageError: string;
  recentError: boolean;
  onRefetch: () => void;
  retry: RetryState;
  setItems: QueueItemsSetter;
  dismissed: RefObject<Set<string>>;
};
export type QueueTarget = Omit<PendingFile, "id" | "file" | "createdAt">;
export type UploadContextValue = { add: (files: File[], target: QueueTarget) => Promise<void> };
export const COMPLETE_PERCENT = 100;
export const labels: Record<QueueStatus, string> = {
  QUEUED: "Na fila",
  UPLOADING: "Enviando",
  INTERRUPTED: "Envio interrompido",
  RECEIVED: "Recebido · aguardando processamento",
  PROCESSING: "Recebido · processando",
  READY: "Pronto para consulta",
  FAILED: "Não foi possível concluir",
  REJECTED: "Arquivo inválido · selecione outro",
};
export function mergeReceivedFiles(
  current: QueueItem[],
  values: { received: RecentFiles; dismissed: ReadonlySet<string> },
): QueueItem[] {
  const { received, dismissed } = values;
  const next = current.map((item) => {
    const row = received.find((file) => file.id === item.id);
    return row
      ? {
          id: item.id,
          name: item.name,
          status: row.status as QueueStatus,
          progress: COMPLETE_PERCENT,
          received: true,
        }
      : item;
  });
  for (const row of received)
    if (
      row.status !== "READY" &&
      !dismissed.has(row.id) &&
      !next.some((item) => item.id === row.id)
    )
      next.push({
        id: row.id,
        name: row.fileName,
        status: row.status as QueueStatus,
        progress: COMPLETE_PERCENT,
        received: true,
      });
  return next;
}
export function changeQueueItem(
  setItems: QueueItemsSetter,
  values: { id: string; patch: Partial<QueueItem> },
): void {
  setItems((current) =>
    current.map((item) => (item.id === values.id ? { ...item, ...values.patch } : item)),
  );
}
