import type { ReactElement, ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { Button, InlineSkeleton, ToastAlert } from "@lazuli/ui";

export function ProfileLoading(): ReactElement {
  return (
    <div role="status" className="grid gap-4 py-6">
      <InlineSkeleton className="h-8 w-48" />
      <InlineSkeleton className="h-4 w-64" />
      <span className="sr-only">Carregando informações do aluno</span>
    </div>
  );
}
export function ProfileError({
  message,
  onRetry,
  isRetrying = false,
}: {
  message: string;
  onRetry: () => void;
  isRetrying?: boolean;
}): ReactElement {
  return (
    <ToastAlert variant="destructive" toastTimeout={0}>
      <div className="grid gap-2">
        <p>{message}</p>
        <Button variant="secondary" size="sm" onClick={onRetry} disabled={isRetrying}>
          <RefreshCw aria-hidden="true" />
          {isRetrying ? "Tentando novamente…" : "Tentar novamente"}
        </Button>
      </div>
    </ToastAlert>
  );
}
export function ProfileFact({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}): ReactElement {
  return (
    <div className="grid min-w-0 gap-1">
      <dt className="text-micro font-semibold uppercase tracking-label text-muted-foreground">
        {label}
      </dt>
      <dd className="break-words text-base sm:text-sm">{children}</dd>
    </div>
  );
}
