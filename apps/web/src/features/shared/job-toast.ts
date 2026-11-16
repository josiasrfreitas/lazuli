import type { MouseEvent } from "react";
import { toastManager } from "@lazuli/ui";

const SUCCESS_TIMEOUT_MS = 5000;
type JobNotice = {
  key: string;
  state: string;
  title: string;
  description?: string | undefined;
  outcome: "working" | "success" | "error";
  retry?: (() => void) | undefined;
};
type Entry = { state: string; toastId: string; dismissed: boolean };

type ToastOptions = Parameters<typeof toastManager.add>[0];
function noticeOptions(input: JobNotice): ToastOptions {
  const types = { working: "job-running", success: "job-success", error: "error" };
  return {
    title: input.title,
    description: input.description,
    type: types[input.outcome],
    timeout: input.outcome === "success" ? SUCCESS_TIMEOUT_MS : 0,
    actionProps: input.retry
      ? {
          children: "Tentar novamente",
          onClick: (event: MouseEvent<HTMLButtonElement>) => {
            event.preventDefault();
            input.retry?.();
          },
        }
      : undefined,
  };
}

/** A scope owns deduplication and explicit success dismissal, including when focus pauses Base UI timers. */
export function createJobNotifier(): {
  notify: (input: JobNotice) => void;
  has: (key: string) => boolean;
} {
  const notices = new Map<string, Entry>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  function clearTimer(key: string): void {
    clearTimeout(timers.get(key));
    timers.delete(key);
  }
  function notify(input: JobNotice): void {
    const previous = notices.get(input.key);
    if (previous?.state === input.state) return;
    clearTimer(input.key);
    const options = noticeOptions(input);
    let entry = previous;
    if (entry && !entry.dismissed) {
      toastManager.update(entry.toastId, options);
      entry.state = input.state;
    } else {
      const next: Entry = { state: input.state, toastId: "", dismissed: false };
      next.toastId = toastManager.add({
        ...options,
        onClose: () => {
          next.dismissed = true;
          clearTimer(input.key);
        },
      });
      notices.set(input.key, next);
      entry = next;
    }
    if (input.outcome === "success") {
      const { toastId } = entry;
      timers.set(
        input.key,
        setTimeout(() => {
          toastManager.close(toastId);
          timers.delete(input.key);
        }, SUCCESS_TIMEOUT_MS),
      );
    }
  }
  return { notify, has: (key: string) => notices.has(key) };
}
