import { useCallback, useRef, useState } from "react";
import { trpc } from "~/lib/trpc";
import { queueAdd } from "./queue-add";
import {
  useQueueHydration,
  useQueueReceipts,
  useQueueTransfers,
  useUploadLeaveWarning,
} from "./queue-effects";
import type { QueueItem, QueueViewState, UploadContextValue } from "./queue-model";
const ACTIVE_POLL_MS = 3000;
const IDLE_POLL_MS = 15_000;
export function useUploadQueue(userId: string): QueueViewState & UploadContextValue {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [storageError, setStorageError] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const running = useRef<XMLHttpRequest | null>(null);
  const dismissed = useRef(new Set<string>());
  const utils = trpc.useUtils();
  const recent = trpc.assessmentFiles.recent.useQuery(undefined, {
    refetchInterval: items.some(
      (item) => !["READY", "REJECTED", "INTERRUPTED", "FAILED"].includes(item.status),
    )
      ? ACTIVE_POLL_MS
      : IDLE_POLL_MS,
  });
  const retry = trpc.assessmentFiles.retry.useMutation({
    onSuccess: () => utils.assessmentFiles.invalidate(),
  });
  const refresh = useCallback(() => {
    void Promise.all([utils.assessmentFiles.invalidate(), utils.assessments.invalidate()]);
  }, [utils]);
  useQueueHydration({ userId, setItems, setStorageError, setHydrated, running });
  useQueueReceipts({ data: recent.data, hydrated, userId, dismissed, setItems });
  useQueueTransfers({ items, userId, refresh, running, setItems });
  useUploadLeaveWarning(running);
  return {
    items,
    setItems,
    storageError,
    recentError: Boolean(recent.error),
    onRefetch: () => void recent.refetch(),
    dismissed,
    retry,
    add: queueAdd({ hydrated, userId, setItems }),
  };
}
