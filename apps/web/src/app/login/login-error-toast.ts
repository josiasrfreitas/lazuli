import { toastManager } from "@lazuli/ui";

let activeErrorToast: string | undefined;

export function showLoginError(message: string): string {
  if (activeErrorToast) toastManager.close(activeErrorToast);
  activeErrorToast = toastManager.add({
    title: message,
    type: "error",
    priority: "high",
  });
  return activeErrorToast;
}
