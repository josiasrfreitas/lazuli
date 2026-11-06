"use client";
import type { ReactNode } from "react";
import { Toast } from "@base-ui/react/toast";
import { CircleAlert, X } from "lucide-react";

export const toastManager = Toast.createToastManager();
export function ToastProvider({ children }: { children: ReactNode }): ReactNode {
  return (
    <Toast.Provider toastManager={toastManager} timeout={15_000} limit={3}>
      {children}
      <ToastList />
    </Toast.Provider>
  );
}
function ToastList(): ReactNode {
  const { toasts } = Toast.useToastManager();
  return (
    <Toast.Portal>
      <Toast.Viewport
        aria-label="Notificações"
        className="fixed inset-x-4 bottom-2 z-[100] flex flex-col gap-2 outline-none sm:left-auto sm:w-[min(31rem,calc(100vw-2rem))]"
      >
        {toasts.map((toast) => (
          <Toast.Root
            key={toast.id}
            toast={toast}
            swipeDirection={[]}
            className="lz-toast relative rounded-lg border border-border bg-popover p-3 pr-9 text-popover-foreground shadow-lg data-[limited]:hidden data-[type=error]:border-destructive/40 data-[type=warning]:border-warning/40"
          >
            <Toast.Content>
              <div className="flex items-start gap-3">
                {(toast.type === "error" || toast.type === "warning") && (
                  <CircleAlert
                    aria-hidden="true"
                    className={
                      toast.type === "warning"
                        ? "lz-toast-icon mt-0.5 size-5 shrink-0 text-warning"
                        : "lz-toast-icon mt-0.5 size-5 shrink-0 text-destructive"
                    }
                  />
                )}
                <div className="min-w-0">
                  <Toast.Title render={<div />} className="text-sm font-medium" />
                  {toast.description && (
                    <Toast.Description className="mt-1 text-sm leading-relaxed text-muted-foreground" />
                  )}
                </div>
              </div>
              <Toast.Close
                aria-label="Fechar aviso"
                className="absolute right-2 top-2 rounded-sm p-1 text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring"
              >
                <X className="size-4" />
              </Toast.Close>
            </Toast.Content>
          </Toast.Root>
        ))}
      </Toast.Viewport>
    </Toast.Portal>
  );
}
