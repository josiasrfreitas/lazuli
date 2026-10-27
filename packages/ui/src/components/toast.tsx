"use client";
import type { ReactNode } from "react";
import { Toast } from "@base-ui/react/toast";
import { X } from "lucide-react";

export const toastManager = Toast.createToastManager();
export function ToastProvider({ children }: { children: ReactNode }): ReactNode {
  return (
    <Toast.Provider toastManager={toastManager} timeout={4500} limit={3}>
      {children}
      <ToastList />
    </Toast.Provider>
  );
}
function ToastList(): ReactNode {
  const { toasts } = Toast.useToastManager();
  return (
    <Toast.Portal>
      <Toast.Viewport className="fixed inset-x-4 bottom-4 z-[100] flex flex-col gap-2 outline-none sm:left-auto sm:w-80">
        {toasts.map((toast) => (
          <Toast.Root
            key={toast.id}
            toast={toast}
            className="relative rounded-lg border border-border bg-popover p-3 pr-9 text-popover-foreground shadow-lg data-[limited]:hidden"
          >
            <Toast.Content>
              <Toast.Title className="text-sm font-medium" />
              <Toast.Description className="mt-1 text-xs text-muted-foreground" />
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
