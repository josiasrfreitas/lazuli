import { useEffect, type Dispatch, type RefObject, type SetStateAction } from "react";
import { readPendingFiles, removePendingFile, transferFile } from "./local-queue";
import {
  changeQueueItem,
  COMPLETE_PERCENT,
  mergeReceivedFiles,
  type QueueItem,
  type QueueItemsSetter,
  type RecentFiles,
} from "./queue-model";

type Running = RefObject<XMLHttpRequest | null>;
type HydrationInput = {
  userId: string;
  setItems: QueueItemsSetter;
  setStorageError: Dispatch<SetStateAction<string>>;
  setHydrated: Dispatch<SetStateAction<boolean>>;
  running: Running;
};
export function useQueueHydration({
  userId,
  setItems,
  setStorageError,
  setHydrated,
  running,
}: HydrationInput): void {
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
      .catch((error: Error) => {
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
}
type ReceiptInput = {
  data: RecentFiles | undefined;
  hydrated: boolean;
  userId: string;
  dismissed: RefObject<Set<string>>;
  setItems: QueueItemsSetter;
};
export function useQueueReceipts({
  data,
  hydrated,
  userId,
  dismissed,
  setItems,
}: ReceiptInput): void {
  useEffect(() => {
    if (!data || !hydrated) return;
    const received = data.filter((row) => row.receivedAt);
    for (const row of received) void removePendingFile(userId, row.id).catch(() => {});
    setItems((current) => mergeReceivedFiles(current, { received, dismissed: dismissed.current }));
  }, [data, hydrated, userId]);
}
type TransferInput = {
  items: QueueItem[];
  userId: string;
  refresh: () => void;
  running: Running;
  setItems: QueueItemsSetter;
};
export function useQueueTransfers({
  items,
  userId,
  refresh,
  running,
  setItems,
}: TransferInput): void {
  useEffect(() => {
    const next = items.find((item) => item.status === "QUEUED" && item.pending);
    if (!next?.pending || running.current) return;
    const change = (patch: Partial<QueueItem>): void =>
      changeQueueItem(setItems, { id: next.id, patch });
    change({ status: "UPLOADING", progress: 0, message: undefined });
    const transfer = transferFile(next.pending, (progress) => change({ progress }));
    running.current = transfer.request;
    void transfer.completed
      .then(async () => {
        await removePendingFile(userId, next.id).catch(() => {});
        change({
          status: "RECEIVED",
          progress: COMPLETE_PERCENT,
          pending: undefined,
          received: true,
        });
      })
      .catch((error: Error) =>
        change({
          status: "INTERRUPTED",
          message: error instanceof Error ? error.message : "Envio interrompido.",
        }),
      )
      .finally(() => {
        running.current = null;
        refresh();
        // A new array lets the next queued item start after releasing the running request.
        setItems((current) => [...current]);
      });
  }, [items, userId, refresh]);
}
export function useUploadLeaveWarning(running: Running): void {
  useEffect(() => {
    const leaving = (event: BeforeUnloadEvent): void => {
      if (running.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", leaving);
    return () => window.removeEventListener("beforeunload", leaving);
  }, []);
}
