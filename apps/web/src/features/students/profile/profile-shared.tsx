import type { ReactElement, ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Alert, Button } from "@lazuli/ui";

export const MISSING_DETAIL = "Não informado";

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
    <Alert variant="neutral" aria-busy={isRetrying}>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 items-center gap-3">
          <AlertCircle className="size-4 shrink-0 text-destructive" aria-hidden="true" />
          <p>{message}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={onRetry} disabled={isRetrying}>
          <RefreshCw aria-hidden="true" />
          {isRetrying ? "Tentando novamente…" : "Tentar novamente"}
        </Button>
      </div>
    </Alert>
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
