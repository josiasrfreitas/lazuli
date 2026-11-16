import { useEffect } from "react";
import {
  fileJobState,
  isFileProcessingStale,
  notifyFileJob,
} from "~/features/shared/file-job-toast";

type Item = {
  id: string;
  name: string;
  status: string;
  updatedAt?: Date | undefined;
  pending?: { id: string } | undefined;
  received?: boolean | undefined;
};
type Actions = { retry: (id: string) => void; resume: (id: string) => void };
function notifyItem(item: Item, actions: Actions): void {
  let retry: (() => void) | undefined;
  if (item.status === "INTERRUPTED" && item.pending) retry = () => actions.resume(item.id);
  if (item.received && (item.status === "FAILED" || isFileProcessingStale(item)))
    retry = () => actions.retry(item.id);
  notifyFileJob({
    key: `assessment:${item.id}`,
    state: fileJobState(item),
    label: item.name,
    retry,
  });
}
export function useAssessmentFileNotices(
  input: Actions & { items: Item[]; pendingId?: string | undefined },
): void {
  useEffect(() => {
    for (const item of input.items) {
      if (input.pendingId !== item.id) notifyItem(item, input);
    }
  }, [input]);
}
